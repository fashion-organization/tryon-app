import { timingSafeEqual } from "node:crypto";
import { removeOldExports } from "@/lib/account/export";
import { sweepStuckJobs } from "@/lib/tryon/jobs";

/**
 * Fails try-on jobs stuck for more than 3 minutes and deletes data exports older than a day.
 * Called by Vercel Cron (vercel.json), which sends
 * "Authorization: Bearer <CRON_SECRET>". The polling route and new requests also end stuck jobs,
 * so this is a backstop for jobs nobody is watching.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const failed = await sweepStuckJobs();
  if (failed) console.warn(`cron sweep: ${failed} stuck try-on job(s) marked failed`);
  const exportsRemoved = await removeOldExports();
  return Response.json({ ok: true, failed, exportsRemoved }, { headers: { "Cache-Control": "no-store" } });
}
