import { getUser } from "@/lib/auth/dal";
import { pollTryOn } from "@/lib/tryon/jobs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

/** The state of one of the user's try-ons. The browser asks every 2-3 seconds while it runs. */
export async function GET(_request: Request, { params }: RouteContext<"/api/tryon/[id]">) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401, headers: noStore });

  const { id } = await params;
  const job = UUID.test(id) ? await pollTryOn(user.id, id) : null;
  if (!job) return Response.json({ error: "Try-on not found." }, { status: 404, headers: noStore });
  return Response.json({ job }, { headers: noStore });
}
