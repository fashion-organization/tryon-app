"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, hasAcceptedTerms, recordSignupConsents, siteOrigin } from "./dal";
import { safeNext } from "./paths";

export type FormState = { error?: string; message?: string; email?: string };

const MIN_PASSWORD = 8;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function friendly(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match. Check them, or reset your password.";
    case "email_not_confirmed":
      return "Please confirm your email first. Check your inbox for the link we sent.";
    case "weak_password":
      return "Please choose a stronger password.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      console.error("auth error", error.code, error.message);
      return "Something went wrong. Please try again.";
  }
}

async function callbackUrl(next: string): Promise<string> {
  return `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const next = safeNext(formData.get("next"));

  if (!validEmail(email)) return { error: "Please enter a valid email address.", email };
  if (password.length < MIN_PASSWORD) return { error: `Your password needs at least ${MIN_PASSWORD} characters.`, email };
  if (formData.get("adult") !== "on") return { error: "You must be 18 or older to use this service.", email };
  if (formData.get("terms") !== "on") return { error: "Please accept the terms and the privacy policy.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await callbackUrl(next) },
  });
  if (error) return { error: friendly(error), email };

  // For an email that already has an account, Supabase returns a placeholder user with no
  // identities and sends no email, so nobody can find out which emails are registered.
  // Only a genuinely new user gets consent rows.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await recordSignupConsents(data.user.id, "email");
  }

  if (data.session) redirect(next); // email confirmation switched off
  redirect("/sign-up/check-email");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const next = safeNext(formData.get("next"));

  if (!validEmail(email) || !password) return { error: "Please enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error), email };

  redirect(next);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) {
    console.error("google sign-in", error?.message);
    redirect(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email").trim().toLowerCase();
  if (!validEmail(email)) return { error: "Please enter a valid email address.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await callbackUrl("/reset-password"),
  });
  // Same answer whether or not the account exists.
  if (error && error.code?.startsWith("over_")) return { error: friendly(error), email };
  return { message: "If an account exists for that email, we've sent a link to reset the password. It expires in an hour.", email };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  if (!(await getUser())) return { error: "Your reset link has expired. Please ask for a new one." };
  if (password.length < MIN_PASSWORD) return { error: `Your password needs at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error) };

  redirect("/account?updated=password");
}

export async function acceptTerms(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(formData.get("next"));
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  if (formData.get("adult") !== "on") return { error: "You must be 18 or older to use this service." };
  if (formData.get("terms") !== "on") return { error: "Please accept the terms and the privacy policy." };

  if (!(await hasAcceptedTerms(user.id))) await recordSignupConsents(user.id, "google");
  redirect(next);
}
