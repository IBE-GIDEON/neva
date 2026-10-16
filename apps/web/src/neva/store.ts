'use client';

/** Web store: the shared Neva store (packages/core) persisted to the browser's localStorage. */
import { createNevaStore } from '@neva/core';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';

const local: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null; // server render / blocked storage
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or unavailable — keep working in memory */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = createNevaStore(local);
export { isStoryLive, showToast, useLive } from '@neva/core';

/** Transient web UI state: right drawer, modals, lightbox. */
type Drawer = { kind: 'shop'; id: string } | { kind: 'listing'; id: string } | null;
type UI = {
  drawer: Drawer;
  sell: { open: boolean; editingId?: string };
  report: { type: 'listing' | 'user' | 'message' | 'story'; target: string; name?: string } | null;
  review: string | null;
  /** A single image (legacy) or a gallery with the starting index. */
  lightbox: string | { images: string[]; index: number } | null;
};
export const useUI = create<UI>(() => ({ drawer: null, sell: { open: false }, report: null, review: null, lightbox: null }));
export const openDrawer = (d: Drawer) => useUI.setState({ drawer: d });
/** Open the photo viewer on a gallery, starting at `index`. */
export const openLightbox = (images: string[], index = 0) => {
  const list = images.filter(Boolean);
  if (list.length) useUI.setState({ lightbox: { images: list, index: Math.max(0, Math.min(index, list.length - 1)) } });
};
export const openSell = (editingId?: string) => useUI.setState({ sell: { open: true, editingId } });
