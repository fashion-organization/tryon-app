import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Account deleted · Virtual try-on", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Your account has been deleted</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Your account, photos, try-on images and measurements are gone from our systems. Copies the try-on service
        made while creating your images are deleted by it within a few days.
      </p>
      <div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
