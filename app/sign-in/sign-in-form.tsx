"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Divider, Field, FormMessage, GoogleButton, SubmitButton } from "@/components/auth/form-parts";
import { signIn, type FormState } from "@/lib/auth/actions";

export function SignInForm({ next, linkError }: { next: string; linkError?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});

  return (
    <>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <FormMessage error={state.error ?? linkError} />
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        <Link href="/forgot-password" className="text-center text-sm underline underline-offset-2">
          Forgot your password?
        </Link>
      </form>
      <Divider />
      <GoogleButton next={next} label="Sign in with Google" />
    </>
  );
}
