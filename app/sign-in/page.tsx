import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { getUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/paths";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Virtual try-on" };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Please sign in, or ask for a new link.",
  google: "Google sign-in didn't work. Please try again.",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUser()) redirect(next);
  const errorKey = typeof params.error === "string" ? params.error : "";
  return <SignInForm next={next} linkError={ERRORS[errorKey]} />;
}
