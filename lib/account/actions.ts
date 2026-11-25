"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountData } from "./delete";

export type DeleteState = { error?: string };

/** "Delete my account", confirmed by typing DELETE. */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/account");

  const typed = formData.get("confirm");
  if (typeof typed !== "string" || typed.trim().toUpperCase() !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }

  try {
    await deleteAccountData(user.id);
  } catch (e) {
    console.error(`account deletion failed for ${user.id}:`, (e as Error).message);
    return { error: "Your account couldn't be fully deleted. Please try again, or contact us if it keeps happening." };
  }

  // The account is gone; this clears the session cookies in this browser.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/account-deleted");
}
