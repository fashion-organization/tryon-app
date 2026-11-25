import { PRIVACY_VERSION } from "@/lib/legal";

export const metadata = { title: "Privacy policy · Virtual try-on" };

// Placeholder. The real text is written and reviewed by a lawyer before strangers are invited (Stage 5).
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-12 text-sm leading-6">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="text-muted-foreground">Draft version {PRIVACY_VERSION}. This site is a test version.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>We store your email, the measurements you choose to enter, and the photos you upload.</li>
        <li>
          Your photos are private. They are sent to our AI try-on provider only to create the try-on images you
          ask for. We ask for your separate consent before your first upload.
        </li>
        <li>We do not measure your face or body from your photos.</li>
        <li>When you delete your account, your photos and try-on images are removed within 24 hours.</li>
        <li>Analytics run only if you accept them.</li>
      </ul>
    </main>
  );
}
