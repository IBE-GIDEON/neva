/** Reads from the server and merges into the store (server wins; unsent local messages are kept). */
import { applyOtherDelivered, markDelivered } from './receipts';
import { ME_ID } from '../constants';
import type { State } from '../store';
import type { Conversation, Listing, Message, Profile, Review, Story } from '../types';
import { type Ctx, friendly, isNetworkError, iso, q, selectIn, toast, toLocalUser, ts, uniq } from './context';
import {
  conversationFromRow,
  listingFromRow,
  messageFromRow,
  notificationFromRow,
  profileFromRow,
  reportFromRow,
  reviewFromRow,
  storyFromRow,
  syncedSettingKeys,
} from './mappers';
import type {
  ConversationRow,
  ListingAttributeRow,
  ListingMediaRow,
  ListingRow,
  MemberRow,
  MessageRow,
  NotificationRow,
  ProfilePrivateRow,
  ProfileRow,
  ReactionRow,
  ReportRow,
  ReviewRow,
  StoryRow,
  VerificationRow,
} from './rows';
import { createProfileRemote, upsertListingRemote } from './writes';

const FEED_LIMIT = 300;
const CONV_LIMIT = 100;
const MSG_LIMIT = 40;
const SIGNED_URL_TTL = 7 * 24 * 3600;

/* ---------------- profiles ---------------- */

export const ratingsFrom = (reviews: Review[]) => {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const a = acc.get(r.sellerId) ?? { sum: 0, count: 0 };
    a.sum += r.rating;
    a.count += 1;
    acc.set(r.sellerId, a);
  }
  return new Map([...acc].map(([k, v]) => [k, { avg: Math.round((v.sum / v.count) * 10) / 10, count: v.count }]));
};

/** Profiles (+ verifications, follower counts, ratings) and the visible reviews of those users as sellers. */
export async function fetchProfiles(ctx: Ctx, remoteIds: string[]): Promise<{ users: Record<string, Profile>; reviews: Review[] }> {
  const ids = uniq(remoteIds);
  if (!ids.length) return { users: {}, reviews: [] };
  const sb = ctx.sb;
  const [rows, verifs, reviewRows, counts] = await Promise.all([
    selectIn<ProfileRow>(ids, (p) => sb.from('profiles').select('*').in('id', p)),
    selectIn<VerificationRow>(ids, (p) => sb.from('seller_verifications').select('seller_id,label').in('seller_id', p)),
    selectIn<ReviewRow>(ids, (p) => sb.from('reviews').select('*').in('seller_id', p).order('created_at', { ascending: false })),
    followCounts(ctx, ids),
  ]);
  const reviews = reviewRows.map((r) => reviewFromRow(ctx, r));
  for (const r of reviewRows) ctx.remoteReviews.add(r.id);
  const ratings = ratingsFrom(reviews);
  const users: Record<string, Profile> = {};
  for (const r of rows) {
    const local = toLocalUser(ctx, r.id);
    users[local] = profileFromRow(ctx, r, {
      verifications: verifs.filter((v) => v.seller_id === r.id).map((v) => v.label),
      followers: counts.followers.get(r.id) ?? 0,
      following: counts.following.get(r.id) ?? 0,
      rating: ratings.get(local),
    });
  }
  return { users, reviews };
}

async function followCounts(ctx: Ctx, ids: string[]) {
  const followers = new Map<string, number>();
  const following = new Map<string, number>();
  if (ctx.v3) {
    try {
      const rows = await q(ctx.sb.rpc('profile_stats', { p_ids: ids }));
      for (const r of (rows ?? []) as { id: string; followers: number; following: number }[]) {
        followers.set(r.id, Number(r.followers));
        following.set(r.id, Number(r.following));
      }
      return { followers, following };
    } catch {
      /* fall through to row counting */
    }
  }
  // Without the profile_stats RPC: count rows (bounded by the API row limit, so very large accounts are approximate).
  const [a, b] = await Promise.all([
    selectIn<{ followed_id: string }>(ids, (p) => ctx.sb.from('follows').select('followed_id').in('followed_id', p)),
    selectIn<{ follower_id: string }>(ids, (p) => ctx.sb.from('follows').select('follower_id').in('follower_id', p)),
  ]);
  for (const r of a) followers.set(r.followed_id, (followers.get(r.followed_id) ?? 0) + 1);
  for (const r of b) following.set(r.follower_id, (following.get(r.follower_id) ?? 0) + 1);
  return { followers, following };
}

/** Fetch and merge profiles that aren't in the store yet (used by realtime and search). */
export async function ensureProfiles(ctx: Ctx, remoteIds: string[]) {
  const s = ctx.store.getState();
  const missing = uniq(remoteIds).filter((id) => !s.users[toLocalUser(ctx, id)]);
  if (!missing.length) return;
  const { users, reviews } = await fetchProfiles(ctx, missing);
  if (!ctx.alive) return;
  ctx.store.setState((st) => ({
    users: { ...users, ...st.users },
    reviews: [...st.reviews, ...reviews.filter((r) => !st.reviews.some((x) => x.id === r.id))],
  }));
}

/* ---------------- listings ---------------- */

export async function hydrateListings(ctx: Ctx, rows: ListingRow[]): Promise<Record<string, Listing>> {
  const ids = rows.map((r) => r.id);
  const [media, attrs] = await Promise.all([
    selectIn<ListingMediaRow>(ids, (p) => ctx.sb.from('listing_media').select('*').in('listing_id', p)),
    selectIn<ListingAttributeRow>(ids, (p) => ctx.sb.from('listing_attributes').select('*').in('listing_id', p)),
  ]);
  const out: Record<string, Listing> = {};
  for (const r of rows) {
    out[r.id] = listingFromRow(ctx, r, media.filter((m) => m.listing_id === r.id), attrs.filter((a) => a.listing_id === r.id));
    ctx.remoteListings.add(r.id);
  }
  return out;
}

export async function fetchListingsById(ctx: Ctx, ids: string[]) {
  const rows = await selectIn<ListingRow>(uniq(ids), (p) => ctx.sb.from('listings').select('*').in('id', p));
  return hydrateListings(ctx, rows);
}

export async function ensureListings(ctx: Ctx, ids: string[]) {
  const s = ctx.store.getState();
  const missing = uniq(ids).filter((id) => !s.listings[id]);
  if (!missing.length) return;
  const listings = await fetchListingsById(ctx, missing);
  if (!ctx.alive) return;
  ctx.store.setState((st) => ({ listings: { ...listings, ...st.listings } }));
}

/* ---------------- conversations ---------------- */

type ConvRowFull = ConversationRow & { conversation_members: MemberRow[]; messages: (MessageRow & { message_reactions: ReactionRow[] })[] };

export async function signChatMedia(ctx: Ctx, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = uniq(paths).filter((p) => !/^https?:/i.test(p));
  if (!list.length) return out;
  try {
    const { data } = await ctx.sb.storage.from('chat-media').createSignedUrls(list, SIGNED_URL_TTL);
    for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  } catch {
    /* images show as unavailable; next connect re-signs */
  }
  return out;
}

export type LoadedConversations = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  userIds: string[];
  listingIds: string[];
  /** Other member's read time per local conversation id (0005 seen_at, else 0003 last_read_at). */
  otherReadAt: Map<string, number>;
  /** Other member's delivered time per local conversation id (0005). */
  otherDeliveredAt: Map<string, number>;
};

/** Load my conversations (optionally only `serverIds`) with members and recent messages + reactions. */
export async function fetchConversations(ctx: Ctx, serverIds?: string[]): Promise<LoadedConversations> {
  let b = ctx.sb
    .from('conversations')
    .select('*, conversation_members(*), messages(*, message_reactions(*))')
    .order('last_message_at', { ascending: false })
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(MSG_LIMIT, { referencedTable: 'messages' })
    .limit(CONV_LIMIT);
  if (serverIds) b = b.in('id', serverIds);
  const rows = ((await q(b)) ?? []) as ConvRowFull[];

  const imagePaths = rows.flatMap((r) => r.messages.filter((m) => m.type === 'image' && m.media_path && !m.deleted_at).map((m) => m.media_path!));
  const signed = await signChatMedia(ctx, imagePaths);

  const out: LoadedConversations = { conversations: [], messages: {}, userIds: [], listingIds: [], otherReadAt: new Map(), otherDeliveredAt: new Map() };
  for (const r of rows) {
    const mine = r.conversation_members.find((m) => m.user_id === ctx.userId);
    const other = r.conversation_members.find((m) => m.user_id !== ctx.userId);
    // deleted-for-me (0003): hidden until a newer message arrives
    if (mine?.hidden_at && (ts(r.last_message_at) ?? 0) <= (ts(mine.hidden_at) ?? 0)) continue;
    const clearedAt = ts(mine?.cleared_at) ?? 0;
    const myReadAt = ts(mine?.last_read_at);
    // Blue ticks only when both sides allow it: theirs via seen_at (0005), mine via settings.readReceipts.
    const receiptsOn = ctx.store.getState().settings.readReceipts;
    const otherReadAt = receiptsOn ? ts(ctx.v5 ? other?.seen_at : other?.last_read_at) : undefined;
    const otherDeliveredAt = ctx.v5 ? ts(other?.delivered_at) : undefined;
    const msgs = r.messages
      .filter((m) => (ts(m.created_at) ?? 0) > clearedAt)
      .map((m) => messageFromRow(ctx, m, m.message_reactions ?? [], m.media_path ? signed.get(m.media_path) : undefined, myReadAt, otherReadAt))
      .sort((a, b2) => a.createdAt - b2.createdAt);
    const unread = msgs.filter((m) => m.senderId !== ME_ID && !m.deleted && (!myReadAt || m.createdAt > myReadAt)).length;
    const conv = conversationFromRow(ctx, r, mine, unread, undefined);
    out.conversations.push(conv);
    out.messages[conv.id] = msgs;
    if (otherReadAt) out.otherReadAt.set(conv.id, otherReadAt);
    if (otherDeliveredAt) out.otherDeliveredAt.set(conv.id, otherDeliveredAt);
    out.userIds.push(r.buyer_id, r.seller_id);
    if (r.listing_id) out.listingIds.push(r.listing_id);
    for (const m of r.messages) if (m.listing_id) out.listingIds.push(m.listing_id);
    ctx.confirmedConvs.add(conv.id);
  }
  return out;
}

/** My listings that exist only on this device (not in the server result). */
function unsyncedMine(local: Record<string, Listing>, server: Record<string, Listing>): Record<string, Listing> {
  const out: Record<string, Listing> = {};
  for (const l of Object.values(local)) if (l.sellerId === ME_ID && !server[l.id] && l.status !== 'removed') out[l.id] = l;
  return out;
}

/** Server list wins; keep local unsent (pending/failed) messages and anything newer than `keepSince`. */
export function mergeMessages(local: Message[] | undefined, server: Message[], keepSince = Infinity): Message[] {
  const byId = new Map((local ?? []).map((m) => [m.id, m]));
  const serverIds = new Set(server.map((m) => m.id));
  const merged = server.map((m) => {
    const l = byId.get(m.id);
    if (!l) return m;
    return { ...m, starred: l.starred, imageUri: m.imageUri ?? (m.deleted ? undefined : l.imageUri), storyImage: m.storyImage ?? l.storyImage };
  });
  const keep = (local ?? []).filter((m) => !serverIds.has(m.id) && (m.status === 'pending' || m.status === 'failed' || m.createdAt >= keepSince));
  return [...merged, ...keep].sort((a, b) => a.createdAt - b.createdAt);
}

/** Apply loaded conversations. `replace` drops server-unknown conversations except local ones still holding unsent messages. */
export function applyConversations(ctx: Ctx, data: LoadedConversations, replace: boolean, keepSince = Infinity) {
  ctx.store.setState((s) => {
    const conversations: Record<string, Conversation> = replace ? {} : { ...s.conversations };
    const messages: Record<string, Message[]> = replace ? {} : { ...s.messages };
    for (const c of data.conversations) {
      const prev = s.conversations[c.id];
      const snapshotImage = c.listingSnapshot && !c.listingSnapshot.image ? (s.listings[c.listingId ?? '']?.images[0] ?? prev?.listingSnapshot?.image ?? '') : undefined;
      conversations[c.id] = {
        ...c,
        draft: prev?.draft,
        listingSnapshot: c.listingSnapshot ? { ...c.listingSnapshot, image: snapshotImage ?? c.listingSnapshot.image } : prev?.listingSnapshot,
      };
      messages[c.id] = mergeMessages(s.messages[c.id], data.messages[c.id] ?? [], keepSince);
    }
    if (replace) {
      for (const [id, c] of Object.entries(s.conversations)) {
        if (conversations[id]) continue;
        const local = s.messages[id] ?? [];
        const unsent = local.filter((m) => m.status === 'pending' || m.status === 'failed' || m.createdAt >= keepSince);
        // started (or messaged) while the load was in flight, or still holding unsent messages
        if (unsent.length || c.createdAt >= keepSince) {
          conversations[id] = c;
          messages[id] = unsent;
        }
      }
    }
    return { conversations, messages };
  });
}

/* ---------------- initial load ---------------- */

type MeResult = { profile: ProfileRow | null; priv: ProfilePrivateRow | null };

async function resolveMe(ctx: Ctx): Promise<MeResult> {
  const [profile, priv] = await Promise.all([
    q(ctx.sb.from('profiles').select('*').eq('id', ctx.userId).maybeSingle()) as Promise<ProfileRow | null>,
    q(ctx.sb.from('profile_private').select('*').eq('id', ctx.userId).maybeSingle()) as Promise<ProfilePrivateRow | null>,
  ]);
  const st = ctx.store.getState();
  const sameOwner = !st.syncedUserId || st.syncedUserId === ctx.userId;

  if (profile) {
    if (!sameOwner) ctx.store.setState({ draft: null, viewedStories: [], recentSearches: [] });
    ctx.store.setState((s) => ({
      syncedUserId: ctx.userId,
      auth: s.auth.stage === 'profile' ? { ...s.auth, userId: ctx.userId, stage: 'ready' } : { ...s.auth, userId: ctx.userId },
      interests: priv?.interests?.length ? priv.interests : sameOwner ? s.interests : [],
      settings: priv?.settings ? mergeSettings(s.settings, priv.settings) : s.settings,
    }));
    return { profile, priv };
  }

  // No profile row yet.
  if (sameOwner && st.users[ME_ID] && st.auth.stage !== 'profile') {
    // Profile was set up locally (sign-up flow ran before the connection, or pre-backend device data): create it.
    try {
      const created = await createProfileRemote(ctx, st.users[ME_ID]!, st.interests);
      ctx.store.setState((s) => ({ syncedUserId: ctx.userId, auth: { ...s.auth, userId: ctx.userId } }));
      // Publish my locally-made listings so they aren't lost when the server copy replaces local data.
      const mine = Object.values(ctx.store.getState().listings).filter((l) => l.sellerId === ME_ID && !ctx.remoteListings.has(l.id));
      for (const l of mine) await upsertListingRemote(ctx, l.id).catch(() => {});
      return { profile: created, priv: null };
    } catch (e) {
      if (isNetworkError(e)) throw e;
      // Username taken / invalid: send the user back to profile setup with their details pre-filled.
    }
  }
  ctx.store.setState((s) => {
    const { [ME_ID]: old, ...users } = s.users;
    return {
      users: sameOwner ? s.users : users,
      syncedUserId: ctx.userId,
      auth: { ...s.auth, userId: ctx.userId, stage: 'profile', prefill: s.auth.prefill ?? (old && sameOwner ? { displayName: old.displayName, avatarUri: old.avatarUri } : undefined) },
      ...(sameOwner ? {} : { draft: null, viewedStories: [], recentSearches: [], interests: [] }),
    };
  });
  return { profile: null, priv: null };
}

export function mergeSettings(local: State['settings'], remote: Record<string, unknown>): State['settings'] {
  const next = { ...local } as Record<string, unknown>;
  for (const k of syncedSettingKeys) if (remote[k] !== undefined) next[k] = k === 'notif' ? { ...local.notif, ...(remote[k] as object) } : remote[k];
  return next as State['settings'];
}

export async function initialLoad(ctx: Ctx) {
  const startedAt = Date.now();
  const sb = ctx.sb;
  const me = await resolveMe(ctx);
  if (!ctx.alive) return;

  // Keep last-seen fresh for people who allow it.
  if (me.profile && ctx.store.getState().settings.showLastSeen) void sb.from('profiles').update({ last_seen_at: iso(Date.now()) }).eq('id', ctx.userId).then(() => {});

  const nowIso = iso(Date.now());
  const [followRows, savedRows, blockRows, feedRows, mineRows, convData, storyRows, notifRows, reportRows, myViews] = await Promise.all([
    q(sb.from('follows').select('followed_id').eq('follower_id', ctx.userId)) as Promise<{ followed_id: string }[]>,
    q(sb.from('saved_listings').select('listing_id,created_at').eq('user_id', ctx.userId).order('created_at', { ascending: false })) as Promise<{ listing_id: string }[]>,
    q(sb.from('blocks').select('blocked_id').eq('blocker_id', ctx.userId)) as Promise<{ blocked_id: string }[]>,
    q(sb.from('listings').select('*').eq('status', 'active').order('published_at', { ascending: false }).limit(FEED_LIMIT)) as Promise<ListingRow[]>,
    q(sb.from('listings').select('*').eq('seller_id', ctx.userId).order('created_at', { ascending: false })) as Promise<ListingRow[]>,
    fetchConversations(ctx),
    q(sb.from('stories').select('*').gt('expires_at', nowIso).order('created_at', { ascending: true })) as Promise<StoryRow[]>,
    q(sb.from('notifications').select('*').eq('recipient_id', ctx.userId).order('created_at', { ascending: false }).limit(100)) as Promise<NotificationRow[]>,
    q(sb.from('reports').select('*').eq('reporter_id', ctx.userId).order('created_at', { ascending: false })) as Promise<ReportRow[]>,
    q(sb.from('story_views').select('story_id').eq('viewer_id', ctx.userId)) as Promise<{ story_id: string }[]>,
  ]);
  if (!ctx.alive) return;

  const follows = followRows.map((r) => r.followed_id);
  const blocked = blockRows.map((r) => r.blocked_id);
  const saved = savedRows.map((r) => r.listing_id);

  // listings: feed + mine + saved + those referenced by chats
  const rowById = new Map<string, ListingRow>();
  for (const r of [...feedRows, ...mineRows]) rowById.set(r.id, r);
  const extraIds = uniq([...saved, ...convData.listingIds]).filter((id) => !rowById.has(id));
  const extraRows = await selectIn<ListingRow>(extraIds, (p) => sb.from('listings').select('*').in('id', p));
  for (const r of extraRows) rowById.set(r.id, r);
  const listings = await hydrateListings(ctx, [...rowById.values()]);

  // stories: people I follow + mine
  // RLS returns exactly the statuses I may see (mine, people I follow, people I chat with, public ones).
  const liveStories = storyRows;
  const myStoryIds = liveStories.filter((r) => r.user_id === ctx.userId).map((r) => r.id);
  const viewRows = await selectIn<{ story_id: string }>(myStoryIds, (p) => sb.from('story_views').select('story_id').in('story_id', p));
  const viewCount = new Map<string, number>();
  for (const v of viewRows) viewCount.set(v.story_id, (viewCount.get(v.story_id) ?? 0) + 1);
  const stories: Story[] = liveStories.map((r) => storyFromRow(ctx, r, r.user_id === ctx.userId ? viewCount.get(r.id) ?? 0 : undefined));

  // profiles for everyone referenced
  const userIds = uniq([
    ctx.userId,
    ...[...rowById.values()].map((r) => r.seller_id),
    ...convData.userIds,
    ...follows,
    ...blocked,
    ...liveStories.map((r) => r.user_id),
  ]);
  const { users, reviews: sellerReviews } = await fetchProfiles(ctx, userIds);
  const myReviews = ((await q(sb.from('reviews').select('*').eq('reviewer_id', ctx.userId))) ?? []) as ReviewRow[];
  for (const r of myReviews) ctx.remoteReviews.add(r.id);
  const reviews = [...sellerReviews, ...myReviews.map((r) => reviewFromRow(ctx, r)).filter((r) => !sellerReviews.some((x) => x.id === r.id))];
  if (!ctx.alive) return;

  ctx.store.setState((s) => {
    const meProfile = users[ME_ID] ?? (me.profile ? undefined : s.users[ME_ID]);
    return {
      users: { ...users, ...(meProfile ? { [ME_ID]: { ...meProfile, online: true, following: follows.length } } : {}) },
      // Server copy wins, but never drop my own listings that haven't reached the server yet
      // (still uploading, or a failed save) — they're kept and re-sent below.
      listings: { ...unsyncedMine(s.listings, listings), ...listings },
      follows,
      saved,
      blocked,
      stories,
      viewedStories: uniq([...s.viewedStories, ...myViews.map((v) => v.story_id)]),
      reviews,
      notifications: notifRows.map((r) => notificationFromRow(ctx, r)),
      reports: reportRows.map(reportFromRow),
    };
  });
  applyConversations(ctx, convData, true, startedAt);
  // Re-send my listings that only exist on this device.
  for (const l of Object.values(unsyncedMine(ctx.store.getState().listings, listings))) {
    void upsertListingRemote(ctx, l.id)
      .then(() => ctx.store.setState((s) => (s.listings[l.id] && s.listings[l.id]!.status === 'draft' && l.publishedAt ? { listings: { ...s.listings, [l.id]: { ...s.listings[l.id]!, status: 'active' } } } : {})))
      .catch((e) => toast(friendly(e, `Couldn’t publish “${l.title}”. It’s kept as a draft on this device.`)));
  }
  // Read receipts for my messages (0003 lets members see each other's last_read_at).
  if (convData.otherReadAt.size) applyOtherRead(ctx, convData.otherReadAt);
  applyOtherDelivered(ctx, convData.otherDeliveredAt);
  // My device now has everything: tell senders their messages were delivered.
  markDelivered(ctx);
}

export function applyOtherRead(ctx: Ctx, readAt: Map<string, number>) {
  ctx.store.setState((s) => {
    const messages = { ...s.messages };
    for (const [cid, at] of readAt) {
      const list = messages[cid];
      if (!list) continue;
      messages[cid] = list.map((m) => (m.senderId === ME_ID && (m.status === 'sent' || m.status === 'delivered') && m.createdAt <= at ? { ...m, status: 'read' } : m));
    }
    return { messages };
  });
}
