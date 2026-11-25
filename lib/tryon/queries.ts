import "server-only";

import { productImageUrl } from "@/lib/catalog";
import { PHOTO_BUCKET, RESULT_BUCKET } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProvider, tryOnLimits } from "./index";
import { type JobView, pollTryOn } from "./jobs";

/** Rough wait per provider, for the progress bar. Replace with Stage 0's measured median. */
const EXPECTED_SECONDS: Record<string, number> = { mock: 6, "fashn-v1.6": 20, "fashn-max": 15 };

export function expectedSeconds(provider?: string): number {
  return EXPECTED_SECONDS[provider ?? getProvider()?.name ?? ""] ?? 20;
}

/** New try-ons the user has left in the current 24 hours. Failed ones don't count. */
export async function getAllowance(userId: string): Promise<{ used: number; limit: number; left: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await createAdminClient()
    .from("tryon_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "failed")
    .gt("created_at", since);
  const limit = tryOnLimits().perUser;
  const used = count ?? 0;
  return { used, limit, left: Math.max(0, limit - used) };
}

/** Photos that already have a finished try-on of this product (those are free to see again). */
export async function photosAlreadyTried(userId: string, productId: string): Promise<string[]> {
  const provider = getProvider();
  if (!provider) return [];
  const { data } = await createAdminClient()
    .from("tryon_jobs")
    .select("photo_id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("provider", provider.name)
    .eq("status", "done");
  return (data ?? []).map((r) => r.photo_id);
}

export type TryOnDetail = {
  job: JobView;
  expectedSeconds: number;
  photoUrl: string | null;
  product: { slug: string; name: string; shopName: string; buyUrl: string | null; imageUrl: string | null; available: boolean };
};

/** Everything the result page needs. Null if the try-on isn't this user's. */
export async function getTryOnDetail(userId: string, jobId: string): Promise<TryOnDetail | null> {
  const job = await pollTryOn(userId, jobId);
  if (!job) return null;

  const admin = createAdminClient();
  const [{ data: product }, { data: photo }, { data: row }] = await Promise.all([
    admin.from("products").select("slug, name, shop_name, buy_url, status, gallery_paths, tryon_image_path").eq("id", job.productId).single(),
    admin.from("user_photos").select("storage_path").eq("id", job.photoId).maybeSingle(),
    admin.from("tryon_jobs").select("provider").eq("id", jobId).single(),
  ]);
  if (!product) return null;

  const supabase = await createClient();
  const signed = photo ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.storage_path, 60 * 60) : null;

  return {
    job,
    expectedSeconds: expectedSeconds(row?.provider),
    photoUrl: signed?.data?.signedUrl ?? null,
    product: {
      slug: product.slug,
      name: product.name,
      shopName: product.shop_name,
      buyUrl: product.buy_url,
      imageUrl: productImageUrl(product.gallery_paths[0] ?? product.tryon_image_path),
      available: product.status === "published",
    },
  };
}

export type TryOnListItem = {
  id: string;
  status: "processing" | "done" | "failed";
  createdAt: string;
  resultUrl: string | null;
  productName: string;
};

/** The user's try-ons, newest first. Read with the user's own rights (row-level security). */
export async function listTryOns(userId: string): Promise<TryOnListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tryon_jobs")
    .select("id, status, created_at, result_path, product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`Could not load try-ons: ${error.message}`);
  if (data.length === 0) return [];

  // Product names via the admin client: an item taken out of the shop still shows its name here.
  const productIds = [...new Set(data.map((j) => j.product_id))];
  const paths = data.map((j) => j.result_path).filter((p): p is string => Boolean(p));
  const [{ data: products }, { data: signed }] = await Promise.all([
    createAdminClient().from("products").select("id, name").in("id", productIds),
    paths.length ? supabase.storage.from(RESULT_BUCKET).createSignedUrls(paths, 60 * 60) : Promise.resolve({ data: [] }),
  ]);
  const nameById = new Map((products ?? []).map((p) => [p.id, p.name]));
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return data.map((j) => ({
    id: j.id,
    status: j.status === "done" ? "done" : j.status === "failed" ? "failed" : "processing",
    createdAt: j.created_at,
    resultUrl: j.result_path ? (urlByPath.get(j.result_path) ?? null) : null,
    productName: nameById.get(j.product_id) ?? "Item",
  }));
}
