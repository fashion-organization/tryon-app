/**
 * Every provider or pipeline error code maps to one of five things we tell the user.
 * The raw code is kept in tryon_jobs.error_code for the admin page.
 */
export type TryOnErrorKind = "photo_unusable" | "garment_unusable" | "safety_blocked" | "busy" | "unknown";

export const USER_MESSAGES: Record<TryOnErrorKind, { title: string; action: string }> = {
  photo_unusable: {
    title: "We couldn't use this photo.",
    action: "Try a clear, well-lit photo of just you, standing and facing the camera, with your whole upper body in view.",
  },
  garment_unusable: {
    title: "This item can't be tried on right now.",
    action: "Please try a different item. We've been told about this one.",
  },
  safety_blocked: {
    title: "The safety check stopped this try-on.",
    action: "Please use a different photo of yourself.",
  },
  busy: {
    title: "Try-on is busy right now.",
    action: "Please try again in a few minutes. This one didn't count toward your daily try-ons.",
  },
  unknown: {
    title: "Something went wrong with this try-on.",
    action: "Please try again. It didn't count toward your daily try-ons.",
  },
};

const BY_CODE: Record<string, TryOnErrorKind> = {
  // FASHN
  PoseError: "photo_unusable",
  ContentModerationError: "safety_blocked",
  ThirdPartyError: "busy",
  UnavailableError: "busy",
  PipelineError: "busy",
  InternalServerError: "busy",
  RateLimitExceeded: "busy",
  ConcurrencyLimitExceeded: "busy",
  OutOfCredits: "busy", // our account, not the user's fault; it is logged loudly
  // Ours
  timeout: "busy",
  network: "busy",
  not_configured: "busy",
  output_blocked: "safety_blocked",
};

export function classifyError(code: string | null | undefined): TryOnErrorKind {
  if (!code) return "unknown";
  if (code.endsWith(":garment")) return "garment_unusable";
  return Object.hasOwn(BY_CODE, code) ? BY_CODE[code] : "unknown";
}
