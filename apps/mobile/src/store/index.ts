/**
 * Mobile store: the shared Neva store (packages/core) with a batched AsyncStorage adapter.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { createNevaStore } from '@neva/core';

/** AsyncStorage wrapper that coalesces rapid writes (typing, message status ticks) into one write. */
const pendingWrites = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const flushWrites = () => {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pendingWrites.forEach((v, k) => AsyncStorage.setItem(k, v).catch(() => {}));
  pendingWrites.clear();
};
const batchedStorage = {
  getItem: (k: string) => pendingWrites.get(k) ?? AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => {
    pendingWrites.set(k, v);
    if (!flushTimer) flushTimer = setTimeout(flushWrites, 500);
  },
  removeItem: (k: string) => {
    pendingWrites.delete(k);
    return AsyncStorage.removeItem(k);
  },
};
AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushWrites();
});


export const useStore = createNevaStore(batchedStorage);

export { isStoryLive, selectMe, showToast, useLive } from '@neva/core';
export type { State } from '@neva/core';
