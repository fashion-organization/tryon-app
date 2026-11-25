"use server";

import { refresh } from "next/cache";
import { clientIp, getUser } from "@/lib/auth/dal";
import { BODY_PHOTO_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, RESULT_BUCKET } from "./index";

export type PhotoActionState = { error?: string };

export async function acceptPhotoConsent(_prev: PhotoActionState, formData: FormData): Promise<PhotoActionState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };
  if (formData.get("consent") !== "on") return { error: "Please tick the box to continue." };

  const { error } = await createAdminClient()
    .from("consents")
    .insert({ user_id: user.id, type: "body_photo", version: BODY_PHOTO_VERSION, ip: await clientIp() });
  if (error) {
    console.error("photo consent", error.message);
    return { error: "Something went wrong. Please try again." };
  }
  refresh();
  return {};
}

export async function setPrimaryPhoto(photoId: string): Promise<PhotoActionState> {
  const supabase = await createClient();
  // Runs as the user: the database function checks the photo is theirs and ready.
  const { error } = await supabase.rpc("set_primary_photo", { photo_id: photoId });
  if (error) return { error: "That photo couldn't be selected. Please reload the page." };
  refresh();
  return {};
}

/** Deletes the photo file, its try-on results, and its rows. */
export async function deletePhoto(photoId: string): Promise<PhotoActionState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("user_photos")
    .select("id, storage_path, is_primary")
    .eq("id", photoId)
    .eq("user_id", user.id) // the photo must belong to the signed-in user
    .maybeSingle();
  if (!photo) return { error: "That photo no longer exists. Please reload the page." };

  const { data: jobs } = await admin.from("tryon_jobs").select("result_path").eq("photo_id", photo.id);
  const results = (jobs ?? []).map((j) => j.result_path).filter((p): p is string => Boolean(p));

  const removed = await admin.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (removed.error) {
    console.error("delete photo: storage", removed.error.message);
    return { error: "The photo couldn't be deleted. Please try again." };
  }
  if (results.length) await admin.storage.from(RESULT_BUCKET).remove(results);

  const deleted = await admin.from("user_photos").delete().eq("id", photo.id); // try-on rows go with it
  if (deleted.error) {
    console.error("delete photo: row", deleted.error.message);
    return { error: "The photo couldn't be deleted. Please try again." };
  }

  if (photo.is_primary) {
    const { data: next } = await admin
      .from("user_photos")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) await admin.from("user_photos").update({ is_primary: true }).eq("id", next.id);
  }

  refresh();
  return {};
}
