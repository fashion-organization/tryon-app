import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/auth/dal";
import { moderateImage } from "@/lib/moderation";
import {
  BadImageError,
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  PHOTO_BUCKET,
  hasPhotoConsent,
  normalisePhoto,
} from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload one body photo. Order matters: cheap checks first, the moderation call before anything
 * is stored, and a rejected photo is never stored (only a row recording the rejection).
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return fail(401, "Please sign in again.");
  if (!(await hasPhotoConsent(user.id))) return fail(403, "Please accept the photo consent first.");

  const admin = createAdminClient();
  const { count } = await admin
    .from("user_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "rejected");
  if ((count ?? 0) >= MAX_PHOTOS) {
    return fail(409, `You can keep up to ${MAX_PHOTOS} photos. Delete one to add another.`);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("photo");
    file = value instanceof File ? value : null;
  } catch {
    return fail(400, "The upload didn't arrive. Please try again.");
  }
  if (!file || file.size === 0) return fail(400, "Please choose a photo.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "This photo is too large. Please try another one.");

  let jpeg: Buffer;
  try {
    ({ jpeg } = await normalisePhoto(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    return fail(400, e instanceof BadImageError ? e.message : "We couldn't read this image.");
  }

  let decision;
  try {
    decision = await moderateImage(jpeg);
  } catch (e) {
    console.error("photo upload:", (e as Error).message);
    return fail(503, "We can't check photos right now. Please try again in a few minutes.");
  }

  const photoId = randomUUID();

  if (!decision.ok) {
    // Keep a record of the rejection (no file) for abuse review.
    await admin.from("user_photos").insert({
      id: photoId,
      user_id: user.id,
      storage_path: `rejected/${user.id}/${photoId}`,
      status: "rejected",
      reject_reason: decision.category,
    });
    return fail(422, decision.reason);
  }

  const path = `${user.id}/${photoId}.jpg`;
  const uploaded = await admin.storage.from(PHOTO_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (uploaded.error) {
    console.error("photo upload: storage", uploaded.error.message);
    return fail(500, "Your photo couldn't be saved. Please try again.");
  }

  const { count: primaries } = await admin
    .from("user_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_primary", true);

  const inserted = await admin.from("user_photos").insert({
    id: photoId,
    user_id: user.id,
    storage_path: path,
    status: "ready",
    is_primary: (primaries ?? 0) === 0,
  });
  if (inserted.error) {
    await admin.storage.from(PHOTO_BUCKET).remove([path]);
    const limit = inserted.error.message.includes("photo limit");
    console.error("photo upload: insert", inserted.error.message);
    return limit
      ? fail(409, `You can keep up to ${MAX_PHOTOS} photos. Delete one to add another.`)
      : fail(500, "Your photo couldn't be saved. Please try again.");
  }

  return Response.json({ id: photoId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
