import { getUser, hasAcceptedTerms } from "@/lib/auth/dal";
import { hasPhotoConsent } from "@/lib/photos";
import { startTryOn } from "@/lib/tryon/jobs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore });

/**
 * Start a try-on: body { photoId, productId }.
 * 200 with { job } when the result already exists (no new charge) or the job ended at once;
 * 202 with { job } while it runs (poll GET /api/tryon/<job.id>); 4xx/5xx with { error } otherwise.
 */
export async function POST(request: Request) {
  // JSON only: browsers must ask permission (CORS) before sending JSON from another site.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "Please send JSON.");
  }

  const user = await getUser();
  if (!user) return fail(401, "Please sign in again.");
  const [adult, photoConsent] = await Promise.all([hasAcceptedTerms(user.id), hasPhotoConsent(user.id)]);
  if (!adult) return fail(403, "Please confirm you are 18 or older first.");
  if (!photoConsent) return fail(403, "Please accept the photo consent first.");

  let photoId: unknown, productId: unknown;
  try {
    ({ photoId, productId } = await request.json());
  } catch {
    return fail(400, "The request didn't arrive. Please try again.");
  }
  if (typeof photoId !== "string" || !UUID.test(photoId) || typeof productId !== "string" || !UUID.test(productId)) {
    return fail(400, "Please choose a photo and an item.");
  }

  const result = await startTryOn(user.id, photoId, productId);
  if (!result.ok) return fail(result.status, result.error);
  return Response.json({ job: result.job }, { status: result.job.status === "processing" ? 202 : 200, headers: noStore });
}
