// Decides whether a photo passes, from the moderation service's scores (0 to 1).
// Body photos in swimwear or underwear must pass, so "sexual" only blocks at a high score.
// Tune these with realistic test photos (see the AI roadmap) before outside testers arrive.

export const THRESHOLDS: Record<string, number> = {
  sexual: 0.85,
  "sexual/minors": 0.1,
  "violence/graphic": 0.5,
  violence: 0.8,
  "self-harm": 0.5,
  "self-harm/intent": 0.5,
  "self-harm/instructions": 0.5,
};

export type ModerationDecision = { ok: true } | { ok: false; category: string; reason: string };

const REASONS: Record<string, string> = {
  sexual: "This photo looks too revealing. Please use a photo where you're wearing clothes, swimwear or underwear.",
  "sexual/minors": "We can't accept this photo.",
  violence: "This photo seems to show violence. Please choose a different photo.",
  "violence/graphic": "This photo seems to show graphic content. Please choose a different photo.",
  "self-harm": "We can't accept this photo. If you're going through a hard time, please reach out to someone you trust or a local helpline.",
  "self-harm/intent": "We can't accept this photo. If you're going through a hard time, please reach out to someone you trust or a local helpline.",
  "self-harm/instructions": "We can't accept this photo.",
};

export function decide(scores: Record<string, number | undefined>): ModerationDecision {
  for (const [category, limit] of Object.entries(THRESHOLDS)) {
    const score = scores[category];
    if (typeof score === "number" && score >= limit) {
      return { ok: false, category, reason: REASONS[category] ?? "We can't accept this photo." };
    }
  }
  return { ok: true };
}
