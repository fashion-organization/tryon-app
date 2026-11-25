import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { hasAcceptedTerms, requireUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/paths";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome · Virtual try-on" };

/** Shown once to users who signed up without the sign-up form (e.g. with Google). */
export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <AuthCard title="One more step" description="Before you start, please confirm the following.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser("/welcome", { consent: false });
  if (await hasAcceptedTerms(user.id)) redirect(next);
  return <WelcomeForm next={next} />;
}
