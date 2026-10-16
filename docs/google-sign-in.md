# Turning on "Continue with Google"

The app code is done. Google sign-in stays hidden until these steps are finished.

## 1. Google Cloud (console.cloud.google.com)
1. Create a project (e.g. `Neva`).
2. **APIs & Services → OAuth consent screen**: user type *External*, app name *Neva*, your support email. Add scopes `email`, `profile`, `openid`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret** (keep the secret private — don't paste it in chat).

## 2. Supabase dashboard
1. **Authentication → Providers → Google**: enable, paste Client ID + Client secret, save.
2. **Authentication → URL Configuration → Redirect URLs**, add:
   - `exp://**` (Expo Go during development)
   - `neva://**` (installed builds)

## 3. The app
In `neva/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
EXPO_PUBLIC_GOOGLE_SIGN_IN=1
```
Restart Expo (`npx expo start --clear`). "Continue with Google" appears on the welcome screen.

## How it works
`src/lib/auth.ts` → `supabase.auth.signInWithOAuth({ provider: 'google' })` (PKCE) → in-app browser
(`expo-web-browser`) → Google → Supabase → back to `…/auth/callback?code=…` → `exchangeCodeForSession` →
the profile setup screen is pre-filled with the Google name and photo.
