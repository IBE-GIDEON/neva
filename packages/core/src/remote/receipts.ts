/**
 * Delivery and read receipts (WhatsApp-style ticks), using supabase/migrations/0005.
 * ✓ sent (server has it) · ✓✓ delivered (their device received it) · blue ✓✓ read (they opened it, and both
 * people have Read receipts on). Timestamps come from the server clock (mark_delivered / mark_read RPCs).
 */
import { ME_ID } from '../constants';
import type { Message } from '../types';
import { type Ctx, toRemoteConv } from './context';

const lastDelivered = new WeakMap<Ctx, Map<string, number>>();

/** Tell the server my device has this conversation's messages (all conversations when no id). Throttled. */
export function markDelivered(ctx: Ctx, localConvId?: string) {
  if (!ctx.v5 || !ctx.alive) return;
  let seen = lastDelivered.get(ctx);
  if (!seen) lastDelivered.set(ctx, (seen = new Map()));
  const key = localConvId ?? '*';
  const now = Date.now();
  if ((seen.get(key) ?? 0) > now - 1500) return;
  seen.set(key, now);
  const p_conv = localConvId ? toRemoteConv(ctx, localConvId) : null;
  void ctx.sb.rpc('mark_delivered', { p_conv }).then(() => {});
}

/** Server-side "I read this chat": unread bookkeeping always, blue ticks only if my Read receipts are on. */
export async function markReadRemote(ctx: Ctx, serverConvId: string) {
  const seen = ctx.store.getState().settings.readReceipts;
  const { error } = await ctx.sb.rpc('mark_read', { p_conv: serverConvId, p_seen: seen });
  if (error) throw error;
}

const upgrade = (list: Message[], at: number, to: 'delivered' | 'read') =>
  list.map((m) =>
    m.senderId === ME_ID && !m.deleted && m.createdAt <= at && (m.status === 'sent' || (to === 'read' && m.status === 'delivered')) ? { ...m, status: to } : m,
  );

/** Mark my messages delivered up to each conversation's `at`. */
export function applyOtherDelivered(ctx: Ctx, deliveredAt: Map<string, number>) {
  if (!deliveredAt.size) return;
  ctx.store.setState((s) => {
    const messages = { ...s.messages };
    for (const [cid, at] of deliveredAt) if (messages[cid]) messages[cid] = upgrade(messages[cid]!, at, 'delivered');
    return { messages };
  });
}

/** Blue ticks up to each conversation's `at` — skipped entirely when my own Read receipts are off (WhatsApp rule). */
export function applyOtherSeen(ctx: Ctx, seenAt: Map<string, number>) {
  if (!seenAt.size || !ctx.store.getState().settings.readReceipts) return;
  ctx.store.setState((s) => {
    const messages = { ...s.messages };
    for (const [cid, at] of seenAt) if (messages[cid]) messages[cid] = upgrade(messages[cid]!, at, 'read');
    return { messages };
  });
}
