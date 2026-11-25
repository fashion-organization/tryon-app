import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Buckets that hold files in a folder per user: <bucket>/<user_id>/... */
export const USER_BUCKETS = ["user-photos", "tryon-results", "exports"] as const;
export type UserBucket = (typeof USER_BUCKETS)[number];

/** Every file in a user's folder in one bucket, as { path, createdAt }. */
export async function listUserFiles(bucket: UserBucket, userId: string): Promise<{ path: string; createdAt: string | null }[]> {
  const admin = createAdminClient();
  const files: { path: string; createdAt: string | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Could not list ${bucket}/${userId}: ${error.message}`);
    // Folders (no id) would be listed too; users' folders hold only files.
    for (const f of data) if (f.id) files.push({ path: `${userId}/${f.name}`, createdAt: f.created_at ?? null });
    if (data.length < 1000) return files;
  }
}

/** Deletes every file in a user's folder in one bucket. Returns how many were removed. */
export async function removeUserFiles(bucket: UserBucket, userId: string): Promise<number> {
  const files = await listUserFiles(bucket, userId);
  const admin = createAdminClient();
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100).map((f) => f.path);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw new Error(`Could not delete files in ${bucket}: ${error.message}`);
  }
  return files.length;
}
