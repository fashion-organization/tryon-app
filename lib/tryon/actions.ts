"use server";

import { track } from "@/lib/analytics";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thumbs up (1), down (-1) or cleared (null). Row-level security limits this to the user's own results. */
export async function rateTryOn(jobId: string, rating: 1 | -1 | null): Promise<{ error?: string }> {
  if (!UUID.test(jobId) || ![1, -1, null].includes(rating)) return { error: "That didn't work. Please try again." };
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tryon_jobs")
    .update({ rating })
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("status", "done")
    .select("id");
  if (error || !data?.length) return { error: "Your rating couldn't be saved. Please try again." };
  track("tryon_rated", user.id, { rating: rating === 1 ? "up" : rating === -1 ? "down" : "cleared" });
  return {};
}
