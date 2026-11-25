import "server-only";

import type { GarmentType } from "@/lib/catalog";
import { ProviderError, type ProviderStatus, type TryOnProvider } from "../provider";

// FASHN API (docs.fashn.ai, read 2026-11-25):
//   POST /v1/run {model_name, inputs} -> {id, error}; errors: {error: "<Name>", message}
//   GET  /v1/status/{id} -> {status: starting|in_queue|processing|completed|failed, output: [url], error: {name, message}}
//   Credits used come back in the x-fashn-credits-used header. Failed predictions cost nothing.
//   Images may be public URLs (signed URLs recommended) or data URIs. Output URLs last 3 days.
const API = "https://api.fashn.ai/v1";

const CATEGORY: Record<GarmentType, string> = { top: "tops", bottom: "bottoms", one_piece: "one-pieces" };

// FASHN says these are temporary: retry with backoff.
const RETRYABLE = new Set([
  "ThirdPartyError",
  "UnavailableError",
  "PipelineError",
  "InternalServerError",
  "RateLimitExceeded",
  "ConcurrencyLimitExceeded",
]);

type Model = "tryon-v1.6" | "tryon-max";

function inputsFor(model: Model, person: string, garment: string, garmentType: GarmentType) {
  if (model === "tryon-max") {
    // "fast" at 1k is 1 credit; leaving the mode out is billed as "balanced" (2 credits).
    return { model_image: person, product_image: garment, resolution: "1k", generation_mode: "fast", num_images: 1, output_format: "jpeg" };
  }
  return { model_image: person, garment_image: garment, category: CATEGORY[garmentType], output_format: "jpeg" };
}

function apiKey(): string {
  const key = process.env.FASHN_API_KEY;
  if (!key) throw new ProviderError("not_configured", "FASHN_API_KEY is not set");
  return key;
}

/** Cents per FASHN credit. $0.075 per credit on the pay-as-you-go price; set if you get a discount. */
function centsPerCredit(): number {
  const value = Number(process.env.FASHN_CENTS_PER_CREDIT);
  return Number.isFinite(value) && value > 0 ? value : 7.5;
}

export function fashnProvider(model: Model): TryOnProvider {
  return {
    name: model === "tryon-max" ? "fashn-max" : "fashn-v1.6",

    async submit({ personImageUrl, garmentImageUrl, garmentType }) {
      let res: Response;
      try {
        res = await fetch(`${API}/run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model_name: model, inputs: inputsFor(model, personImageUrl, garmentImageUrl, garmentType) }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        throw new ProviderError("network", `FASHN submit failed: ${(e as Error).message}`, true);
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string | null; message?: string };
      if (!res.ok || !body.id) {
        const code = typeof body.error === "string" ? body.error : `http_${res.status}`;
        throw new ProviderError(code, body.message ?? `FASHN submit returned HTTP ${res.status}`, RETRYABLE.has(code) || res.status >= 500);
      }
      return { providerJobId: body.id };
    },

    async getStatus(providerJobId): Promise<ProviderStatus> {
      let res: Response;
      try {
        res = await fetch(`${API}/status/${encodeURIComponent(providerJobId)}`, {
          headers: { Authorization: `Bearer ${apiKey()}` },
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        // A network blip while checking is not a failed job: ask again on the next poll.
        console.warn("fashn status:", (e as Error).message);
        return { status: "processing" };
      }
      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        output?: string[];
        error?: { name?: string; message?: string } | string | null;
      };
      if (!res.ok) {
        const code = typeof body.error === "string" ? body.error : `http_${res.status}`;
        if (res.status === 429 || res.status >= 500) return { status: "processing" }; // ask again later
        return { status: "failed", errorCode: code, retryable: false };
      }

      if (body.status === "completed") {
        const outputUrl = body.output?.[0];
        if (!outputUrl) return { status: "failed", errorCode: "no_output", retryable: true };
        const credits = Number(res.headers.get("x-fashn-credits-used"));
        const expected = 1; // both configured modes cost 1 credit
        return { status: "succeeded", outputUrl, costCents: (Number.isFinite(credits) && credits > 0 ? credits : expected) * centsPerCredit() };
      }
      if (body.status === "failed" || body.status === "canceled" || body.status === "time_out") {
        const err = typeof body.error === "object" && body.error ? body.error : {};
        // Some errors can be about either image; the message says which.
        const aboutGarment = /garment|product/i.test(err.message ?? "");
        const code = `${err.name ?? body.status}${aboutGarment ? ":garment" : ""}`;
        if (err.message) console.warn(`fashn job ${providerJobId} failed: ${code}: ${err.message}`);
        return { status: "failed", errorCode: code, retryable: RETRYABLE.has(err.name ?? "") };
      }
      return { status: "processing" }; // starting, in_queue, processing
    },
  };
}
