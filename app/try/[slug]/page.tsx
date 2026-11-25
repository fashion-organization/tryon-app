import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhotoConsent } from "@/app/photos/photo-consent";
import { PhotoUploader } from "@/app/photos/photo-uploader";
import { requireUser } from "@/lib/auth/dal";
import { formatPrice, getProduct } from "@/lib/catalog";
import { MAX_PHOTOS, hasPhotoConsent, listPhotos } from "@/lib/photos";
import { getProvider } from "@/lib/tryon";
import { expectedSeconds, getAllowance, photosAlreadyTried } from "@/lib/tryon/queries";
import { StartTryOn } from "./start-tryon";

export const metadata = { title: "Try it on · Virtual try-on" };

export default function TryPage({ params }: PageProps<"/try/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/try/[slug]">["params"] }) {
  const { slug } = await params;
  const user = await requireUser(`/try/${slug}`);
  const product = await getProduct(slug);
  if (!product) notFound();

  const header = (
    <div className="flex items-center gap-4">
      {product.imageUrl ? (
        <Image src={product.imageUrl} alt="" width={64} height={80} className="h-20 w-16 rounded-md border object-cover" />
      ) : null}
      <div className="grid gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Try on: {product.name}</h1>
        <p className="text-sm text-muted-foreground">
          {product.shopName} · {formatPrice(product.priceCents, product.currency)} ·{" "}
          <Link href={`/products/${product.slug}`} className="underline underline-offset-2">
            Back to item
          </Link>
        </p>
      </div>
    </div>
  );

  if (!(await hasPhotoConsent(user.id))) {
    return (
      <>
        {header}
        <p className="text-sm">To try clothes on, we need a photo of you. First, how we look after it:</p>
        <PhotoConsent />
      </>
    );
  }

  const [photos, allowance, tried] = await Promise.all([
    listPhotos(user.id),
    getAllowance(user.id),
    photosAlreadyTried(user.id, product.id),
  ]);

  if (photos.length === 0) {
    return (
      <>
        {header}
        <p className="text-sm">Add a photo of yourself to see this item on you.</p>
        <PhotoUploader remaining={MAX_PHOTOS} />
      </>
    );
  }

  return (
    <>
      {header}
      <StartTryOn
        productId={product.id}
        photos={photos.map((p) => ({ id: p.id, url: p.url, isPrimary: p.isPrimary }))}
        alreadyTried={tried}
        left={allowance.left}
        limit={allowance.limit}
        available={Boolean(getProvider())}
        expectedSeconds={expectedSeconds()}
      />
      {photos.length < MAX_PHOTOS ? (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Add another photo</summary>
          <div className="mt-3">
            <PhotoUploader remaining={MAX_PHOTOS - photos.length} />
          </div>
        </details>
      ) : null}
    </>
  );
}
