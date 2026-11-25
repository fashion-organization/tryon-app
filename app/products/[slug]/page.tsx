import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { GARMENT_LABELS, type SizeChart, formatPrice, getProduct } from "@/lib/catalog";
import { CM_PER_INCH } from "@/lib/units";
import { Gallery } from "./gallery";

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Product params={params} />
      </Suspense>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  return { title: product ? `${product.name} · Virtual try-on` : "Not found · Virtual try-on" };
}

async function Product({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Gallery images={product.galleryUrls} name={product.name} />

      <div className="grid content-start gap-5">
        <div className="grid gap-1">
          <Link href={`/catalog?type=${product.garmentType}`} className="text-sm text-muted-foreground hover:underline">
            {GARMENT_LABELS[product.garmentType]}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">Sold by {product.shopName}</p>
          <p className="text-xl">{formatPrice(product.priceCents, product.currency)}</p>
        </div>

        <p className="text-sm leading-6">{product.description}</p>

        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Sizes</h2>
          <ul className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <li key={s} className="rounded-md border px-3 py-1 text-sm">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {/* Step 1.7 turns this into the try-on flow. */}
          <Button disabled className="w-full">
            Try it on (coming soon)
          </Button>
          <a
            href={product.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            Buy at {product.shopName} ↗
          </a>
        </div>
        <p className="text-xs text-muted-foreground">You buy on the shop&apos;s own website.</p>

        {product.sizeChart ? <SizeChartTable chart={product.sizeChart} order={product.sizes} /> : null}
      </div>
    </div>
  );
}

function SizeChartTable({ chart, order }: { chart: SizeChart; order: string[] }) {
  // The database does not keep key order in JSON, so list sizes in the product's own order.
  const sizes = [...order.filter((s) => s in chart.sizes), ...Object.keys(chart.sizes).filter((s) => !order.includes(s))];
  const range = ([min, max]: [number, number]) =>
    `${min}–${max} cm (${Math.round(min / CM_PER_INCH)}–${Math.round(max / CM_PER_INCH)} in)`;
  return (
    <details className="rounded-lg border p-3 text-sm" open>
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
            {sizes.map((size) => [size, chart.sizes[size]] as const).map(([size, values]) => (
              <tr key={size} className="border-t">
                <td className="py-1.5 pr-3 font-medium">{size}</td>
                {chart.measurements.map((m) => (
                  <td key={m} className="whitespace-nowrap py-1.5 pr-3">
                    {values[m] ? range(values[m]) : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <Link href="/account" className="underline underline-offset-2">
          Add your measurements
        </Link>{" "}
        and we&apos;ll suggest a size (coming soon).
      </p>
    </details>
  );
}
