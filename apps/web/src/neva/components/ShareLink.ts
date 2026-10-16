'use client';

import { showToast } from '../store';

/** Deep link into the web app, e.g. shareUrl('listing', id) → https://host/explore?listing=id */
export const shareUrl = (kind: 'listing' | 'shop', id: string) => `${location.origin}/explore?${kind}=${encodeURIComponent(id)}`;

/** Native share sheet when the browser has one, otherwise copy the link and confirm with a toast. */
export async function shareLink({ title, text, url }: { title: string; text?: string; url: string }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // user closed the sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied');
  } catch {
    showToast('Couldn’t copy the link');
  }
}
