"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DeleteState, deleteAccount } from "@/lib/account/actions";

export function DownloadData() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);

  async function download() {
    setBusy(true);
    setError(undefined);
    setReady(false);
    try {
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Your download couldn't be prepared. Please try again.");
      window.location.assign(body.url); // the link downloads the ZIP; it works for 10 minutes
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        A ZIP file with your profile and measurements, what you agreed to, your photos, your try-on images and
        your shop clicks.
      </p>
      <div>
        <Button type="button" variant="outline" disabled={busy} onClick={download}>
          {busy ? "Preparing your download…" : "Download my data"}
        </Button>
      </div>
      {ready ? <FormMessage message="Your download has started." /> : null}
      <FormMessage error={error} />
    </div>
  );
}

export function DeleteAccount() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === "DELETE";

  return (
    <form action={action} className="grid gap-3 text-sm">
      <p>This permanently deletes, straight away:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>your account and sign-in,</li>
        <li>your profile and measurements,</li>
        <li>all your photos and try-on images,</li>
        <li>your try-on history and ratings.</li>
      </ul>
      <p className="text-muted-foreground">
        It can&apos;t be undone. If you might want your photos or try-ons later, download your data first. Counts of
        shop clicks are kept without anything that links them to you.
      </p>
      <label className="grid gap-1.5">
        <span>
          Type <strong>DELETE</strong> to confirm
        </span>
        <Input
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="sm:w-64"
        />
      </label>
      <FormMessage error={state.error} />
      <div>
        <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
