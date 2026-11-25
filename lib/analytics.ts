import "server-only";

import { randomUUID } from "node:crypto";
import { after } from "next/server";

/**
 * Product events, sent from the server to PostHog's capture API. Nothing runs in the browser,
 * so no cookies are set; visitor-side analytics (page views) wait for the cookie notice (step 1.13).
 * Without NEXT_PUBLIC_POSTHOG_KEY nothing is sent. Events never carry emails, names or photos:
 * only the user's id and the properties passed here.
 */
export type EventName =
  | "signup"
  | "photo_uploaded"
  | "tryon_started"
  | "tryon_done"
  | "tryon_failed"
  | "tryon_rated"
  | "buy_clicked";

type Properties = Record<string, string | number | boolean | null | undefined>;

export function track(event: EventName, userId: string | null, properties: Properties = {}): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");

  const body = JSON.stringify({
    api_key: key,
    event,
    // Signed-out visitors get a one-off id and no person profile: they can't be followed around.
    distinct_id: userId ?? `anon-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      environment: process.env.VERCEL_ENV ?? "local",
      $process_person_profile: Boolean(userId),
      $geoip_disable: true, // the request comes from our server, so its location would be wrong anyway
      $lib: "tryon-app-server",
    },
  });

  const send = async () => {
    try {
      const res = await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) console.warn(`analytics: ${event} returned HTTP ${res.status}`);
    } catch (e) {
      console.warn(`analytics: ${event} not sent:`, (e as Error).message);
    }
  };

  // After the response is sent, so analytics never slows a page or fails a request.
  try {
    after(send);
  } catch {
    void send(); // outside a request (scripts)
  }
}
