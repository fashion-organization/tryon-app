import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Supabase client with the secret key. Bypasses row-level security, so use it only in
 * server code for the writes the browser is not allowed to make (photo status after
 * moderation, try-on jobs, consents, file uploads, account deletion), and always check
 * the user's identity first.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
