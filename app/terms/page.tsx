import { TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms of use · Virtual try-on" };

// Placeholder. The real text is written and reviewed by a lawyer before strangers are invited (Stage 5).
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-12 text-sm leading-6">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of use</h1>
      <p className="text-muted-foreground">Draft version {TERMS_VERSION}. This site is a test version.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>You must be 18 or older to use this service.</li>
        <li>Upload photos of yourself only, never of other people.</li>
        <li>
          Try-on images are AI-generated previews. They show roughly how an item could look, not exactly how it
          will fit.
        </li>
        <li>Purchases happen on the shop&apos;s own website, under the shop&apos;s terms.</li>
        <li>You can delete your account and all your photos at any time.</li>
      </ul>
    </main>
  );
}
