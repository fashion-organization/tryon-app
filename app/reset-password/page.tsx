import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { requireUser } from "@/lib/auth/dal";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password · Virtual try-on" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </AuthCard>
  );
}

async function Content() {
  // The reset link signs the user in; the 18+ check is skipped so anyone can recover access.
  await requireUser("/reset-password", { consent: false });
  return <ResetPasswordForm />;
}
