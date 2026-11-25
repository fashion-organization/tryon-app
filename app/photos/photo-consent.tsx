"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PHOTO_PROCESSORS } from "@/lib/legal";
import { acceptPhotoConsent, type PhotoActionState } from "@/lib/photos/actions";

export function PhotoConsent() {
  const [state, action] = useActionState<PhotoActionState, FormData>(acceptPhotoConsent, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before you add a photo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6">
        <ul className="list-disc space-y-2 pl-5">
          <li>We use your photo only to show you how clothes could look on you.</li>
          <li>
            Your photo is private. Nobody else can see it. To do the job, it is sent to these services:
            <ul className="mt-1 list-[circle] space-y-1 pl-5">
              {PHOTO_PROCESSORS.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>, which {p.purpose}
                </li>
              ))}
            </ul>
          </li>
          <li>We don&apos;t measure your face or body from your photos.</li>
          <li>You can delete any photo at any time. Its try-on images are deleted with it.</li>
          <li>
            <strong>Photos of yourself only.</strong> Never upload a photo of someone else.
          </li>
        </ul>
        <p>
          More in our{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
        <form action={action} className="grid gap-4">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consent" required className="mt-1 size-4 accent-primary" />
            <span>I agree that my photos are processed as described above, and I will upload photos of myself only.</span>
          </label>
          <FormMessage error={state.error} />
          <div className="sm:w-48">
            <SubmitButton pendingText="Saving…">I agree</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
