import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { features } from '@/config';
import { useStore } from '@/store';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Where Google → Supabase sends the user back. In Expo Go this is exp://<lan-ip>:8081/--/auth/callback,
 * in a build it is neva://auth/callback. Both must be allowed in Supabase › Auth › URL Configuration.
 */
export const authRedirectUrl = () => Linking.createURL('auth/callback');

type Result = { ok: true } | { ok: false; error?: string; cancelled?: boolean };

/** Free sign-in with Google (no per-login cost), via Supabase OAuth + an in-app browser session. */
export async function signInWithGoogle(): Promise<Result> {
  if (!features.googleSignIn || !supabase) return { ok: false, error: 'Google sign-in isn’t set up yet.' };

  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data?.url) return { ok: false, error: error?.message ?? 'Couldn’t start Google sign-in.' };

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { ok: false, cancelled: true };

  // PKCE: ?code=…  (errors come back as ?error_description=…)
  const { queryParams } = Linking.parse(res.url);
  const errDesc = queryParams?.error_description;
  if (errDesc) return { ok: false, error: String(errDesc) };
  const code = queryParams?.code;
  if (typeof code !== 'string') return { ok: false, error: 'Google didn’t return a sign-in code.' };

  const { data: sessionData, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr || !sessionData.session) return { ok: false, error: exErr?.message ?? 'Couldn’t finish signing in.' };

  const u = sessionData.session.user;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  useStore.getState().signInWithProvider({
    provider: 'google',
    userId: u.id,
    email: u.email ?? undefined,
    displayName: meta.full_name ?? meta.name,
    avatarUri: meta.avatar_url ?? meta.picture,
  });
  return { ok: true };
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export const passwordProblem = (pw: string) => {
  if (pw.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mix letters and numbers';
  return null;
};

/** Create an account with email + password. With Supabase: real signup (confirmation email per project settings). */
export async function signUpWithEmail(email: string, password: string): Promise<Result & { needsConfirm?: boolean }> {
  const e = email.trim().toLowerCase();
  if (!supabase) {
    useStore.getState().startEmailSession(e, 'signup');
    return { ok: true };
  }
  const { data, error } = await supabase.auth.signUp({ email: e, password, options: { emailRedirectTo: authRedirectUrl() } });
  if (error) return { ok: false, error: error.message };
  if (!data.session) return { ok: true, needsConfirm: true }; // email confirmation required first
  useStore.getState().signInWithProvider({ provider: 'email', userId: data.session.user.id, email: e });
  return { ok: true };
}

/** Log in with email + password. */
export async function logInWithEmail(email: string, password: string): Promise<Result> {
  const e = email.trim().toLowerCase();
  if (!supabase) {
    useStore.getState().startEmailSession(e, 'login');
    return { ok: true };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
  if (error || !data.session) return { ok: false, error: error?.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error?.message ?? 'Couldn’t log in.' };
  useStore.getState().signInWithProvider({ provider: 'email', userId: data.session.user.id, email: e });
  return { ok: true };
}

/** Send a password-reset email (backend only). */
export async function sendPasswordReset(email: string): Promise<Result> {
  if (!supabase) return { ok: false, error: 'Password reset works once accounts are connected to the server.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirectUrl() });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOutRemote() {
  await supabase?.auth.signOut().catch(() => {});
}
