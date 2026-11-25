import "server-only";

import type { TryOnProvider } from "./provider";
import { fashnProvider } from "./providers/fashn";
import { mockProvider } from "./providers/mock";

/**
 * The active provider, from TRYON_PROVIDER: mock | fashn-v1.6 | fashn-max.
 * Unset means mock, except on the live site, where try-on stays off until a provider is chosen.
 */
export function getProvider(): TryOnProvider | null {
  const name = process.env.TRYON_PROVIDER?.trim() || (process.env.VERCEL_ENV === "production" ? "" : "mock");
  switch (name) {
    case "mock":
      return mockProvider;
    case "fashn":
    case "fashn-v1.6":
      return fashnProvider("tryon-v1.6");
    case "fashn-max":
      return fashnProvider("tryon-max");
    default:
      if (name) console.error(`TRYON_PROVIDER "${name}" is not known; try-on is off`);
      return null;
  }
}

function intFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** New try-ons allowed per rolling 24 hours: per user, and for the whole site (the spending cap). */
export function tryOnLimits() {
  return {
    perUser: intFromEnv("TRYON_DAILY_FREE_PER_USER", 3),
    globalCap: intFromEnv("TRYON_GLOBAL_DAILY_CAP", 100),
  };
}

/** Jobs still running after this long are given up on (AI roadmap §4.2). */
export const STUCK_AFTER_MS = 3 * 60 * 1000;
