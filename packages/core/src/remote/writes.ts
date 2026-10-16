/** Remote write routines shared by the action wrappers and the initial load. */
import { ME_ID } from '../constants';
import { uid } from '../format';
import type { Message, Profile } from '../types';
import {
  type Ctx,
  errCode,
  friendly,
  isLocalUri,
  isSchemaMissing,
  isUuid,
  pathFromUrl,
  publicUrl,
  q,
  storeImage,
  toRemoteConv,
  toRemoteUser,
  toast,
} from './context';
import { listingToRow, messageToRow, syncedSettingKeys } from './mappers';
import type { ProfileRow } from './rows';

/* ---------------- profile ---------------- */

export const settingsPayload = (ctx: Ctx) => {
  const s = ctx.store.getState().settings as Record<string, unknown>;
  return Object.fromEntries(syncedSettingKeys.map((k) => [k, s[k]]));
};

/** Insert (or update) my profile row from a local Profile. Throws on failure (e.g. username taken). */
export async function createProfileRemote(ctx: Ctx, p: Profile, interests: string[]): Promise<ProfileRow> {
  const avatarPath = await storeImage(ctx, 'avatars', p.avatarUri, `avatar-${Date.now()}`);
  const row = {
    id: ctx.userId,
    username: p.username.toLowerCase(),
    display_name: p.displayName,
    avatar_path: avatarPath,
    bio: p.bio?.slice(0, 500) ?? null,
    city: p.city,
    is_seller: p.isSeller,
    shop_name: p.shopName ?? null,
    shop_type: p.shopType ?? null,
  };
  const created = (await q(ctx.sb.from('profiles').upsert(row, { onConflict: 'id' }).select().single())) as ProfileRow;
  await q(ctx.sb.from('profile_private').upsert({ id: ctx.userId, interests, settings: settingsPayload(ctx) }, { onConflict: 'id' }));
  if (ctx.v3 && p.coverUri) {
    const cover = await storeImage(ctx, 'avatars', p.coverUri, `cover-${Date.now()}`).catch(() => null);
    if (cover) await ctx.sb.from('profiles').update({ cover_path: cover }).eq('id', ctx.userId);
  }
  // Swap the local (possibly large data:) avatar for the hosted one.
  if (avatarPath && isLocalUri(p.avatarUri))
    ctx.store.setState((s) => (s.users[ME_ID] ? { users: { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, avatarUri: publicUrl(ctx, 'avatars', avatarPath) } } } : {}));
  return created;
}

export const friendlyProfileError = (e: unknown) => {
  const code = errCode(e);
  if (code === '23505' || code === '42501') return 'That username is taken. Try another one.';
  if (code === '23514') return 'Check your name and username. Usernames use 3–20 letters, numbers, dots or underscores.';
  return friendly(e, 'Couldn’t save your profile.');
};

/* ---------------- listings ---------------- */

/** Give a legacy (non-uuid) local listing a uuid so it can be stored. */
function ensureListingUuid(ctx: Ctx, id: string): string {
  if (isUuid(id)) return id;
  const next = uid();
  ctx.store.setState((s) => {
    const { [id]: l, ...listings } = s.listings;
    if (!l) return {};
    return {
      listings: { ...listings, [next]: { ...l, id: next } },
      saved: s.saved.map((x) => (x === id ? next : x)),
      draft: s.draft?.editingId === id ? { ...s.draft, editingId: next } : s.draft,
    };
  });
  return next;
}

/** Create or update a listing (row + media + attributes) from the store copy. */
export async function upsertListingRemote(ctx: Ctx, localId: string): Promise<void> {
  const id = ensureListingUuid(ctx, localId);
  const l = ctx.store.getState().listings[id];
  if (!l) return;
  const paths: string[] = [];
  for (const img of l.images) {
    const p = await storeImage(ctx, 'listing-media', img, `${id}/${uid()}`);
    if (p) paths.push(p);
  }
  await q(ctx.sb.from('listings').upsert(listingToRow(ctx, l), { onConflict: 'id' }));
  ctx.remoteListings.add(id);
  await q(ctx.sb.from('listing_media').delete().eq('listing_id', id));
  if (paths.length) await q(ctx.sb.from('listing_media').insert(paths.map((storage_path, sort_order) => ({ listing_id: id, storage_path, sort_order, media_type: 'image' }))));
  await q(ctx.sb.from('listing_attributes').delete().eq('listing_id', id));
  const attrs = Object.entries(l.attributes ?? {}).filter(([k, v]) => k.trim() && String(v).trim());
  if (attrs.length) await q(ctx.sb.from('listing_attributes').insert(attrs.map(([attribute_key, value_text]) => ({ listing_id: id, attribute_key, value_text: String(value_text) }))));
  // Hosted URLs replace local picker URIs / data URLs.
  const hosted = paths.map((p) => publicUrl(ctx, 'listing-media', p)!);
  ctx.store.setState((s) => (s.listings[id] ? { listings: { ...s.listings, [id]: { ...s.listings[id]!, images: hosted } } } : {}));
  // First listing makes me a seller (mirrors the local publishDraft behaviour).
  const me = ctx.store.getState().users[ME_ID];
  if (me?.isSeller) await ctx.sb.from('profiles').update({ is_seller: true, shop_name: me.shopName ?? me.displayName }).eq('id', ctx.userId);
}

/* ---------------- conversations ---------------- */

/** Fold a conversation stored under `dupId` into `keepId` (used when the server returns a different id). */
function absorbConversation(ctx: Ctx, keepId: string, dupId: string) {
  ctx.store.setState((s) => {
    if (!s.conversations[dupId]) return {};
    const { [dupId]: dup, ...conversations } = s.conversations;
    const { [dupId]: dupMsgs, ...messages } = s.messages;
    const keep = conversations[keepId];
    const seen = new Set((messages[keepId] ?? []).map((m) => m.id));
    return {
      conversations: keep ? { ...conversations, [keepId]: { ...dup!, ...keep, id: keepId, lastMessageAt: Math.max(keep.lastMessageAt, dup!.lastMessageAt) } } : conversations,
      messages: {
        ...messages,
        [keepId]: [...(messages[keepId] ?? []), ...(dupMsgs ?? []).filter((m) => !seen.has(m.id)).map((m) => ({ ...m, conversationId: keepId }))].sort((a, b) => a.createdAt - b.createdAt),
      },
    };
  });
}

/**
 * Make sure the local conversation exists on the server and return its server id.
 * New conversations are created with start_conversation using the local id (0003: p_id), so ids match.
 * If the server returns a different id (conversation already existed, or 0003 not deployed), the local id
 * stays the store key and an alias maps it to the server id at the boundary.
 */
export function ensureConversation(ctx: Ctx, lid: string): Promise<string> {
  if (ctx.confirmedConvs.has(lid)) return Promise.resolve(toRemoteConv(ctx, lid));
  const pending = ctx.pendingConvs.get(lid);
  if (pending) return pending;
  const conv = ctx.store.getState().conversations[lid];
  if (!conv) return Promise.reject(new Error('conversation_missing'));

  const run = (async () => {
    const listing = conv.listingId ? ctx.store.getState().listings[conv.listingId] : undefined;
    // start_conversation makes me the buyer; only attach the listing when the other person sells it.
    const pListing = conv.listingId && isUuid(conv.listingId) && (!listing || listing.sellerId === conv.participantId) ? conv.listingId : null;
    const args = { p_seller: toRemoteUser(ctx, conv.participantId), p_listing: pListing };
    let sid: string;
    if (ctx.v3 && isUuid(lid)) {
      try {
        sid = (await q(ctx.sb.rpc('start_conversation', { ...args, p_id: lid }))) as string;
      } catch (e) {
        if (!isSchemaMissing(e)) throw e;
        sid = (await q(ctx.sb.rpc('start_conversation', args))) as string;
      }
    } else {
      sid = (await q(ctx.sb.rpc('start_conversation', args))) as string;
    }
    if (sid !== lid) {
      ctx.convL2R.set(lid, sid);
      ctx.convR2L.set(sid, lid);
      absorbConversation(ctx, lid, sid);
    }
    ctx.confirmedConvs.add(lid);
    return sid;
  })();
  ctx.pendingConvs.set(lid, run);
  const clear = () => ctx.pendingConvs.delete(lid);
  run.then(clear, clear);
  return run;
}

/* ---------------- messages ---------------- */

const patchMessage = (ctx: Ctx, cid: string, mid: string, patch: Partial<Message>) =>
  ctx.store.setState((s) => (s.messages[cid] ? { messages: { ...s.messages, [cid]: s.messages[cid]!.map((m) => (m.id === mid ? { ...m, ...patch } : m)) } } : {}));

/** Upload (if needed) and insert one locally-created message; pending → sent, or failed. */
export async function deliverMessage(ctx: Ctx, cid: string, mid0: string): Promise<void> {
  let mid = mid0;
  if (!isUuid(mid)) {
    // legacy local id → uuid so the server accepts it
    mid = uid();
    patchMessage(ctx, cid, mid0, { id: mid });
  }
  const find = () => ctx.store.getState().messages[cid]?.find((m) => m.id === mid);
  const msg = find();
  if (!msg) return;
  try {
    const sid = await ensureConversation(ctx, cid);
    let mediaPath: string | null = null;
    if (msg.type === 'image' && msg.imageUri) {
      mediaPath = isLocalUri(msg.imageUri)
        ? await ctx.upload('chat-media', `${ctx.userId}/${sid}/${msg.id}.jpg`, msg.imageUri)
        : pathFromUrl(ctx, 'chat-media', msg.imageUri);
    } else if (msg.type === 'story_reply' && msg.storyImage && !isLocalUri(msg.storyImage)) {
      mediaPath = msg.storyImage; // public story URL (resolved as-is on read)
    }
    const current = find() ?? msg;
    const row = messageToRow(ctx, current, sid, mediaPath, ctx.v3);
    if (row.reply_to_id && !isUuid(row.reply_to_id)) row.reply_to_id = null;
    let { error } = await ctx.sb.from('messages').insert(row);
    if (error && errCode(error) === '23503' && row.reply_to_id) {
      // quoted message never reached the server — send without the quote
      row.reply_to_id = null;
      ({ error } = await ctx.sb.from('messages').insert(row));
    }
    if (error && errCode(error) !== '23505') throw error; // 23505 = already stored by an earlier attempt
    const now = find();
    if (now && now.status === 'pending') patchMessage(ctx, cid, mid, { status: 'sent' });
  } catch (e) {
    if (!ctx.alive) return;
    patchMessage(ctx, cid, mid, { status: 'failed' });
    toast(friendly(e, 'Message not sent. Tap it to retry.'));
  }
}
