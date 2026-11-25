import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    // Only the public product images bucket; private photos are never optimised (signed URLs).
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/product-images/**`)] : [],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
