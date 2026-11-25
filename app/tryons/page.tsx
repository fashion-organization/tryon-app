import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getAllowance, listTryOns } from "@/lib/tryon/queries";

export const metadata = { title: "My try-ons · Virtual try-on" };

export default function TryOnsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My try-ons</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

async function Content() {
  const user = await requireUser("/tryons");
  const [items, allowance] = await Promise.all([listTryOns(user.id), getAllowance(user.id)]);

  if (items.length === 0) {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-sm text-muted-foreground">No try-ons yet. Pick an item in the shop and tap Try it on.</p>
        <Link href="/catalog" className={buttonVariants()}>
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {allowance.left} of {allowance.limit} free try-ons left today. Seeing these again is always free.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/tryons/${item.id}`} className="group grid gap-2">
              <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border bg-muted">
                {item.resultUrl ? (
                  // Private signed link: plain <img>, not next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.resultUrl} alt={`You in ${item.productName}`} className="size-full object-cover transition group-hover:opacity-90" />
                ) : (
                  <span className="px-3 text-center text-sm text-muted-foreground">
                    {item.status === "processing" ? "In progress…" : "Didn't work. Tap for details."}
                  </span>
                )}
              </div>
              <div className="text-sm">
                <p className="font-medium group-hover:underline">{item.productName}</p>
                <p className="text-muted-foreground">{dateFormat.format(new Date(item.createdAt))}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
