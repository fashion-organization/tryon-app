import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { getTryOnDetail } from "@/lib/tryon/queries";
import { TryOnView } from "./tryon-view";

export const metadata = { title: "Your try-on · Virtual try-on" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TryOnPage({ params }: PageProps<"/tryons/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/tryons/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/tryons/${id}`);
  const detail = UUID.test(id) ? await getTryOnDetail(user.id, id) : null;
  if (!detail) notFound();
  return <TryOnView {...detail} />;
}
