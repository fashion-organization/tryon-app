"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { updatePassword, type FormState } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="At least 8 characters."
      />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
