import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

export const metadata = { title: "Your account · Virtual try-on" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const user = await requireUser("/account");
  const { updated } = await searchParams;

  return (
    <>
      {updated === "password" ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          Your password has been changed.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Signed in</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your profile and measurements will appear here (step 1.4).
          </p>
        </CardContent>
      </Card>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </>
  );
}
