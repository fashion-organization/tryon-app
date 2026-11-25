import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { getProfile } from "@/lib/profile";
import { displayFromMetric } from "@/lib/units";
import { DeleteAccount, DownloadData } from "./data-controls";
import { ProfileForm } from "./profile-form";

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
  const [profile, { updated }] = await Promise.all([getProfile(user.id), searchParams]);

  return (
    <>
      {updated === "password" ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          Your password has been changed.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialName={profile.display_name ?? ""}
            initialUnits={profile.preferred_units}
            initialDisplay={displayFromMetric(profile, profile.preferred_units)}
          />
        </CardContent>
      </Card>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent>
          <DownloadData />
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccount />
        </CardContent>
      </Card>
    </>
  );
}
