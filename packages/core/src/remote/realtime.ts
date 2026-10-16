/** Realtime: messages, reactions, conversations, memberships, notifications, stories → store. */
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { ME_ID } from '../constants';
import { useLive } from '../store';
import type { Message } from '../types';
import { type Ctx, toLocalConv, toLocalUser, ts } from './context';
import { applyConversations, applyOtherRead, ensureListings, ensureProfiles, fetchConversations, signChatMedia } from './load';
import { messageFromRow, notificationFromRow, storyFromRow } from './mappers';
import type { ConversationRow, MemberRow, MessageRow, NotificationRow, ReactionRow, StoryRow } from './rows';

type Payload<T extends Record<string, unknown>> = RealtimePostgresChangesPayload<T>;
type Run = (fn: () => void | Promise<void>) => void;

const loading = new Set<string>();

/** Load a conversation I don't have yet (someone messaged me, or a hidden chat got a new message). */
async function loadConversation(ctx: Ctx, serverId: string) {
  if (loading.has(serverId)) return;
  loading.add(serverId);
  try {
    const data = await fetchConversations(ctx, [serverId]);
    if (!ctx.alive || !data.conversations.length) return;
    await Promise.all([ensureProfiles(ctx, data.userIds), ensureListings(ctx, data.listingIds)]);
    if (!ctx.alive) return;
    applyConversations(ctx, data, false);
    if (data.otherReadAt.size) applyOtherRead(ctx, data.otherReadAt);
  } catch {
    /* picked up on next connect */
  } finally {
    loading.delete(serverId);
  }
}

async function onMessage(ctx: Ctx, p: Payload<MessageRow>) {
  if (p.eventType === 'DELETE') return;
  const row = p.new as MessageRow;
  const cid = toLocalConv(ctx, row.conversation_id);
  if (!ctx.store.getState().conversations[cid]) return loadConversation(ctx, row.conversation_id);

  let imageUrl: string | undefined;
  if (row.type === 'image' && row.media_path && !row.deleted_at) imageUrl = (await signChatMedia(ctx, [row.media_path])).get(row.media_path);
  if (row.listing_id) void ensureListings(ctx, [row.listing_id]).catch(() => {});
  if (!ctx.alive) return;

  const incoming = row.sender_id !== ctx.userId;
  ctx.store.setState((s) => {
    const conv = s.conversations[cid];
    if (!conv) return {};
    const list = s.messages[cid] ?? [];
    const existing = list.find((m) => m.id === row.id);
    const fresh = messageFromRow(ctx, row, [], imageUrl, undefined, undefined);
    let next: Message[];
    if (existing) {
      const merged: Message = {
        ...existing,
        ...fresh,
        reactions: existing.reactions,
        starred: existing.starred,
        imageUri: fresh.deleted ? undefined : fresh.imageUri ?? existing.imageUri,
        storyImage: fresh.storyImage ?? existing.storyImage,
        status: incoming ? (existing.status === 'read' ? 'read' : fresh.status) : existing.status === 'read' ? 'read' : 'sent',
      };
      next = list.map((m) => (m.id === row.id ? merged : m));
    } else {
      next = [...list, fresh];
    }
    next.sort((a, b) => a.createdAt - b.createdAt);
    const isNew = p.eventType === 'INSERT' && !existing;
    const active = useLive.getState().activeConversationId === cid;
    return {
      messages: { ...s.messages, [cid]: next },
      conversations: {
        ...s.conversations,
        [cid]: {
          ...conv,
          lastMessageAt: Math.max(conv.lastMessageAt, fresh.createdAt),
          unread: isNew && incoming && !active ? conv.unread + 1 : conv.unread,
        },
      },
    };
  });
}

function onReaction(ctx: Ctx, p: Payload<ReactionRow>) {
  const row = (p.eventType === 'DELETE' ? p.old : p.new) as Partial<ReactionRow>;
  if (!row.message_id || !row.user_id) return;
  const who = toLocalUser(ctx, row.user_id);
  ctx.store.setState((s) => {
    for (const [cid, list] of Object.entries(s.messages)) {
      const idx = list.findIndex((m) => m.id === row.message_id);
      if (idx < 0) continue;
      const m = list[idx]!;
      const reactions = { ...(m.reactions ?? {}) };
      if (p.eventType === 'DELETE') delete reactions[who];
      else reactions[who] = row.emoji!;
      const next = [...list];
      next[idx] = { ...m, reactions: Object.keys(reactions).length ? reactions : undefined };
      return { messages: { ...s.messages, [cid]: next } };
    }
    return {};
  });
}

function onConversation(ctx: Ctx, p: Payload<ConversationRow>) {
  if (p.eventType === 'DELETE') return;
  const row = p.new as ConversationRow;
  const cid = toLocalConv(ctx, row.id);
  const conv = ctx.store.getState().conversations[cid];
  if (!conv) {
    if (p.eventType === 'INSERT') void loadConversation(ctx, row.id);
    return;
  }
  ctx.store.setState((s) => {
    const c = s.conversations[cid];
    if (!c) return {};
    const shared = row.status === 'restricted' ? 'blocked' : row.status;
    const status = c.status === 'archived' && shared === 'active' ? 'archived' : shared === 'archived' ? c.status : shared;
    return { conversations: { ...s.conversations, [cid]: { ...c, status, lastMessageAt: Math.max(c.lastMessageAt, ts(row.last_message_at) ?? 0) } } };
  });
}

function onMember(ctx: Ctx, p: Payload<MemberRow>) {
  if (p.eventType === 'DELETE') return;
  const row = p.new as MemberRow;
  const cid = toLocalConv(ctx, row.conversation_id);
  if (row.user_id !== ctx.userId) {
    const at = ts(row.last_read_at);
    if (at) applyOtherRead(ctx, new Map([[cid, at]]));
    return;
  }
  // my membership changed on another device
  ctx.store.setState((s) => {
    const c = s.conversations[cid];
    if (!c) return {};
    const readAt = ts(row.last_read_at) ?? 0;
    const unreadLeft = (s.messages[cid] ?? []).filter((m) => m.senderId !== ME_ID && !m.deleted && m.createdAt > readAt).length;
    return {
      conversations: {
        ...s.conversations,
        [cid]: {
          ...c,
          pinned: !!row.pinned_at,
          muted: !!row.muted_at,
          status: row.archived_at ? 'archived' : c.status === 'archived' ? 'active' : c.status,
          unread: Math.min(c.unread, unreadLeft),
        },
      },
    };
  });
}

function onNotification(ctx: Ctx, p: Payload<NotificationRow>) {
  if (p.eventType === 'DELETE') {
    const id = (p.old as Partial<NotificationRow>).id;
    if (id) ctx.store.setState((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    return;
  }
  const n = notificationFromRow(ctx, p.new as NotificationRow);
  if (n.actorId && n.actorId !== ME_ID) void ensureProfiles(ctx, [n.actorId]).catch(() => {});
  ctx.store.setState((s) =>
    s.notifications.some((x) => x.id === n.id)
      ? { notifications: s.notifications.map((x) => (x.id === n.id ? n : x)) }
      : { notifications: [n, ...s.notifications] },
  );
}

async function onStory(ctx: Ctx, p: Payload<StoryRow>) {
  if (p.eventType === 'DELETE') {
    const id = (p.old as Partial<StoryRow>).id;
    if (id) ctx.store.setState((s) => ({ stories: s.stories.filter((x) => x.id !== id) }));
    return;
  }
  if (p.eventType !== 'INSERT') return;
  const row = p.new as StoryRow;
  const local = toLocalUser(ctx, row.user_id);
  if (local !== ME_ID && !ctx.store.getState().follows.includes(local)) return;
  await ensureProfiles(ctx, [row.user_id]).catch(() => {});
  if (!ctx.alive) return;
  const story = storyFromRow(ctx, row, local === ME_ID ? 0 : undefined);
  ctx.store.setState((s) => (s.stories.some((x) => x.id === story.id) ? {} : { stories: [...s.stories, story] }));
}

/**
 * Subscribe to everything relevant. RLS applies to realtime, so unfiltered tables only deliver rows I may read.
 * `run` defers handlers until the initial load has finished. `onResubscribe` fires after a dropped connection recovers.
 */
export function subscribe(ctx: Ctx, run: Run, onResubscribe: () => void): RealtimeChannel {
  let dropped = false;
  const guard =
    <T,>(fn: (ctx: Ctx, p: T) => unknown) =>
    (p: T) =>
      run(async () => {
        if (!ctx.alive) return;
        try {
          await fn(ctx, p);
        } catch {
          /* ignore malformed events */
        }
      });
  const pg = { schema: 'public' } as const;
  const channel = ctx.sb
    .channel(`neva-sync:${ctx.userId}:${Date.now()}`)
    .on('postgres_changes', { ...pg, event: '*', table: 'messages' }, guard(onMessage))
    .on('postgres_changes', { ...pg, event: '*', table: 'message_reactions' }, guard(onReaction))
    .on('postgres_changes', { ...pg, event: '*', table: 'conversations' }, guard(onConversation))
    .on('postgres_changes', { ...pg, event: 'UPDATE', table: 'conversation_members' }, guard(onMember))
    .on('postgres_changes', { ...pg, event: '*', table: 'notifications', filter: `recipient_id=eq.${ctx.userId}` }, guard(onNotification))
    .on('postgres_changes', { ...pg, event: '*', table: 'stories' }, guard(onStory))
    .subscribe((status) => {
      if (!ctx.alive) return;
      if (status === 'SUBSCRIBED') {
        if (dropped) onResubscribe();
        dropped = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        dropped = true;
      }
    });
  return channel;
}
