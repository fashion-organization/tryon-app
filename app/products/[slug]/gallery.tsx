"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) return <div className="aspect-[3/4] rounded-lg border bg-muted" />;

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-white">
        <Image
          src={images[current]}
          alt={`${name}, image ${current + 1} of ${images.length}`}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-contain"
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === current}
              className={cn(
                "relative aspect-[3/4] w-16 overflow-hidden rounded-md border bg-white",
                i === current && "ring-2 ring-primary",
              )}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
