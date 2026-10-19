/**
 * Local-first data layer. Shapes mirror the Supabase schema so a remote adapter
 * can replace these actions without touching screens. Shared by the mobile and web apps.
 */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { ME_ID } from './constants';
import type {
  Conversation,
  Listing,
  ListingDraft,
  ListingStatus,
  Message,
  NotificationItem,
  Profile,
  Report,
  Review,
  SearchFilters,
  Story,
} from './types';
import { normalizeCategory } from './taxonomy';
import { caseId, uid } from './format';

/* ---------------- transient (not persisted) ---------------- */
/** Health of the live (realtime) connection — shown in Settings so problems are visible without dev tools. */
export type SyncHealth = {
  status: 'off' | 'connecting' | 'live' | 'reconnecting' | 'error';
  since: number;
  lastEventAt?: number;
  lastEvent?: string;
  lastError?: string;
};
type Live = {
  typing: Record<string, boolean>;
  activeConversationId: string | null;
  toast: { id: number; text: string; icon?: string } | null;
  sync: SyncHealth;
};
export const useLive = create<Live>(() => ({ typing: {}, activeConversationId: null, toast: null, sync: { status: 'off', since: Date.now() } }));
export const setSyncHealth = (p: Partial<SyncHealth>) => useLive.setState((s) => ({ sync: { ...s.sync, ...p } }));
export const showToast = (text: string, icon?: string) => useLive.setState({ toast: { id: Date.now(), text, icon } });

/* ---------------- persisted ---------------- */
type Settings = {
  theme: 'system' | 'dark' | 'light';
  readReceipts: boolean;
  showLastSeen: boolean;
  lockScreenPreview: boolean;
  notif: { messages: boolean; follows: boolean; newListings: boolean; priceDrops: boolean; offers: boolean; digest: boolean };
  statusPrivacy: 'everyone' | 'followers' | 'nobody';
  personalization: boolean;
  /** Show my profile when people search by @username or name. */
  discoverable: boolean;
};

type Auth = {
  stage: 'signed_out' | 'profile' | 'interests' | 'ready';
  provider?: 'email' | 'google';
  /** Server auth user id once a real backend session exists. */
  userId?: string;
  email?: string;
  /** Details from the sign-in provider used to pre-fill profile setup. */
  prefill?: { displayName?: string; avatarUri?: string };
};

export type State = {
  hydrated: boolean;
  auth: Auth;
  meId: string;
  /** Auth user whose server data this device last synced (set by remote/connectRemote; guards account switches). */
  syncedUserId?: string;
  interests: string[];
  users: Record<string, Profile>;
  listings: Record<string, Listing>;
  conversations: Record<string, Conversation>;
  messages: Record<string, Message[]>;
  stories: Story[];
  viewedStories: string[];
  notifications: NotificationItem[];
  reviews: Review[];
  follows: string[];
  saved: string[];
  blocked: string[];
  reports: Report[];
  draft: ListingDraft | null;
  recentSearches: string[];
  search: { query: string; filters: SearchFilters };
  settings: Settings;

  // auth
  /** Local session until Supabase is connected (lib/auth calls the server when it is). */
  startEmailSession: (email: string, mode: 'signup' | 'login') => void;
  completeProfile: (p: { displayName: string; username: string; city: string; bio?: string; avatarUri?: string }) => void;
  completeInterests: (ids: string[]) => void;
  updateProfile: (p: Partial<Profile>) => void;
  signOut: () => void;
  signInWithProvider: (p: { provider: 'google' | 'email'; userId: string; email?: string; displayName?: string; avatarUri?: string }) => void;
  clearDeviceData: () => void;
  /** People search by @username or name (server-side with the backend). */
  searchPeople: (query: string) => Profile[];

  // messaging
  startConversation: (participantId: string, listingId?: string) => string;
  sendMessage: (conversationId: string, m: Partial<Message>) => void;
  retryMessage: (conversationId: string, messageId: string) => void;
  /** 'countered' only marks the offer; the counter itself is sent as a new offer message. */
  respondToOffer: (conversationId: string, messageId: string, state: 'accepted' | 'declined' | 'countered') => void;
  react: (conversationId: string, messageId: string, emoji: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  toggleStar: (conversationId: string, messageId: string) => void;
  markRead: (conversationId: string) => void;
  markUnread: (conversationId: string) => void;
  setDraftText: (conversationId: string, text: string) => void;
  togglePin: (conversationId: string) => void;
  toggleMute: (conversationId: string) => void;
  setArchived: (conversationId: string, archived: boolean) => void;
  deleteConversation: (conversationId: string) => void;
  clearChat: (conversationId: string) => void;

  // social
  toggleFollow: (userId: string) => void;
  toggleSave: (listingId: string) => void;
  toggleBlock: (userId: string) => void;
  submitReport: (r: Pick<Report, 'targetType' | 'targetId' | 'reason' | 'details'>) => string;
  canReview: (sellerId: string) => boolean;
  saveReview: (r: { sellerId: string; listingId?: string; rating: number; text: string }) => void;
  deleteReview: (sellerId: string) => void;

  // stories
  addStory: (s: Omit<Story, 'id' | 'userId' | 'createdAt'>) => void;
  deleteStory: (id: string) => void;
  markStoryViewed: (id: string) => void;

  // listings
  setDraft: (d: Partial<ListingDraft> | null) => void;
  publishDraft: () => string | null;
  editListing: (id: string) => void;
  setListingStatus: (id: string, status: ListingStatus) => void;
  bumpView: (id: string) => void;

  // misc
  markNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;
  setSearch: (s: Partial<{ query: string; filters: Partial<SearchFilters> }>) => void;
  pushRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  updateSettings: (s: Partial<Settings>) => void;
};

const defaultFilters: SearchFilters = { conditions: [], sort: 'relevance' };

const defaultSettings: Settings = {
  theme: 'system',
  readReceipts: true,
  showLastSeen: true,
  lockScreenPreview: false,
  notif: { messages: true, follows: true, newListings: true, priceDrops: true, offers: true, digest: false },
  statusPrivacy: 'followers',
  personalization: true,
  discoverable: true,
};

const freshData = () => ({
  users: {} as Record<string, Profile>,
  listings: {} as Record<string, Listing>,
  conversations: {} as Record<string, Conversation>,
  messages: {} as Record<string, Message[]>,
  stories: [] as Story[],
  notifications: [] as NotificationItem[],
  reviews: [] as Review[],
  follows: [] as string[],
  saved: [] as string[],
  viewedStories: [] as string[],
  blocked: [] as string[],
  reports: [] as Report[],
  draft: null as ListingDraft | null,
  recentSearches: [] as string[],
  search: { query: '', filters: defaultFilters },
});

const timers = new Set<ReturnType<typeof setTimeout>>();
const later = (ms: number, fn: () => void) => {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
};

/** Create the app store with a platform storage adapter (AsyncStorage on mobile, localStorage on web). */
export function createNevaStore(storage: StateStorage) {
const useStore = create<State>()(
  persist(
    (set, get) => {
      const patchMessage = (cid: string, mid: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [cid]: (s.messages[cid] ?? []).map((m) => (m.id === mid ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
          },
        }));

      return {
        hydrated: false,
        auth: { stage: 'signed_out' },
        meId: ME_ID,
        interests: [],
        ...freshData(),
        settings: defaultSettings,

        /* ---------- auth ---------- */
        startEmailSession: (email, mode) =>
          set((s) => ({ auth: { stage: mode === 'login' && s.users[ME_ID] ? 'ready' : 'profile', provider: 'email', email: email.trim().toLowerCase() } })),
        searchPeople: (query) => {
          const s = get();
          const q = query.trim().toLowerCase().replace(/^@/, '');
          if (q.length < 2) return [];
          return Object.values(s.users)
            .filter((u) => u.id !== s.meId && !s.blocked.includes(u.id))
            .filter((u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || (u.shopName ?? '').toLowerCase().includes(q))
            .sort((a, b) => Number(b.username.toLowerCase().startsWith(q)) - Number(a.username.toLowerCase().startsWith(q)))
            .slice(0, 20);
        },
        completeProfile: (p) =>
          set((s) => ({
            users: {
              ...s.users,
              [ME_ID]: {
                id: ME_ID,
                username: p.username.toLowerCase(),
                displayName: p.displayName,
                avatarColor: '#25D995',
                avatarUri: p.avatarUri,
                bio: p.bio,
                city: p.city,
                isSeller: false,
                verifications: [], // only set after a real server-side check
                followers: 0,
                following: s.follows.length,
                joinedAt: Date.now(),
                online: true,
              },
            },
            auth: { ...s.auth, stage: 'interests' },
          })),
        completeInterests: (ids) => set((s) => ({ interests: ids, auth: { ...s.auth, stage: 'ready' } })),
        updateProfile: (p) => set((s) => ({ users: { ...s.users, [ME_ID]: { ...s.users[ME_ID]!, ...p } } })),
        signInWithProvider: ({ provider, userId, email, displayName, avatarUri }) =>
          set((s) => ({ auth: { stage: s.users[ME_ID] ? 'ready' : 'profile', provider, userId, email, prefill: { displayName, avatarUri } } })),
        signOut: () => {
          timers.forEach(clearTimeout);
          timers.clear();
          set((s) => ({ auth: { stage: 'signed_out', email: s.auth.email } }));
        },
        clearDeviceData: () => {
          timers.forEach(clearTimeout);
          timers.clear();
          set({ ...freshData(), auth: { stage: 'signed_out' }, interests: [], settings: defaultSettings });
        },

        /* ---------- messaging ---------- */
        startConversation: (participantId, listingId) => {
          const s = get();
          const existing = Object.values(s.conversations).find(
            (c) => c.participantId === participantId && (listingId ? c.listingId === listingId : true),
          );
          if (existing) {
            if (existing.status === 'archived') set((st) => ({ conversations: { ...st.conversations, [existing.id]: { ...existing, status: 'active' } } }));
            return existing.id;
          }
          const l = listingId ? s.listings[listingId] : undefined;
          const id = uid('c');
          const now = Date.now();
          set((st) => ({
            conversations: {
              ...st.conversations,
              [id]: {
                id,
                participantId,
                listingId,
                listingSnapshot: l ? { title: l.title, priceMinor: l.priceMinor, image: l.images[0]!, condition: l.condition } : undefined,
                status: 'active',
                pinned: false,
                muted: false,
                unread: 0,
                createdAt: now,
                lastMessageAt: now,
              },
            },
            messages: { ...st.messages, [id]: [] },
          }));
          return id;
        },

        sendMessage: (cid, partial) => {
          const s = get();
          const conv = s.conversations[cid];
          if (!conv) return;
          if (s.blocked.includes(conv.participantId)) return;
          const msg: Message = {
            id: uid('m'),
            conversationId: cid,
            senderId: s.meId,
            type: 'text',
            status: 'pending',
            createdAt: Date.now(),
            ...partial,
          };
          set((st) => ({
            messages: { ...st.messages, [cid]: [...(st.messages[cid] ?? []), msg] },
            conversations: { ...st.conversations, [cid]: { ...st.conversations[cid]!, lastMessageAt: msg.createdAt, draft: '', status: 'active' } },
          }));
          if (msg.listingId && s.listings[msg.listingId])
            set((st) => ({ listings: { ...st.listings, [msg.listingId!]: { ...st.listings[msg.listingId!]!, enquiries: st.listings[msg.listingId!]!.enquiries + 1 } } }));
          // Saved locally. Delivery/read states come from the server once messaging is connected.
          later(250, () => patchMessage(cid, msg.id, { status: 'sent' }));
        },

        retryMessage: (cid, mid) => {
          patchMessage(cid, mid, { status: 'pending' });
          later(250, () => patchMessage(cid, mid, { status: 'sent' }));
        },

        respondToOffer: (cid, mid, state) => {
          patchMessage(cid, mid, (m) => ({ offer: { ...m.offer!, state } }));
          if (state === 'countered') return;
          const amount = get().messages[cid]?.find((m) => m.id === mid)?.offer?.amountMinor ?? 0;
          get().sendMessage(cid, {
            body: state === 'accepted' ? `I accept ₦${Math.round(amount / 100).toLocaleString()} 🤝🏽` : 'I’ll pass on that offer, thanks',
          });
        },

        react: (cid, mid, emoji) =>
          patchMessage(cid, mid, (m) => {
            const r = { ...(m.reactions ?? {}) };
            if (r[get().meId] === emoji) delete r[get().meId];
            else r[get().meId] = emoji;
            return { reactions: r };
          }),
        deleteMessage: (cid, mid) => patchMessage(cid, mid, { deleted: true, body: undefined, imageUri: undefined, type: 'text' }),
        toggleStar: (cid, mid) => patchMessage(cid, mid, (m) => ({ starred: !m.starred })),

        markRead: (cid) =>
          set((s) => {
            const c = s.conversations[cid];
            if (!c) return {};
            const pending = (s.messages[cid] ?? []).some((m) => m.senderId !== s.meId && m.status !== 'read');
            if (!c.unread && !pending) return s;
            return {
              conversations: { ...s.conversations, [cid]: { ...c, unread: 0 } },
              messages: {
                ...s.messages,
                [cid]: (s.messages[cid] ?? []).map((m) => (m.senderId !== s.meId && m.status !== 'read' ? { ...m, status: 'read' } : m)),
              },
            };
          }),
        markUnread: (cid) => set((s) => ({ conversations: { ...s.conversations, [cid]: { ...s.conversations[cid]!, unread: Math.max(1, s.conversations[cid]!.unread) } } })),
        setDraftText: (cid, text) => set((s) => (s.conversations[cid] && (s.conversations[cid]!.draft ?? '') !== text ? { conversations: { ...s.conversations, [cid]: { ...s.conversations[cid]!, draft: text } } } : {})),
        togglePin: (cid) => set((s) => ({ conversations: { ...s.conversations, [cid]: { ...s.conversations[cid]!, pinned: !s.conversations[cid]!.pinned } } })),
        toggleMute: (cid) => set((s) => ({ conversations: { ...s.conversations, [cid]: { ...s.conversations[cid]!, muted: !s.conversations[cid]!.muted } } })),
        setArchived: (cid, archived) =>
          set((s) => ({ conversations: { ...s.conversations, [cid]: { ...s.conversations[cid]!, status: archived ? 'archived' : 'active', pinned: archived ? false : s.conversations[cid]!.pinned } } })),
        deleteConversation: (cid) =>
          set((s) => {
            const { [cid]: _c, ...conversations } = s.conversations;
            const { [cid]: _m, ...messages } = s.messages;
            return { conversations, messages };
          }),
        clearChat: (cid) => set((s) => ({ messages: { ...s.messages, [cid]: [] } })),

        /* ---------- social ---------- */
        toggleFollow: (userId) =>
          set((s) => {
            if (userId === s.meId) return {};
            const following = s.follows.includes(userId);
            const u = s.users[userId];
            return {
              follows: following ? s.follows.filter((x) => x !== userId) : [...s.follows, userId],
              users: u ? { ...s.users, [userId]: { ...u, followers: u.followers + (following ? -1 : 1) } } : s.users,
            };
          }),
        toggleSave: (listingId) =>
          set((s) => {
            const saved = s.saved.includes(listingId);
            const l = s.listings[listingId];
            return {
              saved: saved ? s.saved.filter((x) => x !== listingId) : [listingId, ...s.saved],
              listings: l ? { ...s.listings, [listingId]: { ...l, saves: l.saves + (saved ? -1 : 1) } } : s.listings,
            };
          }),
        toggleBlock: (userId) =>
          set((s) => ({ blocked: s.blocked.includes(userId) ? s.blocked.filter((x) => x !== userId) : [...s.blocked, userId] })),
        // Reviews must come from a real interaction (blueprint §7): you must have messaged this seller.
        canReview: (sellerId) => {
          const s = get();
          if (sellerId === s.meId) return false;
          return Object.values(s.conversations).some((c) => c.participantId === sellerId && (s.messages[c.id] ?? []).some((m) => m.senderId === s.meId));
        },
        saveReview: ({ sellerId, listingId, rating, text }) =>
          set((s) => {
            if (!get().canReview(sellerId)) return {};
            const r = Math.max(1, Math.min(5, Math.round(rating)));
            const existing = s.reviews.find((x) => x.sellerId === sellerId && x.reviewerId === s.meId);
            const seller = s.users[sellerId];
            const prev = seller?.rating ?? { avg: 0, count: 0 };
            const count = existing ? prev.count : prev.count + 1;
            const total = prev.avg * prev.count - (existing?.rating ?? 0) + r;
            const rating2 = { avg: Math.round((total / Math.max(1, count)) * 10) / 10, count };
            const review: Review = {
              id: existing?.id ?? uid('r'),
              reviewerId: s.meId,
              sellerId,
              listingId,
              rating: r,
              text: text.trim().slice(0, 500),
              verificationType: 'conversation',
              createdAt: Date.now(),
            };
            return {
              reviews: existing ? s.reviews.map((x) => (x.id === existing.id ? review : x)) : [review, ...s.reviews],
              users: seller ? { ...s.users, [sellerId]: { ...seller, rating: rating2 } } : s.users,
            };
          }),
        deleteReview: (sellerId) =>
          set((s) => {
            const existing = s.reviews.find((x) => x.sellerId === sellerId && x.reviewerId === s.meId);
            const seller = s.users[sellerId];
            if (!existing || !seller?.rating) return {};
            const count = Math.max(0, seller.rating.count - 1);
            const avg = count ? Math.round(((seller.rating.avg * seller.rating.count - existing.rating) / count) * 10) / 10 : 0;
            return {
              reviews: s.reviews.filter((x) => x.id !== existing.id),
              users: { ...s.users, [sellerId]: { ...seller, rating: count ? { avg, count } : undefined } },
            };
          }),

        submitReport: (r) => {
          const report: Report = { ...r, id: uid('rep'), caseId: caseId(), status: 'open', createdAt: Date.now() };
          set((s) => ({ reports: [report, ...s.reports] }));
          return report.caseId;
        },

        /* ---------- stories ---------- */
        addStory: (story) => set((s) => ({ stories: [...s.stories, { ...story, id: uid('s'), userId: s.meId, createdAt: Date.now(), viewers: 0 }] })),
        deleteStory: (id) => set((s) => ({ stories: s.stories.filter((x) => x.id !== id) })),
        markStoryViewed: (id) => set((s) => (s.viewedStories.includes(id) ? {} : { viewedStories: [...s.viewedStories, id] })),

        /* ---------- listings ---------- */
        setDraft: (d) => set((s) => ({ draft: d === null ? null : { step: 0, ...(s.draft ?? {}), ...d } })),
        publishDraft: () => {
          const s = get();
          const d = s.draft;
          if (!d || !d.title || !d.categoryId || !d.condition || !d.priceMinor || d.priceMinor <= 0) return null;
          const id = d.editingId ?? uid('l');
          const prev = d.editingId ? s.listings[d.editingId] : undefined;
          const now = Date.now();
          const listing: Listing = {
            id,
            sellerId: s.meId,
            title: d.title.trim(),
            description: (d.description ?? '').trim(),
            categoryId: d.categoryId,
            subcategory: d.subcategory?.trim() ? normalizeCategory(d.subcategory) : undefined,
            customCategory: d.categoryId === 'other' && d.customCategory ? normalizeCategory(d.customCategory) : undefined,
            brand: d.brand,
            model: d.model,
            condition: d.condition,
            priceMinor: d.priceMinor,
            currency: 'NGN',
            negotiable: d.negotiable ?? true,
            city: d.city ?? s.users[s.meId]?.city ?? 'Lagos',
            area: d.area,
            pickup: d.pickup ?? true,
            delivery: d.delivery ?? false,
            images: d.images ?? [],
            attributes: d.attributes ?? {},
            status: 'active',
            createdAt: prev?.createdAt ?? now,
            publishedAt: prev?.publishedAt ?? now,
            views: prev?.views ?? 0,
            saves: prev?.saves ?? 0,
            enquiries: prev?.enquiries ?? 0,
          };
          set((st) => ({
            listings: { ...st.listings, [id]: listing },
            draft: null,
            users: { ...st.users, [st.meId]: { ...st.users[st.meId]!, isSeller: true, shopName: st.users[st.meId]!.shopName ?? st.users[st.meId]!.displayName } },
          }));
          return id;
        },
        editListing: (id) => {
          const l = get().listings[id];
          if (!l) return;
          const { id: _i, sellerId: _s, status: _st, views: _v, saves: _sv, enquiries: _e, ...rest } = l;
          set({ draft: { ...rest, step: 0, editingId: id } });
        },
        setListingStatus: (id, status) => set((s) => ({ listings: { ...s.listings, [id]: { ...s.listings[id]!, status } } })),
        bumpView: (id) => set((s) => (s.listings[id] ? { listings: { ...s.listings, [id]: { ...s.listings[id]!, views: s.listings[id]!.views + 1 } } } : {})),

        /* ---------- misc ---------- */
        markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
        deleteNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
        clearNotifications: () => set({ notifications: [] }),
        setSearch: ({ query, filters }) =>
          set((s) => ({ search: { query: query ?? s.search.query, filters: { ...s.search.filters, ...(filters ?? {}) } } })),
        pushRecentSearch: (q) => {
          const t = q.trim();
          if (!t) return;
          set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8) }));
        },
        clearRecentSearches: () => set({ recentSearches: [] }),
        updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p, notif: { ...s.settings.notif, ...(p.notif ?? {}) } } })),
      };
    },
    {
      name: 'neva-store-v1',
      version: 3,
      // v2: remove all sample/mock content from devices that ran the demo. Keeps only the user's own data.
      migrate: (persisted: any, version) => {
        if (!persisted) return persisted;
        if (version >= 2) {
          // v3: phone-number sign-in removed — drop phone/OTP state, keep everything else.
          const { otpLog: _o, phoneDirectory: _p, unfindable: _u, ...rest } = persisted;
          const { findableByPhone: _f, ...settings } = rest.settings ?? {};
          const stage = rest.auth?.stage === 'otp' ? 'signed_out' : rest.auth?.stage ?? 'signed_out';
          return { ...rest, auth: { stage, provider: rest.auth?.provider === 'google' ? 'google' : 'email', email: rest.auth?.email }, settings: { ...defaultSettings, ...settings } };
        }
        const me = persisted.meId ?? ME_ID;
        const mineL = Object.fromEntries(Object.entries(persisted.listings ?? {}).filter(([, l]: any) => l.sellerId === me));
        const meUser = persisted.users?.[me];
        const { demoReplies: _d, findableByPhone: _f, ...settings } = persisted.settings ?? {};
        return {
          ...persisted,
          ...freshData(),
          users: meUser ? { [me]: { ...meUser, verifications: [], followers: 0, following: 0 } } : {},
          listings: mineL,
          stories: (persisted.stories ?? []).filter((s: Story) => s.userId === me),
          draft: persisted.draft ?? null,
          settings: { ...defaultSettings, ...settings },
        };
      },
      storage: createJSONStorage(() => storage),
      partialize: ({ hydrated: _h, ...rest }) =>
        Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<State>,
      onRehydrateStorage: () => () => {
        // Synchronous storage (web localStorage) rehydrates while the store is still being created,
        // before `useStore` is assigned — defer so this runs once the store exists.
        setTimeout(() => {
          // Mark any messages left pending from a killed session as failed so they can be retried (blueprint §13).
          const s = useStore.getState();
          const messages = Object.fromEntries(
            Object.entries(s.messages).map(([k, list]) => [k, list.map((m) => (m.status === 'pending' ? { ...m, status: 'failed' as const } : m))]),
          );
          useStore.setState({ hydrated: true, messages });
        }, 0);
      },
    },
  ),
);
return useStore;
}

export type NevaStore = ReturnType<typeof createNevaStore>;

export const selectMe = (s: State) => s.users[s.meId];
export const isStoryLive = (st: Story, now = Date.now()) => now - st.createdAt < 24 * 3600_000;
