import { track } from "@/lib/analytics";
import { getUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Link checkers and crawlers would otherwise count as shoppers.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|slack|discord|telegram|curl|wget|python-requests|headless/i;

/** Added to every shop link, so the shop sees in its own analytics that the visit came from us. */
const TRACKING_PARAMS ={ utm_source: "virtual-tryon", utm_medium: "referral", utm_campaign: "tryon" } as const;

/**
 * "Buy at shop": records the click, then sends the visitor to the product's own buy link with
 * tracking parameters. Only ever redirects to the buy_url stored for that product (https only,
 * checked by the database), so it cannot be used to send people to other sites.
 * ?from=product|tryon and ?job=<try-on id> say where the click came from.
 */
export async function GET(request: Request, { params }: RouteContext<"/go/[productId]">) {
  const { productId } = await params;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!UUID.test(productId)) return new Response("Not found", { status: 404, headers });

  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, slug, buy_url")
    .eq("id", productId)
    .eq("status", "published")
    .maybeSingle();
  if (!product?.buy_url) return new Response("Not found", { status: 404, headers });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const source = from === "product" || from === "tryon" ? from : "other";
  const jobParam = url.searchParams.get("job");

  const userAgent = request.headers.get("user-agent") ?? "";
  const isBot = !userAgent || BOT.test(userAgent);
  // Prefetches by browsers are not clicks either.
  const isPrefetch = /prefetch|prerender/i.test(request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "");

  if (!isBot && !isPrefetch) {
    const user = await getUser();
    // Link the try-on only if it is this user's own.
    let jobId: string | null = null;
    if (user && jobParam && UUID.test(jobParam)) {
      const { data: job } = await admin.from("tryon_jobs").select("id").eq("id", jobParam).eq("user_id", user.id).maybeSingle();
      jobId = job?.id ?? null;
    }
    const { error } = await admin
      .from("buy_clicks")
      .insert({ product_id: product.id, user_id: user?.id ?? null, tryon_job_id: jobId, source });
    if (error) console.error("buy click not recorded:", error.message); // never block the shopper
    track("buy_clicked", user?.id ?? null, { product: product.slug, source, after_tryon: Boolean(jobId) });
  }

  const target = new URL(product.buy_url);
  for (const [k, v] of Object.entries(TRACKING_PARAMS)) {
    if (!target.searchParams.has(k)) target.searchParams.set(k, v);
  }
  return new Response(null, { status: 302, headers: { ...headers, Location: target.toString(), "Referrer-Policy": "origin" } });
}
