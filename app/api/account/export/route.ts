import { createExport } from "@/lib/account/export";
import { getUser } from "@/lib/auth/dal";

const noStore = { "Cache-Control": "no-store" };

/** "Download my data": builds the ZIP and answers with a 10-minute download link. */
export async function POST(request: Request) {
  // JSON only: browsers must ask permission (CORS) before sending JSON from another site.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Please send JSON." }, { status: 415, headers: noStore });
  }
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401, headers: noStore });

  try {
    const url = await createExport(user);
    return Response.json({ url }, { headers: noStore });
  } catch (e) {
    console.error(`export failed for ${user.id}:`, (e as Error).message);
    return Response.json({ error: "Your download couldn't be prepared. Please try again." }, { status: 500, headers: noStore });
  }
}
