import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { track } from "@/lib/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AGE_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export type CurrentUser = { id: string; email: string | null };

/** The signed-in user, verified with Supabase, or null. */
export async function getUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/**
 * For protected pages and actions. Sends signed-out visitors to sign-in, and users who have
 * not yet confirmed they are 18+ and accepted the terms (e.g. new Google sign-ins) to /welcome.
 */
export async function requireUser(next: string, options: { consent?: boolean } = {}): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  if (options.consent !== false && !(await hasAcceptedTerms(user.id))) {
    redirect(`/welcome?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("is_adult_confirmed_at").eq("id", userId).maybeSingle();
  return Boolean(data?.is_adult_confirmed_at);
}

/**
 * Records the 18+, terms and privacy consents with the request's IP address, and marks the
 * profile as adult-confirmed. Server only: the browser cannot write consents itself.
 */
export async function recordSignupConsents(userId: string, method: "email" | "google"): Promise<void> {
  const admin = createAdminClient();
  const ip = await clientIp();
  const rows = [
    { user_id: userId, type: "age_18_plus", version: AGE_VERSION, ip },
    { user_id: userId, type: "terms", version: TERMS_VERSION, ip },
    { user_id: userId, type: "privacy", version: PRIVACY_VERSION, ip },
  ];
  const inserted = await admin.from("consents").insert(rows);
  if (inserted.error) throw new Error(`Could not save consents: ${inserted.error.message}`);

  const updated = await admin
    .from("profiles")
    .update({ is_adult_confirmed_at: new Date().toISOString() })
    .eq("id", userId);
  if (updated.error) throw new Error(`Could not update profile: ${updated.error.message}`);

  // The one place every new account passes through (email sign-up, or /welcome after Google).
  track("signup", userId, { method });
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const candidate = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/** This site's origin for links in emails and OAuth, e.g. https://tryon-app.vercel.app */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
