import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/dal";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Virtual try-on
        </Link>
        {/* Reads the session, so it streams in; the rest of the header is static. */}
        <Suspense fallback={<span className="h-8 w-20" />}>
          <UserLink />
        </Suspense>
      </div>
    </header>
  );
}

async function UserLink() {
  const user = await getUser();
  return user ? (
    <nav className="flex gap-1">
      <Link href="/photos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        My photos
      </Link>
      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Account
      </Link>
    </nav>
  ) : (
    <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
      Sign in
    </Link>
  );
}
