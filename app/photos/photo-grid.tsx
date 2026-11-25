"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/photos";
import { deletePhoto, setPrimaryPhoto } from "@/lib/photos/actions";

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No photos yet. Add one above to start trying clothes on.</p>;
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Your photos ({photos.length} of 5)</h2>
      <FormMessage error={error} />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((photo) => (
          <li key={photo.id} className="grid gap-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
              {photo.url ? (
                // Private, short-lived signed URL: next/image optimisation would cache it, so use <img>.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="Your photo" className="size-full object-cover" />
              ) : null}
              {photo.isPrimary ? (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  Main photo
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {!photo.isPrimary ? (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setPrimaryPhoto(photo.id))}>
                  Make main
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this photo and its try-on images? This can't be undone.")) {
                    run(() => deletePhoto(photo.id));
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
