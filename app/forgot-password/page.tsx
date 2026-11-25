"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={
        <Link href="/sign-in" className="underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      <form action={action} className="grid gap-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        <FormMessage error={state.error} message={state.message} />
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </form>
    </AuthCard>
  );
}
