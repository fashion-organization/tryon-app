import "server-only";

import { strToU8, zipSync, type Zippable } from "fflate";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUserFiles } from "./storage";

const EXPORT_BUCKET = "exports";
const LINK_SECONDS = 10 * 60;

const README = `Your data from Virtual try-on
=============================

profile.json      Your profile: name, units and body measurements (stored in cm and kg).
account.json      Your sign-in email and when the account was created.
consents.json     What you agreed to, which version, when, and from which IP address.
photos.json       Your photos: when each was added, which is your main one, and any that our
                  safety check refused (refused photos were never stored).
photos/           Your photos, as stored (re-encoded, without location data).
tryons.json       Your try-ons: item, status, when, how long, your rating, and any error.
tryons/           The try-on images we made for you (AI-generated previews).
buy-clicks.json   When you clicked "Buy at shop", and for which item.

Product photos are not included: they belong to the shops.
Questions: reply to any email from us, or see the privacy policy on the site.
`;

/**
 * Builds a ZIP of everything we hold about the user, stores it privately for a short time and
 * returns a 10-minute download link. Earlier exports of the same user are deleted first.
 */
export async function createExport(user: { id: string; email: string | null }): Promise<string> {
  const admin = createAdminClient();
  const [profile, consents, photos, jobs, clicks, authUser] = await Promise.all([
    admin.from("profiles").select("display_name, preferred_units, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, is_adult_confirmed_at, created_at, updated_at").eq("id", user.id).single(),
    admin.from("consents").select("type, version, ip, accepted_at").eq("user_id", user.id).order("accepted_at"),
    admin.from("user_photos").select("id, storage_path, status, reject_reason, is_primary, created_at").eq("user_id", user.id).order("created_at"),
    admin.from("tryon_jobs").select("id, product_id, provider, status, result_path, error_code, rating, created_at, finished_at").eq("user_id", user.id).order("created_at"),
    admin.from("buy_clicks").select("product_id, source, created_at").eq("user_id", user.id).order("created_at"),
    admin.auth.admin.getUserById(user.id),
  ]);
  for (const r of [profile, consents, photos, jobs, clicks]) {
    if (r.error) throw new Error(`export: ${r.error.message}`);
  }

  const productIds = [...new Set([...jobs.data!.map((j) => j.product_id), ...clicks.data!.map((c) => c.product_id)])];
  const { data: products } = productIds.length
    ? await admin.from("products").select("id, name, shop_name").in("id", productIds)
    : { data: [] };
  const productName = new Map((products ?? []).map((p) => [p.id, `${p.name} (${p.shop_name})`]));

  const files: Zippable = {
    "README.txt": strToU8(README),
    "profile.json": json(profile.data),
    "account.json": json({ email: user.email, created_at: authUser.data?.user?.created_at ?? null }),
    "consents.json": json(consents.data),
    "photos.json": json(
      photos.data!.map((p) => ({
        file: p.status === "ready" ? `photos/${p.id}.jpg` : null,
        status: p.status === "ready" ? "kept" : "refused by the safety check",
        refused_because: p.reject_reason,
        main_photo: p.is_primary,
        added: p.created_at,
      })),
    ),
    "tryons.json": json(
      jobs.data!.map((j) => ({
        file: j.result_path ? `tryons/${j.id}.jpg` : null,
        item: productName.get(j.product_id) ?? "item no longer listed",
        status: j.status,
        rating: j.rating === 1 ? "thumbs up" : j.rating === -1 ? "thumbs down" : null,
        error: j.error_code,
        made_by: j.provider,
        started: j.created_at,
        finished: j.finished_at,
      })),
    ),
    "buy-clicks.json": json(
      clicks.data!.map((c) => ({ item: productName.get(c.product_id) ?? "item no longer listed", from: c.source, when: c.created_at })),
    ),
  };

  // Images: already compressed, so stored without compressing again (level 0).
  const images: { bucket: "user-photos" | "tryon-results"; path: string; name: string }[] = [
    ...photos.data!.filter((p) => p.status === "ready").map((p) => ({ bucket: "user-photos" as const, path: p.storage_path, name: `photos/${p.id}.jpg` })),
    ...jobs.data!.filter((j) => j.result_path).map((j) => ({ bucket: "tryon-results" as const, path: j.result_path!, name: `tryons/${j.id}.jpg` })),
  ];
  for (let i = 0; i < images.length; i += 6) {
    await Promise.all(
      images.slice(i, i + 6).map(async (img) => {
        const { data, error } = await admin.storage.from(img.bucket).download(img.path);
        if (error || !data) throw new Error(`export: could not read ${img.bucket}/${img.path}: ${error?.message}`);
        files[img.name] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }];
      }),
    );
  }

  const zip = zipSync(files, { level: 6, mtime: new Date() });

  // Keep only the newest export per user.
  const old = await listUserFiles(EXPORT_BUCKET, user.id);
  if (old.length) await admin.storage.from(EXPORT_BUCKET).remove(old.map((f) => f.path));

  const day = new Date().toISOString().slice(0, 10);
  const path = `${user.id}/${Date.now()}.zip`;
  const uploaded = await admin.storage.from(EXPORT_BUCKET).upload(path, zip, { contentType: "application/zip" });
  if (uploaded.error) throw new Error(`export: could not store the file: ${uploaded.error.message}`);

  const { data: link, error } = await admin.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, LINK_SECONDS, { download: `my-tryon-data-${day}.zip` });
  if (error || !link) throw new Error(`export: could not make the link: ${error?.message}`);
  return link.signedUrl;
}

/** Deletes data exports older than a day. Run by the daily sweep. */
export async function removeOldExports(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const { data: folders, error } = await admin.storage.from(EXPORT_BUCKET).list("", { limit: 1000 });
  if (error) throw new Error(`exports sweep: ${error.message}`);
  let removed = 0;
  for (const folder of folders.filter((f) => !f.id)) {
    const old = (await listUserFiles(EXPORT_BUCKET, folder.name)).filter((f) => !f.createdAt || Date.parse(f.createdAt) < cutoff);
    if (old.length) {
      await admin.storage.from(EXPORT_BUCKET).remove(old.map((f) => f.path));
      removed += old.length;
    }
  }
  return removed;
}

function json(value: unknown): Uint8Array {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}
