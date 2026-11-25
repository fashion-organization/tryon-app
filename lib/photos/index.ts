import "server-only";

import sharp from "sharp";
import { BODY_PHOTO_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export const MAX_PHOTOS = 5;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept about 4.5 MB per request
export const PHOTO_BUCKET = "user-photos";
export const RESULT_BUCKET = "tryon-results";

export type Photo = { id: string; isPrimary: boolean; url: string | null; createdAt: string };

/** Has the user accepted the current body-photo consent text? */
export async function hasPhotoConsent(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "body_photo")
    .eq("version", BODY_PHOTO_VERSION);
  return (count ?? 0) > 0;
}

/** The user's usable photos, newest first, with short-lived links to show them. */
export async function listPhotos(userId: string): Promise<Photo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_photos")
    .select("id, storage_path, is_primary, created_at")
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load photos: ${error.message}`);
  if (data.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(data.map((p) => p.storage_path), 60 * 60);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return data.map((p) => ({
    id: p.id,
    isPrimary: p.is_primary,
    url: urlByPath.get(p.storage_path) ?? null,
    createdAt: p.created_at,
  }));
}

export class BadImageError extends Error {}

/**
 * Re-encodes an uploaded image on the server: applies the camera rotation, limits the long side
 * to 2000 px, and writes a plain JPEG. This also drops all metadata (such as GPS location),
 * even if the browser step was skipped.
 */
export async function normalisePhoto(input: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < 400) {
      throw new BadImageError("This photo is too small. Please use a photo at least 400 pixels wide.");
    }
    return { jpeg: data, width: info.width, height: info.height };
  } catch (e) {
    if (e instanceof BadImageError) throw e;
    throw new BadImageError("We couldn't read this image. Please choose a JPEG or PNG photo.");
  }
}
