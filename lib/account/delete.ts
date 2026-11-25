import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { USER_BUCKETS, listUserFiles, removeUserFiles } from "./storage";

/**
 * Deletes everything we hold about a user:
 * 1. their files in every bucket (photos, try-on results, data exports);
 * 2. the sign-in account, which removes every row that belongs to it (profile, consents, photos,
 *    try-ons) and ends its sessions; buy clicks stay, without the user id, as anonymous counts;
 * 3. the folders again, in case a try-on result was being saved during steps 1-2.
 * Then checks that nothing with the user's id is left, and throws if something is.
 */
export async function deleteAccountData(userId: string): Promise<{ files: number }> {
  const removeAll = async () =>
    (await Promise.all(USER_BUCKETS.map((bucket) => removeUserFiles(bucket, userId)))).reduce((a, b) => a + b, 0);

  let files = await removeAll();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw new Error(`Could not delete the sign-in account: ${error.message}`);

  files += await removeAll();

  const leftovers = await findUserData(userId);
  if (leftovers.length) throw new Error(`Data left after deletion: ${leftovers.join(", ")}`);
  return { files };
}

/** Where, if anywhere, this user id still appears. Empty means fully deleted. */
export async function findUserData(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const head = { count: "exact", head: true } as const;
  const checks = [
    ["profiles", admin.from("profiles").select("id", head).eq("id", userId)],
    ["consents", admin.from("consents").select("id", head).eq("user_id", userId)],
    ["user_photos", admin.from("user_photos").select("id", head).eq("user_id", userId)],
    ["tryon_jobs", admin.from("tryon_jobs").select("id", head).eq("user_id", userId)],
    ["buy_clicks", admin.from("buy_clicks").select("id", head).eq("user_id", userId)],
  ] as const;
  const counts = await Promise.all(
    checks.map(async ([table, query]) => {
      const { count, error } = await query;
      // A failed check must not look like "nothing left".
      if (error) throw new Error(`Could not check ${table}: ${error.message}`);
      return [table, count ?? 0] as const;
    }),
  );
  const found: string[] = counts.filter(([, n]) => n > 0).map(([table, n]) => `${table} (${n})`);

  const left = await Promise.all(USER_BUCKETS.map(async (bucket) => [bucket, (await listUserFiles(bucket, userId)).length] as const));
  for (const [bucket, n] of left) if (n) found.push(`${bucket} (${n} files)`);
  const { data } = await admin.auth.admin.getUserById(userId);
  if (data?.user) found.push("auth user");
  return found;
}
