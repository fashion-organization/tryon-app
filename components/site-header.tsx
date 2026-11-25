import { UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/dal";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="whitespace-nowrap font-semibold tracking-tight">
            Virtual try-on
          </Link>
          <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">
            Shop
          </Link>
        </div>
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
    <nav className="flex gap-0.5 sm:gap-1">
      <Link href="/tryons" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Try-ons
      </Link>
      <Link href="/photos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Photos
      </Link>
      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {/* On phones an icon, so the header fits on one line. */}
        <UserRound aria-hidden className="sm:hidden" />
        <span className="max-sm:sr-only">Account</span>
      </Link>
    </nav>
  ) : (
    <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
      Sign in
    </Link>
  );
}
