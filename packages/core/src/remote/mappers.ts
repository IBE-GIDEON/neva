/** Rows ⇄ core types (types.ts). The only place that knows both shapes. */
import { palettes } from '../theme';
import type { Conversation, Listing, Message, NotificationItem, Profile, Report, Review, Story, VerificationLabel } from '../types';
import { type Ctx, publicUrl, toLocalConv, toLocalUser, toRemoteUser, ts } from './context';
import type {
  ConversationRow,
  ListingAttributeRow,
  ListingMediaRow,
  ListingRow,
  MemberRow,
  MessageRow,
  NotificationRow,
  ProfileRow,
  ReactionRow,
  ReportRow,
  ReviewRow,
  StoryRow,
} from './rows';

const tones = palettes.dark.avatarTones;
/** Deterministic avatar fill (no column for it). */
export const avatarColorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return tones[Math.abs(h) % tones.length]!;
};

export type ProfileExtras = {
  verifications?: VerificationLabel[];
  followers?: number;
  following?: number;
  rating?: { avg: number; count: number };
};

export function profileFromRow(ctx: Ctx, r: ProfileRow, x: ProfileExtras = {}): Profile {
  const id = toLocalUser(ctx, r.id);
  return {
    id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: avatarColorFor(r.id),
    avatarUri: publicUrl(ctx, 'avatars', r.avatar_path),
    coverUri: publicUrl(ctx, 'avatars', r.cover_path),
    bio: r.bio ?? undefined,
    city: r.city,
    isSeller: r.is_seller,
    shopName: r.shop_name ?? undefined,
    shopType: r.shop_type ?? undefined,
    verifications: x.verifications ?? [],
    followers: x.followers ?? 0,
    following: x.following ?? 0,
    joinedAt: ts(r.created_at) ?? Date.now(),
    online: id === 'me' ? true : false,
    lastSeenAt: ts(r.last_seen_at),
    rating: x.rating,
  };
}

/** Minimal profile from the search_people RPC (id, username, display_name, avatar_path, city). */
export function profileFromSearch(ctx: Ctx, r: { id: string; username: string; display_name: string; avatar_path: string | null; city: string }): Profile {
  return {
    id: toLocalUser(ctx, r.id),
    username: r.username,
    displayName: r.display_name,
    avatarColor: avatarColorFor(r.id),
    avatarUri: publicUrl(ctx, 'avatars', r.avatar_path),
    city: r.city,
    isSeller: false,
    verifications: [],
    followers: 0,
    following: 0,
    joinedAt: Date.now(),
  };
}

export function listingFromRow(ctx: Ctx, r: ListingRow, media: ListingMediaRow[], attrs: ListingAttributeRow[]): Listing {
  return {
    id: r.id,
    sellerId: toLocalUser(ctx, r.seller_id),
    title: r.title,
    description: r.description ?? '',
    categoryId: r.category_id,
    customCategory: r.custom_category ?? undefined,
    subcategory: r.subcategory ?? undefined,
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    condition: r.condition,
    priceMinor: Number(r.price_minor),
    currency: 'NGN',
    negotiable: r.negotiable,
    city: r.city,
    area: r.area ?? undefined,
    pickup: r.pickup,
    delivery: r.delivery,
    images: media
      .filter((m) => m.media_type === 'image')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => publicUrl(ctx, 'listing-media', m.storage_path)!),
    attributes: Object.fromEntries(
      attrs.map((a) => [a.attribute_key, a.value_text ?? (a.value_num != null ? String(a.value_num) : a.value_bool != null ? (a.value_bool ? 'Yes' : 'No') : '')]),
    ),
    status: r.status,
    createdAt: ts(r.created_at) ?? Date.now(),
    publishedAt: ts(r.published_at),
    views: r.views,
    saves: r.saves,
    enquiries: r.enquiries,
    promoted: r.promoted || undefined,
  };
}

export function listingToRow(ctx: Ctx, l: Listing) {
  return {
    id: l.id,
    seller_id: ctx.userId, // overwritten server-side by enforce_listing_owner
    title: l.title,
    description: l.description ?? '',
    category_id: l.categoryId,
    custom_category: l.categoryId === 'other' ? l.customCategory?.slice(0, 40) ?? null : null,
    subcategory: l.subcategory?.slice(0, 40) ?? null,
    brand: l.brand ?? null,
    model: l.model ?? null,
    condition: l.condition,
    price_minor: Math.round(l.priceMinor),
    currency: 'NGN' as const,
    negotiable: l.negotiable,
    city: l.city,
    area: l.area ?? null,
    pickup: l.pickup || !l.delivery, // CHECK (pickup or delivery)
    delivery: l.delivery,
    status: l.status,
  };
}

/**
 * @param mine my conversation_members row; @param other the other member's row (only readable with 0003).
 */
export function conversationFromRow(
  ctx: Ctx,
  r: ConversationRow,
  mine: MemberRow | undefined,
  unread: number,
  snapshotImage: string | undefined,
): Conversation {
  const other = r.buyer_id === ctx.userId ? r.seller_id : r.buyer_id;
  const snap = r.listing_snapshot;
  return {
    id: toLocalConv(ctx, r.id),
    participantId: toLocalUser(ctx, other),
    listingId: r.listing_id ?? undefined,
    listingSnapshot:
      snap && snap.title
        ? {
            title: snap.title,
            priceMinor: Number(snap.price_minor ?? 0),
            condition: snap.condition ?? 'used_good',
            image: snapshotImage ?? publicUrl(ctx, 'listing-media', snap.image) ?? '',
          }
        : undefined,
    status: mine?.archived_at ? 'archived' : r.status === 'restricted' ? 'blocked' : r.status,
    pinned: !!mine?.pinned_at,
    muted: !!mine?.muted_at,
    unread,
    createdAt: ts(r.created_at) ?? Date.now(),
    lastMessageAt: ts(r.last_message_at) ?? Date.now(),
  };
}

/**
 * @param imageUrl resolved URL for chat-media (signed) — resolved by the caller.
 * @param otherReadAt the other member's last_read_at (0003), for read ticks on my messages.
 * @param myReadAt my last_read_at, for incoming message state.
 */
export function messageFromRow(
  ctx: Ctx,
  r: MessageRow,
  reactions: ReactionRow[],
  imageUrl: string | undefined,
  myReadAt: number | undefined,
  otherReadAt: number | undefined,
): Message {
  const createdAt = ts(r.created_at) ?? Date.now();
  const mine = r.sender_id === ctx.userId;
  const deleted = !!r.deleted_at;
  const story = r.type === 'story_reply' && r.media_path ? publicUrl(ctx, 'stories', r.media_path) : undefined;
  return {
    id: r.id,
    conversationId: toLocalConv(ctx, r.conversation_id),
    senderId: toLocalUser(ctx, r.sender_id),
    type: deleted ? 'text' : r.type,
    body: deleted ? undefined : r.body ?? undefined,
    imageUri: deleted || r.type !== 'image' ? undefined : imageUrl,
    listingId: r.listing_id ?? undefined,
    storyImage: deleted ? undefined : story,
    offer: r.type === 'offer' && r.offer_amount_minor ? { amountMinor: Number(r.offer_amount_minor), state: r.offer_state ?? 'pending' } : undefined,
    voice: r.type === 'voice' ? { seconds: r.meta?.voiceSeconds ?? 1, uri: deleted ? undefined : imageUrl } : undefined,
    replyToId: r.reply_to_id ?? undefined,
    reactions: reactions.length ? Object.fromEntries(reactions.map((x) => [toLocalUser(ctx, x.user_id), x.emoji])) : undefined,
    status: mine ? (otherReadAt && otherReadAt >= createdAt ? 'read' : 'sent') : myReadAt && myReadAt >= createdAt ? 'read' : 'delivered',
    createdAt,
    deleted: deleted || undefined,
  };
}

export function messageToRow(ctx: Ctx, m: Message, serverConvId: string, mediaPath: string | null, v3: boolean) {
  return {
    id: m.id,
    client_id: m.id,
    conversation_id: serverConvId,
    sender_id: ctx.userId, // overwritten by enforce_message_sender
    type: m.type,
    body: m.body ?? null,
    media_path: mediaPath,
    listing_id: m.listingId ?? null,
    offer_amount_minor: m.offer ? Math.round(m.offer.amountMinor) : null,
    offer_state: m.offer ? m.offer.state : null,
    reply_to_id: m.replyToId ?? null,
    ...(v3 && m.voice ? { meta: { voiceSeconds: m.voice.seconds } } : {}),
  };
}

export function storyFromRow(ctx: Ctx, r: StoryRow, viewers?: number): Story {
  return {
    id: r.id,
    userId: toLocalUser(ctx, r.user_id),
    imageUri: r.media_type === 'video' ? undefined : publicUrl(ctx, 'stories', r.media_path),
    videoUri: r.media_type === 'video' ? publicUrl(ctx, 'stories', r.media_path) : undefined,
    videoSeconds: r.media_type === 'video' && r.duration_seconds ? Number(r.duration_seconds) : undefined,
    text: r.text ?? undefined,
    bg: r.bg ?? undefined,
    caption: r.caption ?? undefined,
    listingId: r.listing_id ?? undefined,
    createdAt: ts(r.created_at) ?? Date.now(),
    viewers,
  };
}

export function reviewFromRow(ctx: Ctx, r: ReviewRow): Review {
  return {
    id: r.id,
    reviewerId: toLocalUser(ctx, r.reviewer_id),
    sellerId: toLocalUser(ctx, r.seller_id),
    listingId: r.listing_id ?? undefined,
    rating: r.rating,
    text: r.text ?? '',
    verificationType: r.verification_type === 'unverified' ? 'unverified' : 'conversation',
    createdAt: ts(r.created_at) ?? Date.now(),
  };
}

export function reportFromRow(r: ReportRow): Report {
  return {
    id: r.id,
    caseId: r.case_id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    details: r.details ?? undefined,
    status: r.status,
    createdAt: ts(r.created_at) ?? Date.now(),
  };
}

export function reportToRow(ctx: Ctx, r: Report) {
  return {
    id: r.id,
    case_id: r.caseId,
    reporter_id: ctx.userId,
    target_type: r.targetType,
    target_id: r.targetType === 'user' ? toRemoteUser(ctx, r.targetId) : r.targetId,
    reason: r.reason,
    details: r.details?.slice(0, 1000) ?? null,
  };
}

const NOTIF_TYPES: NotificationItem['type'][] = ['message', 'follow', 'new_listing', 'price_drop', 'moderation', 'security', 'offer', 'system'];
const NOTIF_TITLES: Record<NotificationItem['type'], string> = {
  message: 'New message',
  follow: 'New follower',
  new_listing: 'New listing',
  price_drop: 'Price drop',
  moderation: 'Moderation update',
  security: 'Security alert',
  offer: 'New offer',
  system: 'Neva',
};

/** payload: { title?, body?, actor_id?, listing_id?, conversation_id? } — no sensitive message content. */
export function notificationFromRow(ctx: Ctx, r: NotificationRow): NotificationItem {
  const p = (r.payload ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  const type = (NOTIF_TYPES as string[]).includes(r.type) ? (r.type as NotificationItem['type']) : 'system';
  const actor = str('actor_id');
  const conv = str('conversation_id');
  return {
    id: r.id,
    type,
    title: str('title') ?? NOTIF_TITLES[type],
    body: str('body') ?? '',
    actorId: actor ? toLocalUser(ctx, actor) : undefined,
    listingId: str('listing_id'),
    conversationId: conv ? toLocalConv(ctx, conv) : undefined,
    createdAt: ts(r.created_at) ?? Date.now(),
    read: !!r.read_at,
  };
}

/** Settings stored server-side in profile_private.settings (theme stays per device). */
export const syncedSettingKeys = ['readReceipts', 'showLastSeen', 'lockScreenPreview', 'notif', 'statusPrivacy', 'personalization', 'discoverable'] as const;
