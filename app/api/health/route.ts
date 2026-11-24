import { connection } from "next/server";

// Used to check a deployment is live and running the expected commit.
// Vercel sets VERCEL_GIT_COMMIT_SHA and VERCEL_ENV on its builds; locally they are absent.
export async function GET() {
  await connection(); // answer per request, never from a prerendered copy

  return Response.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      env: process.env.VERCEL_ENV ?? "development",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
