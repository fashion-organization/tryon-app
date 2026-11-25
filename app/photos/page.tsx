import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { MAX_PHOTOS, hasPhotoConsent, listPhotos } from "@/lib/photos";
import { PhotoConsent } from "./photo-consent";
import { PhotoGrid } from "./photo-grid";
import { PhotoUploader } from "./photo-uploader";

export const metadata = { title: "My photos · Virtual try-on" };

export default function PhotosPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">My photos</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const user = await requireUser("/photos");
  if (!(await hasPhotoConsent(user.id))) return <PhotoConsent />;

  const photos = await listPhotos(user.id);
  return (
    <>
      <PhotoUploader remaining={MAX_PHOTOS - photos.length} />
      <PhotoGrid photos={photos} />
    </>
  );
}
