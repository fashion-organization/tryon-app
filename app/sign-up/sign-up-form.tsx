"use client";

import { useActionState } from "react";
import { ConsentCheckboxes, Divider, Field, FormMessage, GoogleButton, SubmitButton } from "@/components/auth/form-parts";
import { signUp, type FormState } from "@/lib/auth/actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  return (
    <>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters."
        />
        <ConsentCheckboxes />
        <FormMessage error={state.error} />
        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </form>
      <Divider />
      <GoogleButton next={next} label="Continue with Google" />
      <p className="text-xs text-muted-foreground">
        With Google, we ask you to confirm your age and accept the terms right after.
      </p>
    </>
  );
}
