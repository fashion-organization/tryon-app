import "server-only";

import type { GarmentType } from "@/lib/catalog";
import { productImageUrl } from "@/lib/catalog";
import { moderateImage } from "@/lib/moderation";
import { PHOTO_BUCKET, RESULT_BUCKET } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { type TryOnErrorKind, USER_MESSAGES, classifyError } from "./errors";
import { STUCK_AFTER_MS, getProvider, tryOnLimits } from "./index";
import { markAsAiPreview } from "./mark";
import { ProviderError, type TryOnProvider } from "./provider";

/** What the browser sees about a job. */
export type JobView = {
  id: string;
  status: "processing" | "done" | "failed";
  photoId: string;
  productId: string;
  createdAt: string;
  finishedAt: string | null;
  rating: -1 | 1 | null;
  resultUrl?: string; // short-lived link to the marked image
  error?: { kind: TryOnErrorKind; title: string; action: string };
};

type JobRow = {
  id: string;
  user_id: string;
  photo_id: string;
  product_id: string;
  provider: string;
  provider_job_id: string | null;
  status: string;
  result_path: string | null;
  error_code: string | null;
  attempts: number;
  rating: number | null;
  created_at: string;
  finished_at: string | null;
};

const JOB_COLUMNS =
  "id, user_id, photo_id, product_id, provider, provider_job_id, status, result_path, error_code, attempts, rating, created_at, finished_at";
const MAX_ATTEMPTS = 2; // the first try plus one automatic retry
const PERSON_URL_SECONDS = 10 * 60;
const RESULT_URL_SECONDS = 60 * 60;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;
const OPEN = ["queued", "processing"];

export const LIMIT_MESSAGES = {
  user_limit: (n: number) => `You've used your ${n} free try-ons for today. Please come back tomorrow.`,
  global_cap: "Try-on is very busy today. Please try again tomorrow.",
  off: "Try-on isn't available right now. Please try again later.",
};

export type StartResult =
  | { ok: true; job: JobView }
  | { ok: false; status: number; error: string };

/**
 * POST /api/tryon. Checks happen in the caller (sign-in, consents); this checks the photo and
 * product, then the cache, the in-flight guard and the limits (in one database call), and submits.
 */
export async function startTryOn(userId: string, photoId: string, productId: string): Promise<StartResult> {
  const provider = getProvider();
  if (!provider) return { ok: false, status: 503, error: LIMIT_MESSAGES.off };

  const admin = createAdminClient();
  const [{ data: photo }, { data: product }] = await Promise.all([
    admin.from("user_photos").select("id, storage_path").eq("id", photoId).eq("user_id", userId).eq("status", "ready").maybeSingle(),
    admin.from("products").select("id, garment_type, tryon_image_path").eq("id", productId).eq("status", "published").maybeSingle(),
  ]);
  if (!photo) return { ok: false, status: 404, error: "Please choose one of your photos." };
  if (!product?.tryon_image_path) return { ok: false, status: 404, error: "This item isn't available." };

  const { perUser, globalCap } = tryOnLimits();
  const { data: started, error } = await admin
    .rpc("start_tryon_job", {
      p_user_id: userId,
      p_photo_id: photoId,
      p_product_id: productId,
      p_provider: provider.name,
      p_user_limit: perUser,
      p_global_cap: globalCap,
    })
    .single();
  if (error || !started) {
    console.error("tryon start:", error?.message);
    return { ok: false, status: 500, error: USER_MESSAGES.unknown.title };
  }

  switch (started.outcome) {
    case "user_limit":
      return { ok: false, status: 429, error: LIMIT_MESSAGES.user_limit(perUser) };
    case "global_cap":
      console.error(`tryon: global daily cap of ${globalCap} reached`);
      return { ok: false, status: 503, error: LIMIT_MESSAGES.global_cap };
    case "cached":
    case "in_flight":
      return { ok: true, job: await viewJob(await loadJob(started.job_id!)) };
  }

  // "created": ask the provider.
  const job = await loadJob(started.job_id!);
  await submit(provider, job, { personPath: photo.storage_path, garmentPath: product.tryon_image_path, garmentType: product.garment_type as GarmentType });
  return { ok: true, job: await viewJob(await loadJob(job.id)) };
}

/**
 * GET /api/tryon/[id]. Returns the job, first asking the provider for news if it is still running.
 * Returns null if the job does not exist or belongs to someone else.
 */
export async function pollTryOn(userId: string, jobId: string): Promise<JobView | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("tryon_jobs").select(JOB_COLUMNS).eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  let job = data as JobRow;

  if (OPEN.includes(job.status)) {
    await advance(job);
    job = await loadJob(job.id);
  }
  return viewJob(job);
}

/** Fails every job that has been running for more than 3 minutes. Returns how many. */
export async function sweepStuckJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data, error } = await createAdminClient()
    .from("tryon_jobs")
    .update({ status: "failed", error_code: "timeout", finished_at: new Date().toISOString() })
    .in("status", OPEN)
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw new Error(`sweep failed: ${error.message}`);
  return data.length;
}

// ---------------------------------------------------------------------------------------------

async function loadJob(id: string): Promise<JobRow> {
  const { data, error } = await createAdminClient().from("tryon_jobs").select(JOB_COLUMNS).eq("id", id).single();
  if (error) throw new Error(`Could not load try-on job: ${error.message}`);
  return data as JobRow;
}

/** Sets a job's final state, only if it is still open (another request may have finished it). */
async function finish(jobId: string, fields: { status: "done" | "failed"; error_code?: string; result_path?: string; cost_cents?: number }) {
  const { error } = await createAdminClient()
    .from("tryon_jobs")
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", OPEN);
  if (error) console.error("tryon finish:", error.message);
}

type Inputs = { personPath: string; garmentPath: string; garmentType: GarmentType };

async function inputsFor(job: JobRow): Promise<Inputs | null> {
  const admin = createAdminClient();
  const [{ data: photo }, { data: product }] = await Promise.all([
    admin.from("user_photos").select("storage_path").eq("id", job.photo_id).maybeSingle(),
    admin.from("products").select("garment_type, tryon_image_path").eq("id", job.product_id).maybeSingle(),
  ]);
  if (!photo || !product?.tryon_image_path) return null;
  return { personPath: photo.storage_path, garmentPath: product.tryon_image_path, garmentType: product.garment_type as GarmentType };
}

/** Sends the job to the provider. A temporary refusal is retried once straight away. */
async function submit(provider: TryOnProvider, job: JobRow, inputs: Inputs): Promise<void> {
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(inputs.personPath, PERSON_URL_SECONDS);
  const garmentImageUrl = productImageUrl(inputs.garmentPath);
  if (error || !signed || !garmentImageUrl) {
    console.error("tryon submit: no image link", error?.message);
    return finish(job.id, { status: "failed", error_code: "input_missing" });
  }

  let attempts = job.attempts;
  for (;;) {
    try {
      const { providerJobId } = await provider.submit({
        personImageUrl: signed.signedUrl,
        garmentImageUrl,
        garmentType: inputs.garmentType,
      });
      await admin
        .from("tryon_jobs")
        .update({ provider_job_id: providerJobId, status: "processing", attempts })
        .eq("id", job.id)
        .in("status", OPEN);
      return;
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError("submit_error", (e as Error).message);
      const log = err.code === "OutOfCredits" || err.code === "not_configured" ? console.error : console.warn;
      log(`tryon submit (attempt ${attempts}): ${err.code}: ${err.message}`);
      if (err.retryable && attempts < MAX_ATTEMPTS) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return finish(job.id, { status: "failed", error_code: err.code });
    }
  }
}

/** One step forward for a running job: check the provider, then store, retry or fail. */
async function advance(job: JobRow): Promise<void> {
  if (Date.now() - new Date(job.created_at).getTime() > STUCK_AFTER_MS) {
    return finish(job.id, { status: "failed", error_code: "timeout" });
  }
  if (!job.provider_job_id) return; // being submitted or retried by another request

  const provider = getProvider();
  if (!provider || provider.name !== job.provider) {
    // The provider was switched while this job ran; it can't be checked any more.
    return finish(job.id, { status: "failed", error_code: "provider_changed" });
  }

  let status;
  try {
    status = await provider.getStatus(job.provider_job_id);
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "status_error";
    console.error(`tryon status ${job.id}: ${code}: ${(e as Error).message}`);
    return; // try again on the next poll; the sweep ends it if it never recovers
  }

  if (status.status === "processing") return;

  if (status.status === "failed") {
    if (status.retryable && job.attempts < MAX_ATTEMPTS) return retry(provider, job);
    return finish(job.id, { status: "failed", error_code: status.errorCode });
  }

  // Succeeded: copy the image to our storage with the AI mark (never keep the provider's URL).
  let image: Buffer;
  try {
    image = await download(status.outputUrl);
  } catch (e) {
    console.error(`tryon download ${job.id}:`, (e as Error).message);
    return finish(job.id, { status: "failed", error_code: "download_failed" });
  }

  // Check the result and add the mark at the same time.
  const [decision, marked] = await Promise.all([
    moderateImage(image).catch((e: Error) => {
      // The provider filters its own output and the input photo was checked, so a moderation
      // outage does not throw away a paid result. Logged for review.
      console.error(`tryon ${job.id}: result not moderated:`, e.message);
      return null;
    }),
    markAsAiPreview(image).catch((e: Error) => {
      console.error(`tryon mark ${job.id}:`, e.message);
      return null;
    }),
  ]);
  if (decision && !decision.ok) {
    console.warn(`tryon ${job.id}: result blocked by moderation (${decision.category})`);
    return finish(job.id, { status: "failed", error_code: "output_blocked" });
  }
  if (!marked) return finish(job.id, { status: "failed", error_code: "bad_output" });

  const path = `${job.user_id}/${job.id}.jpg`;
  const uploaded = await createAdminClient()
    .storage.from(RESULT_BUCKET)
    .upload(path, marked, { contentType: "image/jpeg", upsert: true });
  if (uploaded.error) {
    console.error(`tryon store ${job.id}:`, uploaded.error.message);
    return; // the provider keeps the output for 3 days; the next poll tries again
  }
  await finish(job.id, { status: "done", result_path: path, cost_cents: status.costCents });
}

/** The one automatic retry. Claims it first, so two polls at once cannot both pay for a retry. */
async function retry(provider: TryOnProvider, job: JobRow): Promise<void> {
  const { data: claimed } = await createAdminClient()
    .from("tryon_jobs")
    .update({ attempts: job.attempts + 1, provider_job_id: null })
    .eq("id", job.id)
    .eq("attempts", job.attempts)
    .in("status", OPEN)
    .select("id");
  if (!claimed?.length) return;

  const inputs = await inputsFor(job);
  if (!inputs) return finish(job.id, { status: "failed", error_code: "input_missing" });
  console.warn(`tryon ${job.id}: retrying once`);
  await submit(provider, { ...job, attempts: job.attempts + 1 }, inputs);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length"));
  if (length > MAX_RESULT_BYTES) throw new Error(`result too large (${length} bytes)`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_RESULT_BYTES) throw new Error(`result too large (${bytes.length} bytes)`);
  return bytes;
}

async function viewJob(job: JobRow): Promise<JobView> {
  const view: JobView = {
    id: job.id,
    status: job.status === "done" ? "done" : job.status === "failed" ? "failed" : "processing",
    photoId: job.photo_id,
    productId: job.product_id,
    createdAt: job.created_at,
    finishedAt: job.finished_at,
    rating: job.rating === 1 || job.rating === -1 ? job.rating : null,
  };
  if (view.status === "done" && job.result_path) {
    const { data } = await createAdminClient().storage.from(RESULT_BUCKET).createSignedUrl(job.result_path, RESULT_URL_SECONDS);
    view.resultUrl = data?.signedUrl;
  }
  if (view.status === "failed") {
    const kind = classifyError(job.error_code);
    view.error = { kind, ...USER_MESSAGES[kind] };
  }
  return view;
}
