import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">See clothes on yourself before you buy</h1>
      <p className="text-muted-foreground">
        Add a photo of yourself, pick something from the shop, and see an AI preview of how it could look. This
        site is a test version.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/catalog" className={buttonVariants()}>
          Browse the shop
        </Link>
        <Link href="/photos" className={buttonVariants({ variant: "outline" })}>
          Add your photo
        </Link>
      </div>
    </main>
  );
}
