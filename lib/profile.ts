import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Metric, Units } from "@/lib/units";

export type Profile = Metric & { display_name: string | null; preferred_units: Units };

/** The signed-in user's own profile (row-level security limits it to their row). */
export async function getProfile(userId: string): Promise<Profile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, preferred_units, height_cm, weight_kg, chest_cm, waist_cm, hips_cm")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return { ...data, preferred_units: data.preferred_units === "metric" ? "metric" : "imperial" };
}
