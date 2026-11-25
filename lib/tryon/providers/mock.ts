import type { ProviderStatus, TryOnProvider } from "../provider";

const DELAY_MS = 5_000;

/**
 * For development and tests: no network, no cost. After 5 seconds it "succeeds" with the person
 * photo unchanged (it still gets the AI mark, so the whole pipeline runs).
 * TRYON_MOCK_FAIL=<code> makes every job fail with that code (e.g. PoseError, UnavailableError),
 * to try the error screens.
 */
export const mockProvider: TryOnProvider = {
  name: "mock",

  async submit({ personImageUrl }) {
    // The job id carries everything getStatus needs, since nothing is kept in memory between requests.
    const payload = Buffer.from(JSON.stringify({ t: Date.now(), u: personImageUrl })).toString("base64url");
    return { providerJobId: `mock_${payload}` };
  },

  async getStatus(providerJobId): Promise<ProviderStatus> {
    const { t, u } = JSON.parse(Buffer.from(providerJobId.replace(/^mock_/, ""), "base64url").toString()) as {
      t: number;
      u: string;
    };
    if (Date.now() - t < DELAY_MS) return { status: "processing" };

    const failWith = process.env.TRYON_MOCK_FAIL;
    if (failWith) return { status: "failed", errorCode: failWith, retryable: failWith === "UnavailableError" };
    return { status: "succeeded", outputUrl: u, costCents: 0 };
  },
};
