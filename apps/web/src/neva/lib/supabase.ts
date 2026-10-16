'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const BACKEND_READY = !!url && !!key;
export const GOOGLE_SIGN_IN = BACKEND_READY && process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === '1';

/** Same Supabase project as the mobile app — that's what will sync chats between phone and web. */
export const supabase: SupabaseClient | null = BACKEND_READY
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;
