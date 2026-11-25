// Seeds the catalog with placeholder products. Safe to run again: products are matched by slug
// and updated, images are overwritten. Garment images are simple drawings made here, so there
// are no licence questions; they are for building the pages, not for judging try-on quality.
// Replace with real products (with the shop's permission) when you have them.
//
//   npm run seed           (uses the project in .env.local)

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const admin = createClient(url, secret, { auth: { persistSession: false } });
const BUCKET = "product-images";
const SHOP = "Sample Shop";

// ---- Size charts (cm, inclusive ranges). Used by the size suggestion in step 1.9. ----
const TOP_CHART = {
  unit: "cm",
  measurements: ["chest", "waist"],
  sizes: {
    XS: { chest: [80, 85], waist: [64, 69] },
    S: { chest: [86, 91], waist: [70, 75] },
    M: { chest: [92, 99], waist: [76, 83] },
    L: { chest: [100, 107], waist: [84, 91] },
    XL: { chest: [108, 115], waist: [92, 99] },
  },
};
const BOTTOM_CHART = {
  unit: "cm",
  measurements: ["waist", "hips"],
  sizes: {
    XS: { waist: [62, 67], hips: [84, 89] },
    S: { waist: [68, 73], hips: [90, 95] },
    M: { waist: [74, 81], hips: [96, 103] },
    L: { waist: [82, 89], hips: [104, 111] },
    XL: { waist: [90, 97], hips: [112, 119] },
  },
};
const DRESS_CHART = {
  unit: "cm",
  measurements: ["chest", "waist", "hips"],
  sizes: {
    XS: { chest: [78, 82], waist: [60, 64], hips: [84, 88] },
    S: { chest: [83, 87], waist: [65, 69], hips: [89, 93] },
    M: { chest: [88, 93], waist: [70, 75], hips: [94, 99] },
    L: { chest: [94, 100], waist: [76, 82], hips: [100, 106] },
    XL: { chest: [101, 108], waist: [83, 90], hips: [107, 114] },
  },
};
const SIZES = ["XS", "S", "M", "L", "XL"];

// ---- Garment drawings (768 x 1024, white background, front view) ----
const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * amount))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const SHAPES = {
  tee: (c) => `<path d="M254 200 L324 170 Q384 215 444 170 L514 200 L612 290 L560 360 L508 318 L508 660 L260 660 L260 318 L208 360 L156 290 Z" fill="${c}"/>
    <path d="M324 170 Q384 230 444 170" fill="none" stroke="${shade(c, 0.75)}" stroke-width="10"/>`,
  longsleeve: (c) => `<path d="M254 200 L324 170 Q384 215 444 170 L514 200 L600 330 L620 600 L562 612 L536 380 L508 330 L508 660 L260 660 L260 330 L232 380 L206 612 L148 600 L168 330 Z" fill="${c}"/>
    <path d="M324 170 Q384 230 444 170" fill="none" stroke="${shade(c, 0.75)}" stroke-width="10"/>`,
  tank: (c) => `<path d="M300 170 L340 170 Q384 290 428 170 L468 170 Q480 280 540 320 L540 650 L228 650 L228 320 Q288 280 300 170 Z" fill="${c}"/>`,
  hoodie: (c) => `<path d="M244 220 L314 170 Q384 120 454 170 L524 220 L606 340 L624 620 L566 632 L540 390 L518 350 L518 690 L250 690 L250 350 L228 390 L202 632 L144 620 L162 340 Z" fill="${c}"/>
    <path d="M314 170 Q384 330 454 170" fill="${shade(c, 0.8)}"/>
    <rect x="300" y="540" width="168" height="100" rx="20" fill="${shade(c, 0.85)}"/>`,
  shirt: (c) => `<path d="M254 200 L334 160 L384 210 L434 160 L514 200 L600 330 L620 600 L562 612 L536 380 L508 330 L508 700 L260 700 L260 330 L232 380 L206 612 L148 600 L168 330 Z" fill="${c}"/>
    <path d="M334 160 L384 250 L434 160" fill="none" stroke="${shade(c, 0.7)}" stroke-width="8"/>
    <line x1="384" y1="250" x2="384" y2="700" stroke="${shade(c, 0.7)}" stroke-width="4"/>
    ${[310, 390, 470, 550, 630].map((y) => `<circle cx="384" cy="${y}" r="7" fill="${shade(c, 0.6)}"/>`).join("")}`,
  jeans: (c) => `<path d="M256 150 L512 150 L540 880 L414 880 L384 380 L354 880 L228 880 Z" fill="${c}"/>
    <rect x="256" y="150" width="256" height="40" fill="${shade(c, 0.8)}"/>
    <path d="M300 190 Q310 260 260 270 M468 190 Q458 260 508 270" fill="none" stroke="${shade(c, 0.7)}" stroke-width="5"/>`,
  shorts: (c) => `<path d="M256 250 L512 250 L548 620 L412 640 L384 450 L356 640 L220 620 Z" fill="${c}"/>
    <rect x="256" y="250" width="256" height="40" fill="${shade(c, 0.8)}"/>`,
  skirt: (c) => `<path d="M290 250 L478 250 L590 760 L178 760 Z" fill="${c}"/>
    <rect x="290" y="250" width="188" height="36" fill="${shade(c, 0.8)}"/>`,
  dress: (c) => `<path d="M310 150 L350 150 Q384 220 418 150 L458 150 Q466 250 500 300 L478 420 L600 880 L168 880 L290 420 L268 300 Q302 250 310 150 Z" fill="${c}"/>
    <path d="M290 420 L478 420" stroke="${shade(c, 0.75)}" stroke-width="10"/>`,
};

async function drawGarment(shape, color, { detail = false } = {}) {
  // The detail image is a closer crop of the same drawing, so each product has a gallery of two.
  const viewBox = detail ? "184 200 400 533" : "0 0 768 1024";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="${viewBox}">
    <rect x="-1000" y="-1000" width="3000" height="3000" fill="#ffffff"/>${SHAPES[shape](color)}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

// ---- Products ----
const P = (slug, name, shape, color, price, type, description) => ({ slug, name, shape, color, price, type, description });
const PRODUCTS = [
  P("classic-crew-tee-white", "Classic Crew Tee", "tee", "#f2f2f0", 2400, "top", "A soft cotton crew-neck tee with a regular fit."),
  P("classic-crew-tee-black", "Classic Crew Tee", "tee", "#222222", 2400, "top", "A soft cotton crew-neck tee with a regular fit."),
  P("classic-crew-tee-navy", "Classic Crew Tee", "tee", "#1f2f55", 2400, "top", "A soft cotton crew-neck tee with a regular fit."),
  P("heavyweight-tee-sage", "Heavyweight Tee", "tee", "#8fa58a", 3200, "top", "Thick cotton jersey, slightly boxy, dropped shoulders."),
  P("long-sleeve-tee-grey", "Long Sleeve Tee", "longsleeve", "#9a9da3", 2900, "top", "Everyday long sleeve tee in heather grey."),
  P("long-sleeve-tee-rust", "Long Sleeve Tee", "longsleeve", "#b0562f", 2900, "top", "Everyday long sleeve tee in a warm rust colour."),
  P("ribbed-tank-white", "Ribbed Tank", "tank", "#f4f1ea", 1800, "top", "Stretchy ribbed tank top, close fit."),
  P("ribbed-tank-olive", "Ribbed Tank", "tank", "#6b6f3a", 1800, "top", "Stretchy ribbed tank top, close fit."),
  P("fleece-hoodie-charcoal", "Fleece Hoodie", "hoodie", "#3b3d42", 5800, "top", "Brushed fleece hoodie with a kangaroo pocket."),
  P("fleece-hoodie-sky", "Fleece Hoodie", "hoodie", "#8db6d8", 5800, "top", "Brushed fleece hoodie with a kangaroo pocket."),
  P("oxford-shirt-blue", "Oxford Shirt", "shirt", "#a9c3e0", 4800, "top", "Button-front oxford cotton shirt with a classic collar."),
  P("linen-shirt-sand", "Linen Shirt", "shirt", "#d8c7a6", 5400, "top", "Breathable linen shirt for warm days."),
  P("straight-jeans-indigo", "Straight Jeans", "jeans", "#2c3e66", 6800, "bottom", "Mid-rise straight-leg jeans in rigid indigo denim."),
  P("straight-jeans-black", "Straight Jeans", "jeans", "#1d1d20", 6800, "bottom", "Mid-rise straight-leg jeans in washed black denim."),
  P("chino-trousers-khaki", "Chino Trousers", "jeans", "#b59f74", 5600, "bottom", "Cotton twill chinos with a tapered leg."),
  P("cotton-shorts-navy", "Cotton Shorts", "shorts", "#26345c", 3400, "bottom", "Relaxed cotton shorts with a 7-inch inseam."),
  P("a-line-skirt-burgundy", "A-Line Skirt", "skirt", "#6e1f33", 4200, "bottom", "Knee-length A-line skirt."),
  P("wrap-dress-forest", "Wrap Dress", "dress", "#2f5a43", 7800, "one_piece", "Midi wrap dress with a tie waist."),
  P("slip-dress-champagne", "Slip Dress", "dress", "#e3cfa8", 6900, "one_piece", "Bias-cut slip dress with thin straps."),
  P("shirt-dress-stripe-blue", "Shirt Dress", "dress", "#5d7fb5", 7200, "one_piece", "Button-front shirt dress with a belt."),
];

const chartFor = (type) => (type === "top" ? TOP_CHART : type === "bottom" ? BOTTOM_CHART : DRESS_CHART);

async function upload(path, buffer) {
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

let done = 0;
for (const p of PRODUCTS) {
  const tryon = `products/${p.slug}/tryon.jpg`;
  const detail = `products/${p.slug}/detail.jpg`;
  await upload(tryon, await drawGarment(p.shape, p.color));
  await upload(detail, await drawGarment(p.shape, p.color, { detail: true }));

  const row = {
    slug: p.slug,
    shop_name: SHOP,
    name: p.name,
    description: `${p.description} Sample product for testing.`,
    price_cents: p.price,
    currency: "USD",
    garment_type: p.type,
    tryon_image_path: tryon,
    gallery_paths: [tryon, detail],
    sizes: SIZES,
    size_chart: chartFor(p.type),
    buy_url: `https://example.com/products/${p.slug}`,
    status: "published",
  };
  const { error } = await admin.from("products").upsert(row, { onConflict: "slug" });
  if (error) throw new Error(`product ${p.slug}: ${error.message}`);
  done++;
  process.stdout.write(`\rseeded ${done}/${PRODUCTS.length}`);
}
console.log("\ndone");
