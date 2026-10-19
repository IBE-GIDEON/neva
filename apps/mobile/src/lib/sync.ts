import { connectRemote, type UploadImage } from '@neva/core';

import { AppState } from 'react-native';

import { useLive, useStore } from '@/store';

import { supabase } from './supabase';

const typeOf = (uri: string) => (/\.png($|\?)/i.test(uri) ? 'image/png' : /\.webp($|\?)/i.test(uri) ? 'image/webp' : 'image/jpeg');

/** Mobile upload: images are local file URIs from the picker; React Native's fetch reads them into an ArrayBuffer. */
const uploadImage: UploadImage = async (bucket, path, uri) => {
  if (!supabase) throw new Error('Not connected');
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: typeOf(uri), upsert: true });
  if (error) throw error;
  return path;
};

let started = false;
let current: { userId: string; disconnect: () => void } | null = null;

/** Keeps the shared store connected to Supabase for whoever is signed in. Safe to call more than once. */
export function startSync() {
  if (!supabase || started) return;
  started = true;
  // "Online" = the app is open on screen.
  useLive.setState({ foreground: AppState.currentState === 'active' });
  AppState.addEventListener('change', (state) => useLive.setState({ foreground: state === 'active' }));
  const connect = (userId: string) => {
    if (current?.userId === userId) return;
    current?.disconnect();
    current = { userId, disconnect: connectRemote({ store: useStore, supabase: supabase!, userId, uploadImage }) };
  };
  supabase.auth.onAuthStateChange((event, session) => {
    const u = session?.user;
    if (u && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      // Defer: Supabase recommends not awaiting other client calls inside this callback.
      setTimeout(() => {
        const auth = useStore.getState().auth;
        if (auth.stage === 'signed_out' || auth.userId !== u.id) {
          const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
          useStore.getState().signInWithProvider({
            provider: u.app_metadata?.provider === 'google' ? 'google' : 'email',
            userId: u.id,
            email: u.email ?? undefined,
            displayName: meta.full_name ?? meta.name,
            avatarUri: meta.avatar_url ?? meta.picture,
          });
        }
        connect(u.id);
      }, 0);
    } else if (event === 'SIGNED_OUT') {
      current?.disconnect();
      current = null;
    }
  });
}
