"use client";

import { useActionState } from "react";
import { ConsentCheckboxes, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { acceptTerms, type FormState } from "@/lib/auth/actions";

export function WelcomeForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(acceptTerms, {});

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <ConsentCheckboxes />
      <FormMessage error={state.error} />
      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}
