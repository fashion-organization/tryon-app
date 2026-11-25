"use client";

import { type PointerEvent, useState } from "react";

/**
 * The try-on result with the original photo laid over it, cut at the slider. Dragging anywhere on
 * the image (finger or mouse) or the arrow keys (hidden range input) moves the cut. Vertical
 * swipes still scroll the page. Without the original photo it shows the result alone.
 */
export function CompareSlider({ resultUrl, photoUrl }: { resultUrl: string; photoUrl: string | null }) {
  const [split, setSplit] = useState(50);
  const [ratio, setRatio] = useState(3 / 4);
  const [dragging, setDragging] = useState(false);

  function moveTo(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setSplit(Math.round(Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100))));
  }

  return (
    <figure className="grid gap-2">
      <div
        className="relative mx-auto w-full max-w-md cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: ratio }}
        onPointerDown={(e) => {
          if (!photoUrl) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          moveTo(e);
        }}
        onPointerMove={(e) => dragging && moveTo(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {/* Private signed links: plain <img>, not next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resultUrl}
          alt="You wearing the item (AI-generated preview)"
          className="absolute inset-0 size-full object-cover"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) setRatio(w / h);
          }}
          draggable={false}
        />
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
              // The photo covers the right side, so the try-on's "AI-generated preview" mark
              // (bottom-left) always stays visible on the generated part.
              style={{ clipPath: `inset(0 0 0 ${split}%)` }}
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]" style={{ left: `${split}%` }}>
              <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm text-black shadow">
                ⇔
              </span>
            </div>
            <span className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">AI try-on</span>
            <span className="pointer-events-none absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Your photo</span>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="Compare your photo with the try-on"
              className="peer sr-only"
            />
            <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:ring-3 peer-focus-visible:ring-ring" />
          </>
        ) : null}
      </div>
      {photoUrl ? (
        <figcaption className="text-center text-xs text-muted-foreground">Drag to compare with your photo</figcaption>
      ) : null}
    </figure>
  );
}
