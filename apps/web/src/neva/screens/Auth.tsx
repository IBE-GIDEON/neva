'use client';

import { tidyPlace } from '@neva/core';
import { Camera, Eye, EyeOff, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';

import { isValidEmail, logInWithEmail, passwordProblem, sendPasswordReset, signInWithGoogle, signUpWithEmail } from '../lib/auth';
import { pickImages } from '../lib/images';
import { Avatar } from '../components/ui';
import { BACKEND_READY, GOOGLE_SIGN_IN } from '../lib/supabase';
import { LocationInput } from '../components/LocationInput';
import { showToast, useStore } from '../store';

export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-band" />
      <div className="auth-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/neva-mark.png" alt="" style={{ width: 34, height: 34 }} />
        NEVA WEB
      </div>
      {children}
      <div className="faint" style={{ textAlign: 'center', fontSize: 13, paddingBottom: 32, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <Lock size={13} /> Your messages stay between you and the people you chat with.
      </div>
    </div>
  );
}

/** Sign up / log in — email + password, Google when configured. Same rules as the mobile app. */
export function AuthPage() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const signup = mode === 'signup';
  const pwIssue = signup ? passwordProblem(password) : password ? null : 'Enter your password';
  const valid = isValidEmail(email) && !pwIssue;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    const res = signup ? await signUpWithEmail(email, password) : await logInWithEmail(email, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (res.needsConfirm) {
      setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then log in.`);
      setMode('login');
    }
  };
  const switchTo = (m: 'signup' | 'login') => {
    setMode(m);
    setError('');
  };
  const forgot = async () => {
    if (busy) return;
    setInfo('');
    if (!isValidEmail(email)) return setError('Enter your email above, then click “Forgot password?”');
    setBusy(true);
    setError('');
    const res = await sendPasswordReset(email);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setInfo(`If an account exists for ${email.trim()}, we sent a link to reset your password.`);
  };

  return (
    <Frame>
      <div className="auth-card">
        <div>
          <h1>Buy and sell gadgets in conversation</h1>
          <ol>
            <li>Create an account or log in with your email</li>
            <li>Pick a unique @username so people can find you</li>
            <li>Browse Explore, or message a seller straight from a listing</li>
            <li>Make offers, share status updates and run your shop from here</li>
          </ol>
          <div className="faint" style={{ marginTop: 28, fontSize: 13.5, lineHeight: 1.6, maxWidth: 440 }}>
            Meet in public and inspect items before paying. Payments made outside Neva aren’t protected.
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="auth-tabs">
            <button type="button" className={signup ? 'on' : ''} onClick={() => switchTo('signup')}>Create account</button>
            <button type="button" className={!signup ? 'on' : ''} onClick={() => switchTo('login')}>Log in</button>
          </div>
          <div>
            <label className="flabel" htmlFor="email">Email</label>
            <input id="email" className="box" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
          </div>
          <div>
            <label className="flabel" htmlFor="pw">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="pw" className="box" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} style={{ paddingRight: 44 }} />
              <button type="button" className="faint" onClick={() => setShow(!show)} style={{ position: 'absolute', right: 12, top: 12 }} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {signup && password && pwIssue && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{pwIssue}</div>}
            {!signup && (
              <button type="button" className="link-btn" onClick={forgot} disabled={busy} style={{ marginTop: 8 }}>
                Forgot password?
              </button>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          {info && <div style={{ color: 'var(--accent)', fontSize: 13.5 }}>{info}</div>}
          <button className="btn primary" disabled={!valid || busy} type="submit" style={{ marginTop: 4 }}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
          </button>
          {GOOGLE_SIGN_IN && (
            <button type="button" className="btn line" onClick={async () => { const r = await signInWithGoogle(); if (!r.ok) showToast(r.error); }}>
              Continue with Google
            </button>
          )}
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
            By continuing you agree to the Terms and Privacy Policy.
            {!BACKEND_READY && <><br />Accounts are stored in this browser until the server is connected.</>}
          </div>
        </form>
      </div>
    </Frame>
  );
}

const RESERVED = ['admin', 'neva', 'support', 'moderator', 'help', 'official'];

export function ProfileSetupPage() {
  const users = useStore((s) => s.users);
  const prefill = useStore((s) => s.auth.prefill);
  const [name, setName] = useState(prefill?.displayName ?? '');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(prefill?.avatarUri);

  const usernameError = useMemo(() => {
    if (!username) return '';
    if (!/^[a-z0-9._]{3,20}$/.test(username)) return '3–20 characters: letters, numbers, . and _';
    if (RESERVED.includes(username)) return 'That username is reserved';
    if (Object.values(users).some((u) => u.username === username)) return 'Username taken';
    return '';
  }, [username, users]);
  const valid = name.trim().length >= 2 && username.length >= 3 && !usernameError && city.trim().length >= 2;

  return (
    <Frame>
      <form
        className="auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const s = useStore.getState();
          // Store moves the stage on to 'interests'; NevaApp then shows the onboarding steps.
          s.completeProfile({ displayName: name.trim(), username, city: tidyPlace(city), avatarUri });
        }}>
        <div>
          <h1>Set up your profile</h1>
          <ol>
            <li>Your name is shown on chats and listings</li>
            <li>Your @username is how people find and message you</li>
            <li>Your city helps buyers nearby find your items</li>
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="avatar-pick">
            <button
              type="button"
              aria-label={avatarUri ? 'Change profile photo' : 'Add a profile photo'}
              onClick={async () => {
                const [img] = await pickImages();
                if (img) setAvatarUri(img);
              }}>
              <Avatar user={{ displayName: name.trim() || '?', avatarUri }} size={96} />
              <span className="cam">
                <Camera size={16} />
              </span>
            </button>
            <div className="faint" style={{ fontSize: 12.5 }}>
              {avatarUri ? (
                <>
                  Profile photo ·{' '}
                  <button type="button" className="link-btn" onClick={() => setAvatarUri(undefined)}>Remove</button>
                </>
              ) : (
                'Add a photo (optional)'
              )}
            </div>
          </div>
          <div>
            <label className="flabel">Display name</label>
            <input className="box" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="flabel">Username</label>
            <div style={{ position: 'relative' }}>
              <span className="faint" style={{ position: 'absolute', left: 12, top: 12 }}>@</span>
              <input className="box" style={{ paddingLeft: 28 }} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))} />
            </div>
            {usernameError && <div className="error" style={{ marginTop: 6 }}>{usernameError}</div>}
          </div>
          <div>
            <label className="flabel">City or area</label>
            <LocationInput value={city} onChange={setCity} placeholder="Your city, town or area" />
          </div>
          <button className="btn primary" disabled={!valid} type="submit">Continue</button>
          <button type="button" className="btn ghost" onClick={() => useStore.getState().signOut()}>Use a different account</button>
        </div>
      </form>
    </Frame>
  );
}
