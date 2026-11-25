import "server-only";

import { getUser } from "@/lib/auth/dal";
import { getProfile } from "@/lib/profile";
import type { Units } from "@/lib/units";
import { type Chart, type Measurement, type SizeSuggestion, suggestSize } from "./suggest";

export type SizeHelp = {
  signedIn: boolean;
  units: Units;
  suggestion: SizeSuggestion | null;
  /** Measurements this chart uses that the user hasn't entered. */
  missing: Measurement[];
};

/** The size suggestion for whoever is looking: signed out, without measurements, or with them. */
export async function getSizeHelp(chart: Chart, order: string[]): Promise<SizeHelp> {
  const user = await getUser();
  if (!user) return { signedIn: false, units: "imperial", suggestion: null, missing: chart.measurements };

  const profile = await getProfile(user.id);
  const body = { chest: profile.chest_cm, waist: profile.waist_cm, hips: profile.hips_cm };
  const suggestion = suggestSize(body, chart, order, profile.preferred_units);
  return {
    signedIn: true,
    units: profile.preferred_units,
    suggestion,
    missing: suggestion ? suggestion.missing : chart.measurements.filter((m) => body[m] == null),
  };
}
