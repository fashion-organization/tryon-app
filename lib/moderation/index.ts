import "server-only";

import { decide, type ModerationDecision } from "./policy";

export class ModerationUnavailableError extends Error {}

/**
 * Checks an image with OpenAI's moderation endpoint (free, model omni-moderation-latest).
 * Without OPENAI_API_KEY, photos are allowed only outside production, with a warning in the log,
 * so local work is possible before the key exists. In production a missing key refuses uploads.
 */
export async function moderateImage(jpeg: Buffer): Promise<ModerationDecision> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    if (process.env.VERCEL_ENV === "production") {
      throw new ModerationUnavailableError("OPENAI_API_KEY is not set");
    }
    console.warn("moderation skipped: OPENAI_API_KEY is not set (allowed outside production only)");
    return { ok: true };
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ModerationUnavailableError(`moderation request failed: ${(e as Error).message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ModerationUnavailableError(`moderation returned ${response.status}: ${detail.slice(0, 300)}`);
  }

  const body = (await response.json()) as { results?: { category_scores?: Record<string, number> }[] };
  const scores = body.results?.[0]?.category_scores;
  if (!scores) throw new ModerationUnavailableError("moderation response had no scores");
  return decide(scores);
}
