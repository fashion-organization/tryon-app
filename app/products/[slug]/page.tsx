import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SizeHelpSection } from "@/components/size-help";
import { GARMENT_LABELS, formatPrice, getProduct } from "@/lib/catalog";
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

  // minmax(0,1fr) and min-w-0 let wide content (the size chart) scroll inside its box
  // instead of widening the page on phones.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2">
      <Gallery images={product.galleryUrls} name={product.name} />

      <div className="grid min-w-0 content-start gap-5">
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
          {/* Signed-out visitors are sent to sign-in and come back here. */}
          <Link href={`/try/${product.slug}`} className={buttonVariants({ className: "w-full" })}>
            Try it on
          </Link>
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

        {product.sizeChart ? (
          <SizeHelpSection chart={product.sizeChart} order={product.sizes} returnTo={`/products/${product.slug}`} />
        ) : null}
      </div>
    </div>
  );
}
