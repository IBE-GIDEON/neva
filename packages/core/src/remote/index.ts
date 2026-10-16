/**
 * Supabase sync for the shared Neva store. See ./README.md.
 *
 *   const disconnect = connectRemote({ store: useStore, supabase, userId: session.user.id, uploadImage });
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { NevaStore } from '../store';
import { type Ctx, type UploadImage, friendly, isNetworkError, later, q, toast } from './context';
import { installActions } from './actions';
import { applyConversations, applyOtherRead, ensureListings, ensureProfiles, fetchConversations, initialLoad } from './load';
import { notificationFromRow } from './mappers';
import { subscribe } from './realtime';
import type { NotificationRow } from './rows';

export type { Bucket, UploadImage } from './context';

export type ConnectRemoteOptions = {
  store: NevaStore;
  supabase: SupabaseClient;
  /** auth.users id of the signed-in user */
  userId: string;
  uploadImage: UploadImage;
};

/** Conversation id aliases survive reconnects within the same app session (per user). */
const aliasesByUser = new Map<string, { l2r: Map<string, string>; r2l: Map<string, string> }>();
let activeDisconnect: (() => void) | null = null;

/** True when supabase/migrations/0003_sync.sql has been applied. */
async function probeV3(ctx: Ctx) {
  const { error } = await ctx.sb.from('conversation_members').select('cleared_at').limit(1);
  return !error;
}

async function refresh(ctx: Ctx) {
  const data = await fetchConversations(ctx);
  await Promise.all([ensureProfiles(ctx, data.userIds), ensureListings(ctx, data.listingIds)]);
  if (!ctx.alive) return;
  applyConversations(ctx, data, false);
  if (data.otherReadAt.size) applyOtherRead(ctx, data.otherReadAt);
  const rows = (await q(ctx.sb.from('notifications').select('*').eq('recipient_id', ctx.userId).order('created_at', { ascending: false }).limit(100))) as NotificationRow[];
  if (ctx.alive) ctx.store.setState({ notifications: rows.map((r) => notificationFromRow(ctx, r)) });
}

/**
 * Connect the store to Supabase: loads server data (server wins), wraps every data-changing action with a
 * write-through version, and subscribes to realtime. Returns `disconnect` (also run automatically by
 * signOut / clearDeviceData). Calling it again disconnects the previous connection first.
 */
export function connectRemote({ store, supabase, userId, uploadImage }: ConnectRemoteOptions): () => void {
  activeDisconnect?.();

  let aliases = aliasesByUser.get(userId);
  if (!aliases) aliasesByUser.set(userId, (aliases = { l2r: new Map(), r2l: new Map() }));

  const ctx: Ctx = {
    store,
    sb: supabase,
    userId,
    upload: uploadImage,
    v3: false,
    alive: true,
    convL2R: aliases.l2r,
    convR2L: aliases.r2l,
    confirmedConvs: new Set(),
    pendingConvs: new Map(),
    remoteListings: new Set(),
    remoteReviews: new Set(),
    timers: new Set(),
  };

  let ready = false;
  const queue: (() => void | Promise<void>)[] = [];
  const run = (fn: () => void | Promise<void>) => {
    if (ready) void fn();
    else queue.push(fn);
  };

  const disconnect = () => {
    if (!ctx.alive) return;
    ctx.alive = false;
    ctx.timers.forEach(clearTimeout);
    ctx.timers.clear();
    void supabase.removeChannel(channel).catch(() => {});
    store.setState(originals);
    if (activeDisconnect === disconnect) activeDisconnect = null;
  };

  const originals = installActions(ctx, disconnect);
  const channel = subscribe(ctx, run, () => void refresh(ctx).catch(() => {}));

  let attempt = 0;
  const load = async () => {
    try {
      ctx.v3 = await probeV3(ctx);
      await initialLoad(ctx);
    } catch (e) {
      if (!ctx.alive) return;
      if (isNetworkError(e)) {
        // offline: keep local data and retry with backoff
        attempt += 1;
        later(ctx, Math.min(60_000, 3000 * 2 ** Math.min(attempt, 5)), () => void load());
        if (attempt === 1) toast('You’re offline. Showing what’s saved on this device.', 'cloud-offline-outline');
        return;
      }
      toast(friendly(e, 'Couldn’t load your latest chats and listings.'));
    }
    if (!ctx.alive || ready) return;
    ready = true;
    for (const fn of queue.splice(0)) void fn();
  };
  void load();

  activeDisconnect = disconnect;
  return disconnect;
}
