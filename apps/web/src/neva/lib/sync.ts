'use client';

import { connectRemote, type UploadImage } from '@neva/core';

import { useLive, useStore } from '../store';
import { adoptRemoteSession } from './auth';
import { supabase } from './supabase';

const typeOf = (dataUrl: string) => /^data:(image\/[a-z+]+);/.exec(dataUrl)?.[1] ?? 'image/jpeg';

/** Web upload: images are held as data: URLs (see lib/images), so turn them into a Blob and store them. */
const uploadImage: UploadImage = async (bucket, path, dataUrl) => {
  if (!supabase) throw new Error('Not connected');
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: (blob.type || typeOf(dataUrl)).split(';')[0], upsert: true });
  if (error) throw error;
  return path;
};

let started = false;
let current: { userId: string; disconnect: () => void } | null = null;

/** Keeps the shared store connected to Supabase for whoever is signed in. Safe to call more than once. */
export function startSync() {
  if (!supabase || started) return;
  started = true;
  // "Online" = this tab is visible (like WhatsApp Web when the window is in view).
  const onVisibility = () => useLive.setState({ foreground: document.visibilityState === 'visible' });
  onVisibility();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => useLive.setState({ foreground: false }));
  const connect = (userId: string) => {
    if (current?.userId === userId) return;
    current?.disconnect();
    current = { userId, disconnect: connectRemote({ store: useStore, supabase: supabase!, userId, uploadImage }) };
  };
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      // Defer: Supabase recommends not awaiting other client calls inside this callback.
      setTimeout(() => {
        adoptRemoteSession();
        connect(session.user.id);
      }, 0);
    } else if (event === 'SIGNED_OUT') {
      current?.disconnect();
      current = null;
    }
  });
}
