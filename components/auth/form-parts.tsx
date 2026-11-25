"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithGoogle } from "@/lib/auth/actions";

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
        {message}
      </p>
    );
  }
  return null;
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<typeof Input> & { name: string }) {
  const id = `field-${input.name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** The two checkboxes every account must accept: 18+ and terms + privacy. */
export function ConsentCheckboxes() {
  return (
    <div className="grid gap-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="adult" required className="mt-0.5 size-4 accent-primary" />
        <span>I am 18 or older.</span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-primary" />
        <span>
          I accept the{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2">
            terms of use
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </span>
      </label>
    </div>
  );
}

export function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <GoogleSubmit label={label} />
    </form>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? "Opening Google…" : label}
    </Button>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
