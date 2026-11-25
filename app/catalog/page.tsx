import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GARMENT_LABELS, type CatalogQuery, type GarmentType, getProducts, parseCatalogQuery } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shop · Virtual try-on" };

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export default function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Shop</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading products…</p>}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/catalog">["searchParams"] }) {
  const query = parseCatalogQuery(await searchParams);
  const products = await getProducts(query);

  return (
    <>
      <Filters query={query} />
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products match.{" "}
          <Link href="/catalog" className="underline underline-offset-2">
            Show everything
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <li key={p.slug}>
              <ProductCard product={p} priority={i < 4} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function href(query: CatalogQuery, change: Partial<CatalogQuery>): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.type) params.set("type", next.type);
  if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
  if (next.q) params.set("q", next.q);
  const s = params.toString();
  return s ? `/catalog?${s}` : "/catalog";
}

/** Plain links and a GET form, so filters work without JavaScript and every view has a URL. */
function Filters({ query }: { query: CatalogQuery }) {
  const types: (GarmentType | undefined)[] = [undefined, "top", "bottom", "one_piece"];
  return (
    <div className="grid gap-3">
      <nav aria-label="Garment type" className="flex flex-wrap gap-2">
        {types.map((t) => (
          <Link
            key={t ?? "all"}
            href={href(query, { type: t })}
            aria-current={query.type === t ? "page" : undefined}
            className={cn(buttonVariants({ variant: query.type === t ? "default" : "outline", size: "sm" }))}
          >
            {t ? GARMENT_LABELS[t] : "All"}
          </Link>
        ))}
      </nav>
      <form action="/catalog" className="flex flex-wrap items-center gap-2">
        {query.type ? <input type="hidden" name="type" value={query.type} /> : null}
        <Input name="q" type="search" placeholder="Search products" defaultValue={query.q} className="w-full sm:w-64" aria-label="Search products" />
        <select
          name="sort"
          defaultValue={query.sort}
          aria-label="Sort"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Apply
        </button>
      </form>
    </div>
  );
}
