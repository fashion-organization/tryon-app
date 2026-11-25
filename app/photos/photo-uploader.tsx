"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prepareImage } from "./prepare-image";

const TIPS = [
  "Your whole body, from head to feet, facing the camera",
  "Standing straight, arms slightly away from your body",
  "Fitted clothes, so your shape is visible",
  "Good, even light and a plain background",
  "Only you in the photo",
];

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string } | { kind: "done" };

export function PhotoUploader({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = status.kind === "busy";

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "busy", text: "Preparing your photo…" });
      const jpeg = await prepareImage(file);

      setStatus({ kind: "busy", text: "Checking and saving…" });
      const body = new FormData();
      body.append("photo", jpeg, "photo.jpg");
      const response = await fetch("/api/photos", { method: "POST", body });
      if (!response.ok) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Something went wrong. Please try again.");
      }
      setStatus({ kind: "done" });
      startTransition(() => router.refresh());
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      if (cameraInput.current) cameraInput.current.value = "";
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a photo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="grid gap-3">
          <p className="text-sm font-medium">A good try-on photo has:</p>
          <ul className="grid gap-1.5 text-sm">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span aria-hidden className="text-primary">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <GoodPhotoExample />

        <div className="grid gap-3 sm:col-span-2">
          {remaining > 0 ? (
            <div className="flex flex-wrap gap-2">
              {/* capture opens the camera directly on phones; on computers it acts like a file picker */}
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <Button type="button" disabled={busy} onClick={() => cameraInput.current?.click()}>
                Take a photo
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
                Choose from your photos
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You have 5 photos, the most you can keep. Delete one to add another.</p>
          )}
          {status.kind === "busy" ? <p role="status" className="text-sm text-muted-foreground">{status.text}</p> : null}
          {status.kind === "done" ? <FormMessage message="Photo added." /> : null}
          {status.kind === "error" ? <FormMessage error={status.text} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** A simple drawing of a good pose: full body, front-facing, arms slightly out. */
function GoodPhotoExample() {
  return (
    <figure className="mx-auto grid justify-items-center gap-1">
      <svg viewBox="0 0 80 140" className="h-36 w-20 rounded-md border bg-muted/50 text-foreground/70" aria-hidden>
        <circle cx="40" cy="20" r="9" fill="currentColor" />
        <path d="M27 35h26l4 42h-6l-3-30v83h-8V92h-0v38h-8V47l-3 30h-6z" fill="currentColor" />
      </svg>
      <figcaption className="text-xs text-muted-foreground">Head to feet, facing you</figcaption>
    </figure>
  );
}
