"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import type { JobView } from "@/lib/tryon/jobs";
import type { TryOnDetail } from "@/lib/tryon/queries";
import { rateTryOn } from "@/lib/tryon/actions";
import { cn } from "@/lib/utils";
import { CompareSlider } from "./compare-slider";

const POLL_MS = 2500;

export function TryOnView({
  job: initial,
  expectedSeconds,
  photoUrl,
  product,
  sizeHelp,
}: TryOnDetail & { sizeHelp: ReactNode }) {
  const [job, setJob] = useState<JobView>(initial);

  // Ask the server every 2.5 seconds while the try-on runs.
  useEffect(() => {
    if (job.status !== "processing") return;
    let stopped = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/tryon/${job.id}`, { cache: "no-store" });
        const body = (await response.json()) as { job?: JobView };
        if (!stopped && body.job) setJob(body.job);
        else if (!stopped) setJob((j) => ({ ...j })); // keep polling
      } catch {
        if (!stopped) setJob((j) => ({ ...j })); // network blip: try again
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job]);

  const title = <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>;

  if (job.status === "processing") {
    return (
      <>
        {title}
        <Waiting createdAt={job.createdAt} expectedSeconds={expectedSeconds} photoUrl={photoUrl} />
      </>
    );
  }

  if (job.status === "failed") {
    const kind = job.error?.kind ?? "unknown";
    const next =
      kind === "garment_unusable"
        ? { href: "/catalog", label: "Browse other items" }
        : kind === "photo_unusable" || kind === "safety_blocked"
          ? { href: `/try/${product.slug}`, label: "Choose another photo" }
          : { href: `/try/${product.slug}`, label: "Try again" };
    return (
      <>
        {title}
        <div role="alert" className="grid max-w-lg gap-3 rounded-lg border p-5">
          <p className="font-medium">{job.error?.title ?? "Something went wrong with this try-on."}</p>
          <p className="text-sm text-muted-foreground">{job.error?.action}</p>
          <div>
            <Link href={next.href} className={buttonVariants()}>
              {next.label}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {title}
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        {job.resultUrl ? (
          <CompareSlider resultUrl={job.resultUrl} photoUrl={photoUrl} />
        ) : (
          <p className="text-sm text-muted-foreground">The image link has expired. Reload the page to see it again.</p>
        )}
        <aside className="grid content-start gap-5">
          <p className="text-sm text-muted-foreground">
            An AI-generated preview of the look. Colours and fit may differ from the real item.
          </p>
          <Rating jobId={job.id} initial={job.rating} />
          {sizeHelp}
          <div className="grid gap-2">
            {product.available && product.buyUrl ? (
              <a href={product.buyUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "w-full" })}>
                Buy at {product.shopName} ↗
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">This item is no longer in the shop.</p>
            )}
            {product.available ? (
              <Link href={`/products/${product.slug}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Sizes and size chart
              </Link>
            ) : null}
            <Link href="/catalog" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Try another item
            </Link>
          </div>
          <Link href="/tryons" className="text-sm underline underline-offset-2">
            All my try-ons
          </Link>
        </aside>
      </div>
    </>
  );
}

const STAGES = [
  { from: 0, text: "Sending your photo…" },
  { from: 0.15, text: "Finding your pose…" },
  { from: 0.35, text: "Fitting the garment to you…" },
  { from: 0.7, text: "Adding the finishing touches…" },
  { from: 1.1, text: "Almost there. This one is taking a little longer…" },
];

function Waiting({ createdAt, expectedSeconds, photoUrl }: { createdAt: string; expectedSeconds: number; photoUrl: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, (now - new Date(createdAt).getTime()) / 1000);
  const share = elapsed / expectedSeconds;
  const stage = [...STAGES].reverse().find((s) => share >= s.from) ?? STAGES[0];
  // Moves quickly at first, then slows down and never quite reaches the end before the result.
  const progress = Math.min(95, Math.round(100 * (1 - Math.exp(-1.6 * share))));

  return (
    <div className="grid max-w-md gap-5">
      {photoUrl ? (
        <div className="relative aspect-[3/4] w-48 overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Your photo" className="size-full animate-pulse object-cover opacity-60" />
        </div>
      ) : null}
      <div className="grid gap-2" role="status" aria-live="polite">
        <p className="font-medium">{stage.text}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          Usually about {expectedSeconds} seconds. You can leave this page: your result will be in{" "}
          <Link href="/tryons" className="underline underline-offset-2">
            My try-ons
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Rating({ jobId, initial }: { jobId: string; initial: -1 | 1 | null }) {
  const [rating, setRating] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function rate(value: 1 | -1) {
    const next = rating === value ? null : value;
    const before = rating;
    setRating(next);
    setSaving(true);
    setError(undefined);
    const result = await rateTryOn(jobId, next);
    setSaving(false);
    if (result.error) {
      setRating(before);
      setError(result.error);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Does this look right?</p>
      <div className="flex gap-2">
        {([
          [1, "👍", "Looks good"],
          [-1, "👎", "Doesn't look right"],
        ] as const).map(([value, icon, label]) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            disabled={saving}
            aria-pressed={rating === value}
            onClick={() => rate(value)}
            className={cn("gap-1.5", rating === value && "border-primary bg-primary/10")}
          >
            <span aria-hidden>{icon}</span>
            {label}
          </Button>
        ))}
      </div>
      {rating !== null ? <p className="text-xs text-muted-foreground">Thanks, that helps us improve.</p> : null}
      <FormMessage error={error} />
    </div>
  );
}
