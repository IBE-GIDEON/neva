/**
 * Runtime configuration. Values come from `.env` (EXPO_PUBLIC_* are bundled into the app —
 * only put public keys here, never service-role or secret keys).
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  // Newer Supabase projects call this the publishable key; either works.
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

/** True once the app has a backend to talk to. Features that need real accounts check this. */
export const BACKEND_READY = !!config.supabaseUrl && !!config.supabaseAnonKey;

export const features = {
  /** "Continue with Google" — free sign-in. Shown only when the backend and Google provider are configured. */
  googleSignIn: BACKEND_READY && process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN === '1',
};

