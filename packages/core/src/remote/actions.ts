/**
 * Write-through wrappers. Each wrapper keeps the store's local optimistic behaviour (it calls the original
 * action, except sendMessage/retryMessage which are re-implemented without the local "fake sent" timer),
 * then persists remotely. On failure: messages → 'failed' (retry UI), everything else → reverted + toast.
 */
import { markReadRemote } from './receipts';
import { ME_ID } from '../constants';
import { uid } from '../format';
import type { State } from '../store';
import type { Conversation, Message, Review } from '../types';
import {
  type Ctx,
  errCode,
  friendly,
  isNetworkError,
  isUuid,
  iso,
  later,
  publicUrl,
  q,
  storeImage,
  toRemoteConv,
  toRemoteUser,
  toast,
} from './context';
import { ensureProfiles } from './load';
import { profileFromSearch, reportToRow } from './mappers';
import { createProfileRemote, deliverMessage, ensureConversation, friendlyProfileError, settingsPayload, upsertListingRemote } from './writes';

const WRAPPED = [
  'completeProfile',
  'completeInterests',
  'updateProfile',
  'signOut',
  'clearDeviceData',
  'searchPeople',
  'startConversation',
  'sendMessage',
  'retryMessage',
  'respondToOffer',
  'react',
  'deleteMessage',
  'markRead',
  'togglePin',
  'toggleMute',
  'setArchived',
  'deleteConversation',
  'clearChat',
  'toggleFollow',
  'toggleSave',
  'toggleBlock',
  'submitReport',
  'saveReview',
  'deleteReview',
  'addStory',
  'deleteStory',
  'markStoryViewed',
  'publishDraft',
  'setListingStatus',
  'bumpView',
  'markNotificationsRead',
  'deleteNotification',
  'clearNotifications',
  'updateSettings',
] as const satisfies readonly (keyof State)[];

type Wrapped = (typeof WRAPPED)[number];
export type Originals = Pick<State, Wrapped>;

/** Replace store actions with write-through versions. Returns the originals (restored on disconnect). */
export function installActions(ctx: Ctx, onSignOut: () => void): Originals {
  const { store, sb, userId } = ctx;
  const get = store.getState;
  const set = store.setState;
  const o = Object.fromEntries(WRAPPED.map((k) => [k, get()[k]])) as Originals;

  /** Writes that need my profile row wait for its creation (FKs). */
  let profileWrite: Promise<unknown> = Promise.resolve();
  const afterProfile = <T,>(fn: () => Promise<T>) => profileWrite.then(fn, fn);

  /** Server id for a conversation, or null if it only exists locally (nothing to update remotely). */
  const serverConv = async (cid: string): Promise<string | null> => {
    if (ctx.confirmedConvs.has(cid)) return toRemoteConv(ctx, cid);
    const p = ctx.pendingConvs.get(cid);
    return p ? p.catch(() => null) : null;
  };

  const patchConv = (cid: string, c: Conversation | undefined) =>
    c && set((s) => ({ conversations: { ...s.conversations, [cid]: c } }));
  const findMsg = (cid: string, mid: string) => get().messages[cid]?.find((m) => m.id === mid);
  const patchMsg = (cid: string, mid: string, patch: Partial<Message>) =>
    set((s) => (s.messages[cid] ? { messages: { ...s.messages, [cid]: s.messages[cid]!.map((m) => (m.id === mid ? { ...m, ...patch } : m)) } } : {}));

  /** Run a remote write; on error run `revert` and toast. */
  const write = (fn: () => Promise<unknown>, revert: (() => void) | null, message: string) => {
    void fn().catch((e) => {
      if (!ctx.alive) return;
      revert?.();
      toast(friendly(e, message));
    });
  };
  /** Non-critical writes (view counts, read markers): failures are ignored. */
  const quiet = (fn: () => PromiseLike<unknown>) => {
    try {
      void Promise.resolve(fn()).catch(() => {});
    } catch {
      /* ignore */
    }
  };
  /** Throw when an update/delete matched no rows (usually RLS: not allowed / policy missing). */
  const mustAffect = async (b: PromiseLike<{ data: unknown[] | null; error: unknown }>) => {
    const rows = await q(b);
    if (!rows || !rows.length) throw Object.assign(new Error('not_permitted'), { code: 'not_permitted' });
  };

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const searchCache = new Map<string, number>();
  let settingsTimer: ReturnType<typeof setTimeout> | undefined;
  const lastMarked = new Map<string, number>();
  const viewed = new Set<string>();

  const w: Originals = {
    /* ---------- profile ---------- */
    completeProfile: (p) => {
      o.completeProfile(p);
      const me = get().users[ME_ID];
      if (!me) return;
      profileWrite = createProfileRemote(ctx, me, get().interests).catch((e) => {
        if (!ctx.alive) return;
        set((s) => ({ auth: { ...s.auth, stage: 'profile', prefill: { displayName: p.displayName, avatarUri: p.avatarUri } } }));
        toast(friendlyProfileError(e));
      });
    },

    completeInterests: (ids) => {
      o.completeInterests(ids);
      write(() => afterProfile(() => q(sb.from('profile_private').upsert({ id: userId, interests: ids }, { onConflict: 'id' }))), null, 'Couldn’t save your interests.');
    },

    updateProfile: (p) => updateProfile(p),

    signOut: () => {
      onSignOut();
      o.signOut();
    },
    clearDeviceData: () => {
      onSignOut();
      o.clearDeviceData();
    },

    /** Sync local filter now; the server search (search_people) merges results into s.users shortly after. */
    searchPeople: (query) => {
      const res = o.searchPeople(query);
      const term = query.trim().toLowerCase().replace(/^@/, '');
      if (term.length >= 2 && (searchCache.get(term) ?? 0) < Date.now() - 60_000) {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = later(ctx, 350, () => {
          searchCache.set(term, Date.now());
          sb.rpc('search_people', { p_query: term }).then(({ data, error }) => {
            if (!ctx.alive) return;
            if (error) {
              searchCache.delete(term);
              if (/rate_limited/.test(String((error as { message?: string }).message))) toast('You’re searching too fast. Try again in a minute.');
              return;
            }
            const rows = (data ?? []) as { id: string; username: string; display_name: string; avatar_path: string | null; city: string }[];
            if (!rows.length) return;
            set((s) => {
              const users = { ...s.users };
              let changed = false;
              for (const r of rows) {
                const p = profileFromSearch(ctx, r);
                const cur = users[p.id];
                if (!cur) {
                  users[p.id] = p;
                  changed = true;
                } else if (cur.username !== p.username || cur.displayName !== p.displayName || cur.avatarUri !== p.avatarUri) {
                  users[p.id] = { ...cur, username: p.username, displayName: p.displayName, avatarUri: p.avatarUri, city: p.city };
                  changed = true;
                }
              }
              return changed ? { users } : {};
            });
          });
        });
      }
      return res;
    },

    /* ---------- messaging ---------- */
    startConversation: (participantId, listingId) => {
      const lid = o.startConversation(participantId, listingId);
      if (!ctx.confirmedConvs.has(lid)) {
        ensureConversation(ctx, lid).catch((e) => {
          if (ctx.alive && !isNetworkError(e)) toast(friendly(e, 'Couldn’t start this chat. Try again.'));
        });
      }
      if (participantId !== ME_ID) quiet(() => ensureProfiles(ctx, [toRemoteUser(ctx, participantId)]));
      return lid;
    },

    sendMessage: (cid, partial) => {
      const s = get();
      const conv = s.conversations[cid];
      if (!conv) return;
      if (s.blocked.includes(conv.participantId)) return;
      const msg: Message = { id: uid('m'), conversationId: cid, senderId: s.meId, type: 'text', status: 'pending', createdAt: Date.now(), ...partial };
      set((st) => ({
        messages: { ...st.messages, [cid]: [...(st.messages[cid] ?? []), msg] },
        conversations: { ...st.conversations, [cid]: { ...st.conversations[cid]!, lastMessageAt: msg.createdAt, draft: '', status: 'active' } },
      }));
      if (msg.listingId && s.listings[msg.listingId])
        set((st) => ({ listings: { ...st.listings, [msg.listingId!]: { ...st.listings[msg.listingId!]!, enquiries: st.listings[msg.listingId!]!.enquiries + 1 } } }));
      void deliverMessage(ctx, cid, msg.id);
    },

    retryMessage: (cid, mid) => {
      patchMsg(cid, mid, { status: 'pending' });
      void deliverMessage(ctx, cid, mid);
    },

    respondToOffer: (cid, mid, state) => {
      const before = findMsg(cid, mid)?.offer;
      o.respondToOffer(cid, mid, state); // also sends the reply through the wrapped sendMessage
      if (!before) return;
      write(
        async () => {
          const sid = await serverConv(cid);
          if (!sid) return;
          await q(sb.from('messages').update({ offer_state: state }).eq('id', mid));
        },
        () => patchMsg(cid, mid, { offer: before }),
        'Couldn’t update the offer.',
      );
    },

    react: (cid, mid, emoji) => {
      const before = findMsg(cid, mid)?.reactions;
      o.react(cid, mid, emoji);
      const m = findMsg(cid, mid);
      if (!m || m.status === 'pending' || m.status === 'failed') return;
      const mine = m.reactions?.[ME_ID];
      write(
        () =>
          mine
            ? q(sb.from('message_reactions').upsert({ message_id: mid, user_id: userId, emoji: mine }, { onConflict: 'message_id,user_id' }))
            : q(sb.from('message_reactions').delete().eq('message_id', mid).eq('user_id', userId)),
        () => patchMsg(cid, mid, { reactions: before }),
        'Couldn’t update your reaction.',
      );
    },

    deleteMessage: (cid, mid) => {
      const before = findMsg(cid, mid);
      o.deleteMessage(cid, mid);
      if (!before || before.senderId !== ME_ID || before.status === 'pending' || before.status === 'failed') return;
      write(
        () => mustAffect(sb.from('messages').update({ deleted_at: iso(Date.now()), body: null, media_path: null }).eq('id', mid).select('id')),
        () => patchMsg(cid, mid, before),
        'Couldn’t delete the message.',
      );
    },

    markRead: (cid) => {
      o.markRead(cid);
      // Opening a chat clears its message/offer notifications (the server does the same in mark_read).
      const isChatNotif = (n: { conversationId?: string; type: string }) => n.conversationId === cid && (n.type === 'message' || n.type === 'offer');
      if (get().notifications.some(isChatNotif)) set((s) => ({ notifications: s.notifications.filter((n) => !isChatNotif(n)) }));
      const list = get().messages[cid] ?? [];
      const latest = list.reduce((mx, m) => (m.senderId !== ME_ID ? Math.max(mx, m.createdAt) : mx), 0);
      if (!latest || latest <= (lastMarked.get(cid) ?? 0)) return;
      lastMarked.set(cid, latest);
      quiet(async () => {
        const sid = await serverConv(cid);
        if (!sid) return;
        if (ctx.v5) await markReadRemote(ctx, sid);
        else await sb.from('conversation_members').update({ last_read_at: iso(Math.max(Date.now(), latest + 1)) }).eq('conversation_id', sid).eq('user_id', userId);
      });
    },

    togglePin: (cid) => {
      const before = get().conversations[cid];
      o.togglePin(cid);
      if (!before) return;
      write(
        async () => {
          const sid = await serverConv(cid);
          if (sid) await q(sb.from('conversation_members').update({ pinned_at: before.pinned ? null : iso(Date.now()) }).eq('conversation_id', sid).eq('user_id', userId));
        },
        () => patchConv(cid, get().conversations[cid] && { ...get().conversations[cid]!, pinned: before.pinned }),
        'Couldn’t update the chat.',
      );
    },

    toggleMute: (cid) => {
      const before = get().conversations[cid];
      o.toggleMute(cid);
      if (!before) return;
      write(
        async () => {
          const sid = await serverConv(cid);
          if (sid) await q(sb.from('conversation_members').update({ muted_at: before.muted ? null : iso(Date.now()) }).eq('conversation_id', sid).eq('user_id', userId));
        },
        () => patchConv(cid, get().conversations[cid] && { ...get().conversations[cid]!, muted: before.muted }),
        'Couldn’t update the chat.',
      );
    },

    setArchived: (cid, archived) => {
      const before = get().conversations[cid];
      o.setArchived(cid, archived);
      if (!before) return;
      write(
        async () => {
          const sid = await serverConv(cid);
          if (sid)
            await q(
              sb
                .from('conversation_members')
                .update(archived ? { archived_at: iso(Date.now()), pinned_at: null } : { archived_at: null })
                .eq('conversation_id', sid)
                .eq('user_id', userId),
            );
        },
        () => patchConv(cid, get().conversations[cid] && { ...get().conversations[cid]!, status: before.status, pinned: before.pinned }),
        'Couldn’t update the chat.',
      );
    },

    deleteConversation: (cid) => {
      const conv = get().conversations[cid];
      const msgs = get().messages[cid];
      o.deleteConversation(cid);
      if (!conv) return;
      write(
        async () => {
          const sid = await serverConv(cid);
          if (!sid) return;
          const now = iso(Date.now());
          const base = sb.from('conversation_members');
          if (ctx.v3) await q(base.update({ hidden_at: now, cleared_at: now, pinned_at: null }).eq('conversation_id', sid).eq('user_id', userId));
          else await q(base.update({ archived_at: now, pinned_at: null }).eq('conversation_id', sid).eq('user_id', userId)); // best available before 0003
          ctx.confirmedConvs.delete(cid); // a later message re-loads it from the server
        },
        () => set((s) => ({ conversations: { ...s.conversations, [cid]: conv }, messages: { ...s.messages, [cid]: msgs ?? [] } })),
        'Couldn’t delete the chat.',
      );
    },

    clearChat: (cid) => {
      const msgs = get().messages[cid];
      o.clearChat(cid);
      if (!ctx.v3) return; // without 0003 (cleared_at) this stays on this device only
      write(
        async () => {
          const sid = await serverConv(cid);
          if (sid) await q(sb.from('conversation_members').update({ cleared_at: iso(Date.now()) }).eq('conversation_id', sid).eq('user_id', userId));
        },
        () => set((s) => ({ messages: { ...s.messages, [cid]: msgs ?? [] } })),
        'Couldn’t clear the chat.',
      );
    },

    /* ---------- social ---------- */
    toggleFollow: (id) => {
      if (id === ME_ID) return;
      const was = get().follows.includes(id);
      o.toggleFollow(id);
      const rid = toRemoteUser(ctx, id);
      write(
        async () => {
          if (was) await q(sb.from('follows').delete().eq('follower_id', userId).eq('followed_id', rid));
          else {
            const { error } = await sb.from('follows').insert({ follower_id: userId, followed_id: rid });
            if (error && errCode(error) !== '23505') throw error;
          }
        },
        () => o.toggleFollow(id),
        was ? 'Couldn’t unfollow. Try again.' : 'Couldn’t follow. Try again.',
      );
    },

    toggleSave: (listingId) => {
      const was = get().saved.includes(listingId);
      o.toggleSave(listingId);
      if (!isUuid(listingId)) return;
      write(
        async () => {
          if (was) await q(sb.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', listingId));
          else {
            const { error } = await sb.from('saved_listings').insert({ user_id: userId, listing_id: listingId });
            if (error && errCode(error) !== '23505') throw error;
          }
        },
        () => o.toggleSave(listingId),
        was ? 'Couldn’t remove from saved.' : 'Couldn’t save this listing.',
      );
    },

    toggleBlock: (id) => {
      if (id === ME_ID) return;
      const was = get().blocked.includes(id);
      o.toggleBlock(id);
      const rid = toRemoteUser(ctx, id);
      write(
        async () => {
          if (was) await q(sb.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', rid));
          else {
            const { error } = await sb.from('blocks').insert({ blocker_id: userId, blocked_id: rid });
            if (error && errCode(error) !== '23505') throw error;
          }
        },
        () => o.toggleBlock(id),
        was ? 'Couldn’t unblock. Try again.' : 'Couldn’t block. Try again.',
      );
    },

    submitReport: (r) => {
      const caseId = o.submitReport(r);
      const report = get().reports.find((x) => x.caseId === caseId);
      if (report && isUuid(toRemoteUser(ctx, report.targetId))) {
        write(
          () => afterProfile(() => q(sb.from('reports').insert(reportToRow(ctx, report)))),
          () => set((s) => ({ reports: s.reports.filter((x) => x.id !== report.id) })),
          'Couldn’t send your report. Check your connection and try again.',
        );
      }
      return caseId;
    },

    saveReview: (r) => {
      const snap = { reviews: get().reviews, users: get().users };
      o.saveReview(r);
      const review = get().reviews.find((x) => x.sellerId === r.sellerId && x.reviewerId === ME_ID);
      if (!review || get().reviews === snap.reviews) return;
      write(
        async () => {
          const row = { rating: review.rating, text: review.text || null, listing_id: review.listingId && isUuid(review.listingId) ? review.listingId : null };
          if (ctx.remoteReviews.has(review.id)) {
            await mustAffect(sb.from('reviews').update(row).eq('id', review.id).select('id'));
          } else {
            await q(
              sb.from('reviews').insert({ id: review.id, reviewer_id: userId, seller_id: toRemoteUser(ctx, review.sellerId), verification_type: 'unverified', ...row }),
            );
            ctx.remoteReviews.add(review.id);
          }
        },
        () => set(snap),
        'Couldn’t save your review.',
      );
    },

    deleteReview: (sellerId) => {
      const snap = { reviews: get().reviews, users: get().users };
      const existing: Review | undefined = snap.reviews.find((x) => x.sellerId === sellerId && x.reviewerId === ME_ID);
      o.deleteReview(sellerId);
      if (!existing || !ctx.remoteReviews.has(existing.id)) return;
      write(
        async () => {
          await mustAffect(sb.from('reviews').delete().eq('id', existing.id).select('id'));
          ctx.remoteReviews.delete(existing.id);
        },
        () => set(snap),
        'Couldn’t delete your review.',
      );
    },

    /* ---------- stories ---------- */
    addStory: (input) => {
      const before = new Set(get().stories.map((x) => x.id));
      o.addStory(input);
      const story = get().stories.find((x) => !before.has(x.id) && x.userId === ME_ID);
      if (!story) return;
      write(
        async () => {
          const media = await storeImage(ctx, 'stories', story.imageUri, story.id);
          const privacy = get().settings.statusPrivacy;
          await afterProfile(() =>
            q(
              sb.from('stories').insert({
                id: isUuid(story.id) ? story.id : undefined,
                user_id: userId,
                media_path: media,
                text: story.text?.slice(0, 240) ?? null,
                bg: story.bg ?? null,
                caption: story.caption?.slice(0, 200) ?? null,
                listing_id: story.listingId && ctx.remoteListings.has(story.listingId) ? story.listingId : null,
                audience: privacy === 'everyone' ? 'everyone' : 'followers',
              }),
            ),
          );
          if (media) set((s) => ({ stories: s.stories.map((x) => (x.id === story.id ? { ...x, imageUri: publicUrl(ctx, 'stories', media) } : x)) }));
        },
        () => set((s) => ({ stories: s.stories.filter((x) => x.id !== story.id) })),
        'Couldn’t post your status.',
      );
    },

    deleteStory: (id) => {
      const story = get().stories.find((x) => x.id === id);
      o.deleteStory(id);
      if (!story || !isUuid(id)) return;
      write(
        () => q(sb.from('stories').delete().eq('id', id)),
        () => set((s) => ({ stories: [...s.stories, story].sort((a, b) => a.createdAt - b.createdAt) })),
        'Couldn’t delete your status.',
      );
    },

    markStoryViewed: (id) => {
      const already = get().viewedStories.includes(id);
      o.markStoryViewed(id);
      const story = get().stories.find((x) => x.id === id);
      if (already || !story || story.userId === ME_ID || !isUuid(id)) return;
      quiet(() => sb.from('story_views').upsert({ story_id: id, viewer_id: userId }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }));
    },

    /* ---------- listings ---------- */
    publishDraft: () => {
      const id = o.publishDraft();
      if (!id) return null;
      const existed = ctx.remoteListings.has(id);
      write(
        () => afterProfile(() => upsertListingRemote(ctx, id)),
        // Keep it visible in My listings; it is re-sent automatically on the next connect.
        null,
        existed ? 'Couldn’t save your changes. Try again.' : 'Couldn’t publish your listing yet. It stays in My listings and we’ll retry automatically.',
      );
      return id;
    },

    setListingStatus: (id, status) => {
      const before = get().listings[id]?.status;
      o.setListingStatus(id, status);
      if (!before) return;
      write(
        async () => {
          if (ctx.remoteListings.has(id)) await mustAffect(sb.from('listings').update({ status }).eq('id', id).select('id'));
          else await upsertListingRemote(ctx, id);
        },
        () => set((s) => (s.listings[id] ? { listings: { ...s.listings, [id]: { ...s.listings[id]!, status: before } } } : {})),
        'Couldn’t update the listing.',
      );
    },

    bumpView: (id) => {
      o.bumpView(id);
      const l = get().listings[id];
      if (!ctx.v3 || viewed.has(id) || !l || l.sellerId === ME_ID || !ctx.remoteListings.has(id)) return;
      viewed.add(id);
      quiet(() => sb.rpc('bump_listing_view', { p_listing: id }));
    },

    /* ---------- notifications ---------- */
    markNotificationsRead: () => {
      const hadUnread = get().notifications.some((n) => !n.read);
      o.markNotificationsRead();
      if (hadUnread) quiet(() => sb.from('notifications').update({ read_at: iso(Date.now()) }).eq('recipient_id', userId).is('read_at', null));
    },

    deleteNotification: (id) => {
      o.deleteNotification(id);
      if (!isUuid(id)) return;
      quiet(async () => {
        const { data } = await sb.from('notifications').delete().eq('id', id).select('id');
        // before 0003 there is no delete policy: at least mark it read so it stops counting
        if (!data?.length) await sb.from('notifications').update({ read_at: iso(Date.now()) }).eq('id', id).is('read_at', null);
      });
    },

    clearNotifications: () => {
      const had = get().notifications.length > 0;
      o.clearNotifications();
      if (!had) return;
      quiet(async () => {
        const { data } = await sb.from('notifications').delete().eq('recipient_id', userId).select('id');
        if (!data?.length) await sb.from('notifications').update({ read_at: iso(Date.now()) }).eq('recipient_id', userId).is('read_at', null);
      });
    },

    /* ---------- settings ---------- */
    updateSettings: (p) => {
      o.updateSettings(p);
      if (Object.keys(p).every((k) => k === 'theme')) return; // theme is per device
      if (settingsTimer) clearTimeout(settingsTimer);
      settingsTimer = later(ctx, 800, () =>
        write(
          () => afterProfile(() => q(sb.from('profile_private').upsert({ id: userId, settings: settingsPayload(ctx) }, { onConflict: 'id' }))),
          null,
          'Couldn’t save your settings to your account.',
        ),
      );
    },
  };

  /** Field-level revert + profile-specific wording (e.g. username taken). */
  function updateProfile(p: Parameters<State['updateProfile']>[0]) {
    const before = get().users[ME_ID];
    o.updateProfile(p);
    if (!before) return;
    const keys = Object.keys(p) as (keyof typeof p)[];
    void (async () => {
      const patch: Record<string, unknown> = {};
      if ('displayName' in p) patch.display_name = p.displayName;
      if ('username' in p && p.username) patch.username = p.username.toLowerCase();
      if ('bio' in p) patch.bio = p.bio?.slice(0, 500) || null;
      if ('city' in p && p.city) patch.city = p.city;
      if ('isSeller' in p) patch.is_seller = !!p.isSeller;
      if ('shopName' in p) patch.shop_name = p.shopName || null;
      if ('shopType' in p) patch.shop_type = p.shopType ?? null;
      if ('avatarUri' in p) patch.avatar_path = await storeImage(ctx, 'avatars', p.avatarUri, `avatar-${Date.now()}`);
      let cover: string | null | undefined;
      if ('coverUri' in p && ctx.v3) cover = await storeImage(ctx, 'avatars', p.coverUri, `cover-${Date.now()}`);
      if (cover !== undefined) patch.cover_path = cover;
      if (Object.keys(patch).length) await afterProfile(() => q(sb.from('profiles').update(patch).eq('id', userId)));
      const hosted: Record<string, string | undefined> = {};
      if (typeof patch.avatar_path === 'string') hosted.avatarUri = publicUrl(ctx, 'avatars', patch.avatar_path);
      if (typeof cover === 'string') hosted.coverUri = publicUrl(ctx, 'avatars', cover);
      if (Object.keys(hosted).length) set((s) => (s.users[ME_ID] ? { users: { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, ...hosted } } } : {}));
    })().catch((e) => {
      if (!ctx.alive) return;
      set((s) => {
        const cur = s.users[ME_ID];
        if (!cur) return {};
        const restored = { ...cur };
        for (const k of keys) (restored as Record<string, unknown>)[k] = before[k];
        return { users: { ...s.users, [ME_ID]: restored } };
      });
      toast(friendlyProfileError(e));
    });
  }

  set(w);
  return o;
}
