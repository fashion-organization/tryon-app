import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { getUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/paths";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create an account · Virtual try-on" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthCard
      title="Create an account"
      description="Try clothes on a photo of yourself before you buy."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="underline underline-offset-2">
            Sign in
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

async function Content({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  if (await getUser()) redirect(next);
  return <SignUpForm next={next} />;
}
