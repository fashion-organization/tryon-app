import type { GarmentType } from "@/lib/catalog";

/**
 * Everything vendor-specific sits behind this interface (AI roadmap §2). The app only calls
 * `submit` and `getStatus`; TRYON_PROVIDER picks the implementation.
 */
export interface TryOnProvider {
  /** Stored on every job, so the cache never mixes results from different providers or models. */
  readonly name: string;

  submit(input: {
    personImageUrl: string; // short-lived signed URL
    garmentImageUrl: string;
    garmentType: GarmentType;
  }): Promise<{ providerJobId: string }>;

  getStatus(providerJobId: string): Promise<ProviderStatus>;
}

export type ProviderStatus =
  | { status: "processing" }
  | { status: "succeeded"; outputUrl: string; costCents?: number }
  | { status: "failed"; errorCode: string; retryable: boolean };

/** A provider refused or could not take a request. `code` is the provider's own error name. */
export class ProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
