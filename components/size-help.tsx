import Link from "next/link";
import { Suspense } from "react";
import type { SizeChart } from "@/lib/catalog";
import { type SizeHelp, getSizeHelp } from "@/lib/sizing/for-user";
import { type Measurement, formatRange } from "@/lib/sizing/suggest";
import { cn } from "@/lib/utils";

/**
 * Size suggestion plus the size chart. The suggestion depends on who is looking, so it streams in;
 * until then (and for any error) the plain chart shows.
 */
export function SizeHelpSection({ chart, order, returnTo }: { chart: SizeChart; order: string[]; returnTo: string }) {
  return (
    <Suspense fallback={<SizeChartTable chart={chart} order={order} />}>
      <WithSuggestion chart={chart} order={order} returnTo={returnTo} />
    </Suspense>
  );
}

async function WithSuggestion({ chart, order, returnTo }: { chart: SizeChart; order: string[]; returnTo: string }) {
  const help = await getSizeHelp(chart, order);
  return (
    <div className="grid min-w-0 gap-3">
      <SuggestionBox help={help} returnTo={returnTo} />
      <SizeChartTable chart={chart} order={order} highlight={help.suggestion?.size ?? undefined} />
    </div>
  );
}

export function SuggestionBox({ help, returnTo }: { help: SizeHelp; returnTo: string }) {
  const { suggestion, missing, signedIn } = help;

  if (!signedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/sign-in?next=${encodeURIComponent(returnTo)}`} className="underline underline-offset-2">
          Sign in
        </Link>{" "}
        and add your measurements, and we&apos;ll suggest a size.
      </p>
    );
  }

  if (!suggestion) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href="/account" className="underline underline-offset-2">
          Add your {list(missing)}
        </Link>{" "}
        and we&apos;ll suggest a size.
      </p>
    );
  }

  return (
    <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm" role="status">
      <p className="font-medium">
        {suggestion.size ? `Suggested size: ${suggestion.size}` : "We can't suggest a size for this item"}
      </p>
      <p className="text-muted-foreground">{suggestion.reason}</p>
      {missing.length ? (
        <p className="text-muted-foreground">
          <Link href="/account" className="underline underline-offset-2">
            Add your {list(missing)}
          </Link>{" "}
          for a better match.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">Based on the shop&apos;s size chart and your measurements, not on the photo.</p>
    </div>
  );
}

function list(items: Measurement[]): string {
  if (items.length <= 1) return items[0] ?? "measurements";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function SizeChartTable({ chart, order, highlight }: { chart: SizeChart; order: string[]; highlight?: string }) {
  // The database does not keep key order in JSON, so list sizes in the product's own order.
  const sizes = [...order.filter((s) => s in chart.sizes), ...Object.keys(chart.sizes).filter((s) => !order.includes(s))];
  // Same rounding as the suggestion's reason, so the two always agree.
  const range = (r: [number, number]) => `${formatRange(r, "metric")} (${formatRange(r, "imperial")})`;
  return (
    <details className="min-w-0 rounded-lg border p-3 text-sm" open>
      <summary className="cursor-pointer font-medium">Size chart (body measurements)</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">Size</th>
              {chart.measurements.map((m) => (
                <th key={m} className="py-1 pr-3 font-normal capitalize">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size) => (
              <tr key={size} className={cn("border-t", size === highlight && "bg-primary/10 font-medium")}>
                <td className="py-1.5 pr-3 font-medium">
                  {size}
                  {size === highlight ? <span className="sr-only"> (suggested)</span> : null}
                </td>
                {chart.measurements.map((m) => {
                  const value = chart.sizes[size][m];
                  return (
                    <td key={m} className="whitespace-nowrap py-1.5 pr-3">
                      {value ? range(value) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
