// Step 1.2 "done when" check: user A cannot read user B's rows or files.
// Runs against the project in .env.local (the DEV project). Creates two throw-away users,
// a product, photos, try-on rows and files, checks access as each user, then deletes it all.
//
//   npm run test:rls

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
  console.error("Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, noSession);
const run = randomBytes(4).toString("hex");
const jpeg = new Blob([Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex")], { type: "image/jpeg" });

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
}
function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function makeUser(label) {
  const email = `rls-test-${run}-${label}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `create user ${label}`).user;
  const client = createClient(url, publishableKey, noSession);
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  return { id: user.id, client };
}

const created = { users: [], productId: null, files: [] };

try {
  const A = await makeUser("a");
  created.users.push(A.id);
  const B = await makeUser("b");
  created.users.push(B.id);

  // Server-side setup with the secret key, as the real app will do it.
  const product = must(
    await admin.from("products").insert({
      slug: `rls-test-${run}`, shop_name: "Test", name: "RLS test tee", price_cents: 100, garment_type: "top",
      tryon_image_path: "test/none.jpg", buy_url: "https://example.com", status: "published",
    }).select("id").single(),
    "create product",
  );
  created.productId = product.id;

  for (const u of [A, B]) {
    const photoId = randomUUID();
    const photoPath = `${u.id}/${photoId}.jpg`;
    const resultPath = `${u.id}/${randomUUID()}.jpg`;
    must(await admin.storage.from("user-photos").upload(photoPath, jpeg), "upload photo");
    must(await admin.storage.from("tryon-results").upload(resultPath, jpeg), "upload result");
    created.files.push(["user-photos", photoPath], ["tryon-results", resultPath]);
    must(await admin.from("user_photos").insert({ id: photoId, user_id: u.id, storage_path: photoPath, status: "ready" }), "photo row");
    must(await admin.from("consents").insert({ user_id: u.id, type: "terms", version: "test" }), "consent row");
    must(await admin.from("tryon_jobs").insert({
      user_id: u.id, photo_id: photoId, product_id: product.id, provider: "mock", status: "done", result_path: resultPath,
    }), "job row");
    u.photoPath = photoPath;
    u.resultPath = resultPath;
  }

  // Rows
  for (const table of ["profiles", "consents", "user_photos", "tryon_jobs"]) {
    const own = table === "profiles" ? "id" : "user_id";
    const { data, error } = await A.client.from(table).select(own);
    const ids = (data ?? []).map((r) => r[own]);
    check(`A reads own ${table}`, !error && ids.includes(A.id), error?.message);
    check(`A cannot read B's ${table}`, !error && !ids.includes(B.id), error?.message);
  }

  // Changes A must not be able to make
  {
    const { error } = await A.client.from("profiles").update({ role: "admin" }).eq("id", A.id);
    check("A cannot make themselves admin", !!error);
  }
  {
    const { data } = await A.client.from("profiles").update({ display_name: "hacked" }).eq("id", B.id).select();
    check("A cannot edit B's profile", (data ?? []).length === 0);
  }
  {
    const { error } = await A.client.from("user_photos").update({ status: "ready" }).eq("user_id", A.id);
    check("A cannot approve their own photo", !!error);
  }
  {
    const { error } = await A.client.from("tryon_jobs").insert({
      user_id: A.id, photo_id: randomUUID(), product_id: product.id, provider: "mock",
    });
    check("A cannot create a try-on job (costs money)", !!error);
  }
  {
    const { error } = await A.client.rpc("start_tryon_job", {
      p_user_id: A.id, p_photo_id: randomUUID(), p_product_id: product.id, p_provider: "mock", p_user_limit: 999, p_global_cap: 999,
    });
    check("A cannot start a try-on job past the limits", !!error);
  }
  {
    const read = await A.client.from("buy_clicks").select("id").limit(1);
    const write = await A.client.from("buy_clicks").insert({ product_id: product.id, source: "product" });
    check("A cannot read or add buy clicks", !!read.error && !!write.error);
  }
  {
    const { data, error } = await A.client.from("tryon_jobs").update({ rating: 1 }).eq("user_id", A.id).select("id");
    check("A can rate own try-on", !error && (data ?? []).length === 1, error?.message);
  }

  // Files
  for (const [bucket, key] of [["user-photos", "photoPath"], ["tryon-results", "resultPath"]]) {
    const own = await A.client.storage.from(bucket).download(A[key]);
    check(`A downloads own file in ${bucket}`, !own.error, own.error?.message);
    const other = await A.client.storage.from(bucket).download(B[key]);
    check(`A cannot download B's file in ${bucket}`, !!other.error);
    const signed = await A.client.storage.from(bucket).createSignedUrl(B[key], 60);
    check(`A cannot make a link to B's file in ${bucket}`, !!signed.error);
    const list = await A.client.storage.from(bucket).list(B.id);
    check(`A cannot list B's folder in ${bucket}`, (list.data ?? []).length === 0);
  }
  {
    const { error } = await A.client.storage.from("user-photos").upload(`${A.id}/direct.jpg`, jpeg);
    check("A cannot upload a photo directly (must go through moderation)", !!error);
    if (!error) created.files.push(["user-photos", `${A.id}/direct.jpg`]);
  }

  // Signed-out visitor
  const anon = createClient(url, publishableKey, noSession);
  {
    const { data } = await anon.from("profiles").select("id");
    check("signed-out visitor reads no profiles", (data ?? []).length === 0);
    const products = await anon.from("products").select("id").eq("id", product.id);
    check("signed-out visitor reads published products", (products.data ?? []).length === 1, products.error?.message);
    const file = await anon.storage.from("user-photos").download(A.photoPath);
    check("signed-out visitor cannot download photos", !!file.error);
  }
} catch (e) {
  fail++;
  console.log("FAIL  setup:", e.message);
} finally {
  for (const [bucket, path] of created.files) await admin.storage.from(bucket).remove([path]);
  for (const id of created.users) await admin.auth.admin.deleteUser(id); // cascades to all their rows
  if (created.productId) await admin.from("products").delete().eq("id", created.productId);
  console.log(`\n${pass} passed, ${fail} failed (test users and files removed)`);
  process.exitCode = fail ? 1 : 0;
}
