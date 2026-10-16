'use client';

import { useStore } from '../store';

import { GOOGLE_SIGN_IN, supabase } from './supabase';

type Result = { ok: true; needsConfirm?: boolean } | { ok: false; error: string };

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const passwordProblem = (pw: string) => {
  if (pw.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mix letters and numbers';
  return null;
};

export async function signUpWithEmail(email: string, password: string): Promise<Result> {
  const e = email.trim().toLowerCase();
  if (!supabase) {
    useStore.getState().startEmailSession(e, 'signup');
    return { ok: true };
  }
  const { data, error } = await supabase.auth.signUp({ email: e, password, options: { emailRedirectTo: window.location.origin } });
  if (error) return { ok: false, error: error.message };
  if (!data.session) return { ok: true, needsConfirm: true };
  useStore.getState().signInWithProvider({ provider: 'email', userId: data.session.user.id, email: e });
  return { ok: true };
}

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

/** Send a password-reset email. Without the server there are no passwords to reset, so say so kindly. */
export async function sendPasswordReset(email: string): Promise<Result> {
  if (!supabase) return { ok: false, error: 'Password reset works once accounts are connected to the server.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/auth/callback` });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Web Google sign-in: full-page redirect to Google → Supabase → back to this site (session picked up from the URL). */
export async function signInWithGoogle(): Promise<Result> {
  if (!GOOGLE_SIGN_IN || !supabase) return { ok: false, error: 'Google sign-in isn’t set up yet.' };
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** After an OAuth redirect lands back here, adopt the session into the store. */
export async function adoptRemoteSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return;
  const auth = useStore.getState().auth;
  if (auth.userId === u.id && auth.stage !== 'signed_out') return;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  useStore.getState().signInWithProvider({
    provider: u.app_metadata?.provider === 'google' ? 'google' : 'email',
    userId: u.id,
    email: u.email ?? undefined,
    displayName: meta.full_name ?? meta.name,
    avatarUri: meta.avatar_url ?? meta.picture,
  });
}

export async function signOutEverywhere() {
  await supabase?.auth.signOut().catch(() => {});
  useStore.getState().signOut();
}
