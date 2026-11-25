// Versions of the legal texts a user accepts. Stored with each consent row, so we can prove
// which wording someone agreed to. Change the version whenever the text changes.
// The texts are drafts until a lawyer reviews them (Stage 5).
export const TERMS_VERSION = "2026-11-25-draft";
export const PRIVACY_VERSION = "2026-11-25-draft";
export const AGE_VERSION = "2026-11-25";

// Body-photo consent (step 1.5). The services that receive the photo are named in the text.
// If a service changes (e.g. after Stage 0 picks the try-on provider), update this list AND
// the version, so everyone is asked again.
export const BODY_PHOTO_VERSION = "2026-11-25";
export const PHOTO_PROCESSORS = [
  { name: "OpenAI", purpose: "checks each photo is safe before we store it" },
  { name: "FASHN AI", purpose: "creates the try-on images you ask for" },
];
