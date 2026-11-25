import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata = { title: "Check your email · Virtual try-on" };

export default function CheckEmailPage() {
  return (
    <AuthCard
      title="Check your email"
      description="We've sent you a link to confirm your email address."
      footer={
        <Link href="/sign-in" className="underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm">
        Open the email and click the link to finish creating your account. If it hasn&apos;t arrived in a few
        minutes, check your spam folder.
      </p>
    </AuthCard>
  );
}
