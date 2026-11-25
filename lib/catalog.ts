import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";

export type GarmentType = "top" | "bottom" | "one_piece";
export type SortOrder = "newest" | "price-asc" | "price-desc";

export const GARMENT_LABELS: Record<GarmentType, string> = { top: "Tops", bottom: "Bottoms", one_piece: "Dresses" };

export type SizeChart = {
  unit: "cm";
  measurements: ("chest" | "waist" | "hips")[];
  sizes: Record<string, Partial<Record<"chest" | "waist" | "hips", [number, number]>>>;
};

export type ProductCard = {
  slug: string;
  name: string;
  shopName: string;
  priceCents: number;
  currency: string;
  garmentType: GarmentType;
  imageUrl: string | null;
};

export type ProductDetail = ProductCard & {
  id: string;
  description: string;
  galleryUrls: string[];
  sizes: string[];
  sizeChart: SizeChart | null;
  buyUrl: string;
};

export type CatalogQuery = { type?: GarmentType; sort: SortOrder; q?: string };

/** The catalog is public, so it is read without the visitor's cookies and cached for a few minutes. */
function publicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function productImageUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${encoded}`;
}

/** Reads ?type=&sort=&q= safely; anything unexpected falls back to the default. */
export function parseCatalogQuery(params: Record<string, string | string[] | undefined>): CatalogQuery {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const type = one(params.type);
  const sort = one(params.sort);
  const q = one(params.q)?.trim().slice(0, 80);
  return {
    type: type === "top" || type === "bottom" || type === "one_piece" ? type : undefined,
    sort: sort === "price-asc" || sort === "price-desc" ? sort : "newest",
    q: q || undefined,
  };
}

export async function getProducts(query: CatalogQuery): Promise<ProductCard[]> {
  "use cache";
  cacheTag("products");
  cacheLife("minutes");

  let request = publicClient()
    .from("products")
    .select("slug, name, shop_name, price_cents, currency, garment_type, tryon_image_path, gallery_paths")
    .eq("status", "published");

  if (query.type) request = request.eq("garment_type", query.type);
  if (query.q) {
    // Escape the LIKE wildcards so a search for "100%" means the text "100%".
    const term = query.q.replace(/[\\%_]/g, (c) => `\\${c}`);
    request = request.ilike("name", `%${term}%`);
  }
  request =
    query.sort === "price-asc"
      ? request.order("price_cents", { ascending: true })
      : query.sort === "price-desc"
        ? request.order("price_cents", { ascending: false })
        : request.order("created_at", { ascending: false });

  const { data, error } = await request.order("slug").limit(200);
  if (error) throw new Error(`Could not load products: ${error.message}`);

  return data.map((p) => ({
    slug: p.slug,
    name: p.name,
    shopName: p.shop_name,
    priceCents: p.price_cents,
    currency: p.currency,
    garmentType: p.garment_type as GarmentType,
    imageUrl: productImageUrl(p.gallery_paths[0] ?? p.tryon_image_path),
  }));
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag("products", `product:${slug}`);
  cacheLife("minutes");

  const { data: p, error } = await publicClient()
    .from("products")
    .select("id, slug, name, shop_name, description, price_cents, currency, garment_type, tryon_image_path, gallery_paths, sizes, size_chart, buy_url")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load product: ${error.message}`);
  if (!p || !p.buy_url) return null;

  const gallery = p.gallery_paths.length ? p.gallery_paths : [p.tryon_image_path];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shopName: p.shop_name,
    description: p.description,
    priceCents: p.price_cents,
    currency: p.currency,
    garmentType: p.garment_type as GarmentType,
    imageUrl: productImageUrl(gallery[0] ?? null),
    galleryUrls: gallery.map(productImageUrl).filter((u): u is string => Boolean(u)),
    sizes: p.sizes,
    sizeChart: isSizeChart(p.size_chart) ? p.size_chart : null,
    buyUrl: p.buy_url,
  };
}

function isSizeChart(value: unknown): value is SizeChart {
  return Boolean(
    value && typeof value === "object" && "sizes" in value && "measurements" in value && (value as SizeChart).unit === "cm",
  );
}

export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
