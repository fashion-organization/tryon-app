"use server";

import { refresh } from "next/cache";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { metricFromDisplay, type Display, type Units } from "@/lib/units";

export type ProfileFormState = { error?: string; field?: string; savedAt?: number };

const DISPLAY_FIELDS: (keyof Display)[] = ["heightCm", "heightFt", "heightIn", "weight", "chest", "waist", "hips"];

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getUser();
  if (!user) return { error: "You've been signed out. Please sign in again." };

  const units: Units = formData.get("units") === "metric" ? "metric" : "imperial";
  const name = String(formData.get("display_name") ?? "").trim();
  if (name.length > 80) return { error: "Please use a name of 80 characters or fewer.", field: "display_name" };

  const display = Object.fromEntries(
    DISPLAY_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  ) as Display;
  const parsed = metricFromDisplay(display, units);
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };

  // Row-level security and column grants let the user change only these columns of their own row.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name || null, preferred_units: units, ...parsed.metric })
    .eq("id", user.id);
  if (error) {
    console.error("save profile", error.message);
    return { error: "Your changes couldn't be saved. Please try again." };
  }

  refresh();
  return { savedAt: Date.now() };
}
