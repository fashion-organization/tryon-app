"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PhotoChoice = { id: string; url: string | null; isPrimary: boolean };

export function StartTryOn({
  productId,
  photos,
  alreadyTried,
  left,
  limit,
  available,
  expectedSeconds,
}: {
  productId: string;
  photos: PhotoChoice[];
  alreadyTried: string[];
  left: number;
  limit: number;
  available: boolean;
  expectedSeconds: number;
}) {
  const router = useRouter();
  const [photoId, setPhotoId] = useState(photos.find((p) => p.isPrimary)?.id ?? photos[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cached = alreadyTried.includes(photoId);
  const blocked = !available || (!cached && left === 0);

  async function start() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, productId }),
      });
      const body = (await response.json().catch(() => ({}))) as { job?: { id: string }; error?: string };
      if (!response.ok || !body.job) throw new Error(body.error ?? "Something went wrong. Please try again.");
      router.push(`/tryons/${body.job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">Choose a photo of you</legend>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((photo) => {
            const selected = photo.id === photoId;
            return (
              <label
                key={photo.id}
                className={cn(
                  "relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg border-2 bg-muted",
                  selected ? "border-primary" : "border-transparent",
                )}
              >
                <input
                  type="radio"
                  name="photo"
                  value={photo.id}
                  checked={selected}
                  onChange={() => setPhotoId(photo.id)}
                  className="peer sr-only"
                />
                {photo.url ? (
                  // Private signed link: plain <img>, not next/image (which would cache it).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.isPrimary ? "Your main photo" : "Your photo"} className="size-full object-cover" />
                ) : null}
                <span className="pointer-events-none absolute inset-0 rounded-md peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50" />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                    ✓
                  </span>
                ) : null}
                {alreadyTried.includes(photo.id) ? (
                  <span className="absolute inset-x-1.5 bottom-1.5 rounded bg-background/90 px-1 py-0.5 text-center text-[11px]">
                    Tried already
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-2 rounded-lg bg-muted/50 p-4 text-sm">
        {!available ? (
          <p>Try-on isn&apos;t available right now. Please try again later.</p>
        ) : cached ? (
          <p>You&apos;ve tried this item with this photo before. Seeing it again is free and instant.</p>
        ) : left > 0 ? (
          <p>
            This uses 1 of your {limit} free try-ons for today ({left} left). It usually takes about {expectedSeconds} seconds.
          </p>
        ) : (
          <p>You&apos;ve used your {limit} free try-ons for today. Please come back tomorrow. Items you&apos;ve already tried stay free to see.</p>
        )}
        <p className="text-xs text-muted-foreground">
          The result is an AI-generated preview of the look, not of the fit. Check the size chart for fit.
        </p>
      </div>

      <FormMessage error={error} />
      <div className="sm:w-56">
        <Button type="button" className="w-full" size="lg" disabled={busy || blocked} onClick={start}>
          {busy ? "Starting…" : cached ? "See my try-on" : "Try it on"}
        </Button>
      </div>
    </section>
  );
}
