'use client';

import { clockTime, type Conversation, dayLabel, formatNaira, inboxTime, isSameDay, lastSeen, type Message, QUICK_REPLIES } from '@neva/core';
import {
  Archive,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Flag,
  Image as ImageIcon,
  Lock,
  MailOpen,
  MessageSquarePlus,
  MoreVertical,
  Pause,
  Pin,
  Play,
  Plus,
  Reply,
  Search,
  SendHorizontal,
  Star,
  Store,
  Tag,
  Trash2,
  Ban,
  UserX,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Badge, Cond, Dropdown, Empty, Modal, Verified } from '../components/ui';
import { signOutEverywhere } from '../lib/auth';
import { pickImages } from '../lib/images';
import { useNav } from '../nav';
import { isStoryLive, openDrawer, showToast, useLive, useStore, useUI } from '../store';
import { InfoDrawer } from './Info';

type Filter = 'all' | 'unread' | 'offers' | 'pinned';
const EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];

/** Side panel + conversation + optional info drawer, WhatsApp Web style. `panel` swaps the side list (archived, starred, new chat). */
export function ChatsSection({ panel }: { panel?: ReactNode }) {
  const { id, section } = useNav();
  const drawer = useUI((s) => s.drawer);
  const convId = section === 'new' ? undefined : id;
  return (
    <>
      <div className={`side${convId ? ' hide-sm' : ''}`}>{panel ?? <ChatList activeId={convId} />}</div>
      <div className={`main${convId ? '' : ' hide-sm'}`}>{convId ? <ConversationView key={convId} id={convId} /> : <Intro />}</div>
      {drawer && <InfoDrawer />}
    </>
  );
}

export function Intro({ title = 'Neva for web', body = 'Chat with buyers and sellers, make offers and manage your shop from your computer. Pick a conversation or message a seller from any listing.' }: { title?: string; body?: string }) {
  return (
    <div className="intro">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/neva-mark.png" alt="" />
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="foot">
        <Lock size={13} /> Keep deals on Neva — inspect before you pay
      </div>
    </div>
  );
}

function usePendingOfferIds() {
  return useStore(useShallow((s) => Object.keys(s.conversations).filter((cid) => (s.messages[cid] ?? []).some((m) => m.type === 'offer' && m.offer?.state === 'pending'))));
}

function ChatList({ activeId }: { activeId?: string }) {
  const { go } = useNav();
  const conversations = useStore((s) => s.conversations);
  const users = useStore((s) => s.users);
  const messages = useStore((s) => s.messages);
  const offerIds = usePendingOfferIds();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const all = Object.values(conversations);
  const active = all.filter((c) => c.status !== 'archived');
  const archived = all.filter((c) => c.status === 'archived');
  const archivedUnread = archived.filter((c) => c.unread > 0).length;
  const counts = { unread: active.filter((c) => c.unread > 0).length, offers: active.filter((c) => offerIds.includes(c.id)).length, pinned: active.filter((c) => c.pinned).length };
  const query = q.trim().toLowerCase();
  const list = active
    .filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'offers' ? offerIds.includes(c.id) : filter === 'pinned' ? c.pinned : true))
    .filter(
      (c) =>
        !query ||
        users[c.participantId]?.displayName.toLowerCase().includes(query) ||
        users[c.participantId]?.username.includes(query) ||
        c.listingSnapshot?.title.toLowerCase().includes(query) ||
        (messages[c.id] ?? []).some((m) => !m.deleted && m.body?.toLowerCase().includes(query)),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMessageAt - a.lastMessageAt);

  // Like WhatsApp: the main search also finds people you haven't chatted with yet (by @username or name).
  const chatWith = new Set(active.map((c) => c.participantId));
  const people = useMemo(
    () => (query.replace(/^@/, '').length >= 2 ? useStore.getState().searchPeople(q.trim()).filter((u) => !chatWith.has(u.id)) : []),
    [query, users], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const startChat = (id: string) => {
    setQ('');
    go(`/chats/${useStore.getState().startConversation(id)}`);
  };

  const markAllRead = () => active.forEach((c) => c.unread && useStore.getState().markRead(c.id));

  return (
    <>
      <div className="side-head">
        <h1>Chats</h1>
        <NotifBell />
        <button className="icon-btn" title="New chat" aria-label="New chat" onClick={() => go('/new')}>
          <MessageSquarePlus size={21} />
        </button>
        <Dropdown
          trigger={(t, o) => (
            <button className={`icon-btn${o ? ' on' : ''}`} onClick={t} aria-label="Menu">
              <MoreVertical size={20} />
            </button>
          )}
          items={[
            { label: 'New chat', onClick: () => go('/new') },
            { label: 'Archived', onClick: () => go('/archived') },
            { label: 'Starred messages', onClick: () => go('/starred') },
            counts.unread > 0 && { label: 'Mark all as read', onClick: markAllRead },
            { label: 'Settings', onClick: () => go('/settings') },
            { label: 'Log out', onClick: () => signOutEverywhere() },
          ]}
        />
      </div>
      <div className="search">
        <Search size={17} />
        <input placeholder="Search or start a new chat" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>
      {active.length > 0 && (
        <div className="pills">
          {(['all', 'unread', 'offers', 'pinned'] as Filter[]).map((f) => (
            <button key={f} className={`pill${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
              {f[0]!.toUpperCase() + f.slice(1)}
              {f !== 'all' && counts[f] ? ` ${counts[f]}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="scroll">
        {archived.length > 0 && (
          <div className="archived-row" onClick={() => go('/archived')}>
            <Archive size={19} className="muted" />
            <span>Archived</span>
            {archivedUnread > 0 && <span className="n">{archivedUnread}</span>}
          </div>
        )}
        {query && list.length > 0 && people.length > 0 && <div className="section-label">Chats</div>}
        {list.map((c) => (
          <ChatRow key={c.id} c={c} active={c.id === activeId} onOpen={() => go(`/chats/${c.id}`)} />
        ))}
        {people.length > 0 && <div className="section-label">People on Neva</div>}
        {people.map((u) => (
          <div key={u.id} className="lrow" onClick={() => startChat(u.id)}>
            <Avatar user={u} size={44} />
            <div className="grow">
              <div className="tt" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>{u.displayName}<Verified user={u} /></div>
              <div className="st ellipsis">@{u.username}{u.city ? ` · ${u.city}` : ''}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && people.length === 0 && (
          <Empty
            icon={<MessageSquarePlus size={26} />}
            title={query ? `No chats match “${q.trim()}”` : active.length ? 'Nothing here' : 'No conversations yet'}
            body={query ? (query.replace(/^@/, '').length < 2 ? 'Type at least 2 letters to search people.' : 'No one on Neva matches that name or @username yet.') : active.length ? 'Try another filter.' : 'Message a seller from any listing in Explore, or find people by @username.'}
            action={
              !active.length || query ? (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn primary sm" onClick={() => go('/new')}>New chat</button>
                  <button className="btn line sm" onClick={() => go('/explore')}>Explore</button>
                </div>
              ) : undefined
            }
          />
        )}
      </div>
    </>
  );
}

/** Phone layout: notifications live behind a bell in the Chats header, like the app. */
function NotifBell() {
  const { go } = useNav();
  const n = useStore((s) => s.notifications.filter((x) => !x.read).length);
  return (
    <button className="icon-btn only-sm" aria-label="Notifications" onClick={() => go('/notifications')} style={{ position: 'relative' }}>
      <Bell size={21} />
      {n > 0 && <span className="badge" style={{ position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, fontSize: 10, padding: '0 4px' }}>{n > 99 ? '99+' : n}</span>}
    </button>
  );
}

export function preview(m: Message | undefined, meId: string) {
  if (!m) return 'Start the conversation';
  if (m.deleted) return 'This message was deleted';
  const you = m.senderId === meId ? 'You: ' : '';
  if (m.type === 'image') return `${you}Photo`;
  if (m.type === 'offer') return `${you}Offer ${formatNaira(m.offer!.amountMinor)} · ${m.offer!.state}`;
  if (m.type === 'voice') return `${you}Voice message`;
  if (m.type === 'story_reply') return `${you}Replied to a status: ${m.body ?? ''}`;
  return you + (m.body ?? '');
}

/** Live story the viewer hasn't watched yet — drives the status ring on avatars. */
function useUnseenStory(userId?: string) {
  return useStore((s) => !!userId && s.stories.some((st) => st.userId === userId && isStoryLive(st) && !s.viewedStories.includes(st.id)));
}

function Ticks({ status }: { status: Message['status'] }) {
  const readReceipts = useStore((s) => s.settings.readReceipts);
  if (status === 'pending') return <span style={{ fontSize: 10, letterSpacing: 1 }}>•••</span>;
  if (status === 'failed') return <span style={{ color: 'var(--danger)', fontWeight: 600 }}>!</span>;
  if (status === 'sent') return <Check size={15} />;
  return <CheckCheck size={15} className={status === 'read' && readReceipts ? 'read' : ''} />;
}

export function ChatRow({ c, active, onOpen }: { c: Conversation; active: boolean; onOpen: () => void }) {
  const user = useStore((s) => s.users[c.participantId]);
  const meId = useStore((s) => s.meId);
  const last = useStore((s) => s.messages[c.id]?.at(-1));
  const typing = useLive((s) => s.typing[c.id]);
  const blocked = useStore((s) => s.blocked.includes(c.participantId));
  const story = useUnseenStory(c.participantId);
  const { go, id } = useNav();
  const st = useStore.getState;
  const snap = c.listingSnapshot;
  return (
    <div className={`crow${active ? ' on' : ''}${c.unread ? ' unread' : ''}${snap ? ' tall' : ''}`} onClick={onOpen}>
      <div
        className="av"
        title={story ? 'View status' : undefined}
        style={story ? { cursor: 'pointer' } : undefined}
        onClick={
          story
            ? (e) => {
                e.stopPropagation();
                go(`/updates/${c.participantId}`);
              }
            : undefined
        }>
        <Avatar user={user} size={49} online={user?.online} ring={story} />
      </div>
      <div className="body">
        <div className="l1">
          <span className="nm ellipsis">{user?.displayName ?? 'Unknown'}</span>
          <Verified user={user} />
          <span className="tm">{inboxTime(c.lastMessageAt)}</span>
        </div>
        <div className="l2">
          {last && last.senderId === meId && !last.deleted && !typing && !c.draft && !blocked && <Ticks status={last.status} />}
          <span className="tx ellipsis">
            {blocked ? <span className="faint">Blocked</span> : typing ? <span style={{ color: 'var(--accent)' }}>typing…</span> : c.draft ? <><span style={{ color: 'var(--accent)' }}>Draft: </span>{c.draft}</> : preview(last, meId)}
          </span>
          {c.muted && <BellOff size={14} />}
          {c.pinned && <Pin size={14} />}
          <Badge count={c.unread} muted={c.muted} />
          <span className="chev" onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={(t) => (
                <button onClick={t} aria-label="Chat options" style={{ display: 'grid', placeItems: 'center', color: 'var(--text2)' }}>
                  <ChevronDown size={20} />
                </button>
              )}
              items={[
                { label: c.status === 'archived' ? 'Unarchive chat' : 'Archive chat', icon: <Archive size={17} />, onClick: () => { st().setArchived(c.id, c.status !== 'archived'); showToast(c.status === 'archived' ? 'Chat unarchived' : 'Chat archived'); } },
                c.status !== 'archived' && { label: c.pinned ? 'Unpin chat' : 'Pin chat', icon: <Pin size={17} />, onClick: () => st().togglePin(c.id) },
                { label: c.muted ? 'Unmute notifications' : 'Mute notifications', icon: <BellOff size={17} />, onClick: () => st().toggleMute(c.id) },
                c.unread ? { label: 'Mark as read', icon: <MailOpen size={17} />, onClick: () => st().markRead(c.id) } : { label: 'Mark as unread', icon: <MailOpen size={17} />, onClick: () => st().markUnread(c.id) },
                { label: 'View shop', icon: <Store size={17} />, onClick: () => openDrawer({ kind: 'shop', id: c.participantId }) },
                { label: blocked ? 'Unblock' : 'Block', icon: <Ban size={17} />, onClick: () => { st().toggleBlock(c.participantId); showToast(blocked ? 'Unblocked' : `${user?.displayName ?? 'Contact'} blocked`); } },
                {
                  label: 'Delete chat',
                  icon: <Trash2 size={17} />,
                  danger: true,
                  onClick: () => {
                    if (!confirm(`Delete your chat with ${user?.displayName ?? 'this person'}?`)) return;
                    st().deleteConversation(c.id);
                    if (id === c.id) go('/chats');
                  },
                },
              ]}
            />
          </span>
        </div>
        {snap && (
          <div className="l3 ellipsis">
            <Tag size={11} /> {snap.title} · {formatNaira(snap.priceMinor)}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationView({ id }: { id: string }) {
  const { go, section } = useNav();
  const conv = useStore((s) => s.conversations[id]);
  const user = useStore((s) => (conv ? s.users[conv.participantId] : undefined));
  const messages = useStore((s) => s.messages[id]);
  const listing = useStore((s) => (conv?.listingId ? s.listings[conv.listingId] : undefined));
  const meId = useStore((s) => s.meId);
  const blocked = useStore((s) => (conv ? s.blocked.includes(conv.participantId) : false));
  const showLastSeen = useStore((s) => s.settings.showLastSeen);
  const typing = useLive((s) => s.typing[id]);
  const [text, setText] = useState(conv?.draft ?? '');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<Message | null>(null);
  const story = useUnseenStory(conv?.participantId);
  const draft = conv?.draft;
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const back = section === 'chats' ? '/chats' : `/${section}`;

  useEffect(() => {
    useLive.setState({ activeConversationId: id });
    useStore.getState().markRead(id);
    const el = input.current;
    if (el) {
      el.focus();
      // Prefilled draft (e.g. "Is this still available?" from a listing): put the caret at the end.
      el.setSelectionRange(el.value.length, el.value.length);
    }
    return () => useLive.setState({ activeConversationId: null });
  }, [id]);
  // A draft set from elsewhere while this chat is already open (e.g. "Message seller" again) fills an empty composer.
  const [seenDraft, setSeenDraft] = useState(draft);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    if (draft && !text) setText(draft);
  }
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length, typing]);
  useEffect(() => {
    const h = setTimeout(() => useStore.getState().setDraftText(id, text), 400);
    return () => clearTimeout(h);
  }, [text, id]);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const byId = useMemo(() => Object.fromEntries((messages ?? []).map((m) => [m.id, m])), [messages]);

  if (!conv || !user)
    return <Empty icon={<X size={26} />} title="Conversation not found" body="It may have been deleted." action={<button className="btn line sm" onClick={() => go('/chats')}>Back to chats</button>} />;

  const list = messages ?? [];
  const canOffer = !!listing && listing.sellerId !== meId && listing.status === 'active' && !blocked;
  const send = (partial: Partial<Message>) => useStore.getState().sendMessage(id, partial);
  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    const base: Partial<Message> = list.length === 0 && conv.listingId ? { type: 'listing', listingId: conv.listingId, body } : { body };
    send({ ...base, replyToId: replyTo?.id });
    setText('');
    setReplyTo(null);
    useStore.getState().setDraftText(id, '');
  };
  const closeOffer = () => {
    setOffer(null);
    setCounterFor(null);
  };
  const sendOffer = () => {
    const amount = Number((offer ?? '').replace(/\D/g, '')) * 100;
    if (amount <= 0) return;
    if (counterFor) useStore.getState().respondToOffer(id, counterFor.id, 'countered');
    send({ type: 'offer', offer: { amountMinor: amount, state: 'pending' } });
    closeOffer();
  };
  const openOffer = () => {
    if (!listing) return;
    setCounterFor(null);
    setOffer(String(Math.round((listing.priceMinor * 0.9) / 100)));
  };
  const openCounter = (m: Message) => {
    setCounterFor(m);
    setOffer(String(Math.round((m.offer?.amountMinor ?? 0) / 100)));
  };
  const myCount = list.filter((m) => m.senderId === meId).length;
  const sendQuick = (q: string) => send(list.length === 0 && conv.listingId ? { type: 'listing', listingId: conv.listingId, body: q } : { body: q });
  const askPrice = listing?.priceMinor ?? conv.listingSnapshot?.priceMinor ?? 0;
  const offerMinor = Number((offer ?? '').replace(/\D/g, '')) * 100;
  const pct = askPrice ? Math.round((1 - offerMinor / askPrice) * 100) : 0;
  const shop = () => openDrawer({ kind: 'shop', id: user.id });
  const st = useStore.getState;

  return (
    <>
      <div className="main-head">
        <button className="icon-btn only-sm" onClick={() => go(back)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <Avatar user={user} size={40} online={user.online} ring={story} onClick={story ? () => go(`/updates/${user.id}`) : shop} />
        <div className="who" onClick={shop}>
          <div className="n">
            <span className="ellipsis">{user.displayName}</span>
            <Verified user={user} />
          </div>
          <div className="s ellipsis" style={typing ? { color: 'var(--accent)' } : undefined}>
            {typing ? 'typing…' : blocked ? 'You blocked this contact' : showLastSeen && (user.online || user.lastSeenAt) ? lastSeen(user.online, user.lastSeenAt) : 'click here for shop info'}
          </div>
        </div>
        <button className="icon-btn" title="View shop" aria-label="View shop" onClick={shop}>
          <Store size={20} />
        </button>
        <Dropdown
          trigger={(t, o) => (
            <button className={`icon-btn${o ? ' on' : ''}`} onClick={t} aria-label="Chat menu">
              <MoreVertical size={20} />
            </button>
          )}
          items={[
            { label: 'Shop info', onClick: shop },
            { label: conv.pinned ? 'Unpin chat' : 'Pin chat', onClick: () => st().togglePin(id) },
            { label: conv.muted ? 'Unmute notifications' : 'Mute notifications', onClick: () => st().toggleMute(id) },
            { label: conv.status === 'archived' ? 'Unarchive chat' : 'Archive chat', onClick: () => { st().setArchived(id, conv.status !== 'archived'); showToast(conv.status === 'archived' ? 'Chat unarchived' : 'Chat archived'); go('/chats'); } },
            { label: 'Clear chat', onClick: () => confirm('Clear all messages in this chat?') && st().clearChat(id) },
            st().canReview(user.id) && { label: 'Rate seller', onClick: () => useUI.setState({ review: user.id }) },
            { label: blocked ? 'Unblock' : 'Block', onClick: () => { st().toggleBlock(user.id); showToast(blocked ? 'Unblocked' : `${user.displayName} blocked`); } },
            { label: 'Report', onClick: () => useUI.setState({ report: { type: 'user', target: user.id, name: user.displayName } }) },
            { label: 'Close chat', onClick: () => go(back) },
            { label: 'Delete chat', danger: true, onClick: () => { if (confirm('Delete this chat?')) { st().deleteConversation(id); go('/chats'); } } },
          ]}
        />
      </div>

      {conv.listingSnapshot && (
        <div className="listing-strip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {conv.listingSnapshot.image ? <img className="thumb" src={conv.listingSnapshot.image} alt="" /> : <div className="thumb" />}
          <div className="grow" style={{ cursor: listing ? 'pointer' : undefined }} onClick={() => listing && openDrawer({ kind: 'listing', id: listing.id })}>
            <div className="ellipsis" style={{ fontWeight: 500 }}>{conv.listingSnapshot.title}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontWeight: 600 }}>{formatNaira(listing?.priceMinor ?? conv.listingSnapshot.priceMinor)}</span>
              {listing && listing.status !== 'active' ? <span className="error" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{listing.status}</span> : <Cond c={conv.listingSnapshot.condition} short />}
            </div>
          </div>
          {canOffer && (
            <button className="btn line sm" onClick={openOffer}>
              <Tag size={15} /> Make offer
            </button>
          )}
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="wallpaper" />
        <div className="chat-scroll">
          <div className="notice">
            <Lock size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
            Keep the conversation on Neva. Meet in public and inspect before paying — payments made outside Neva aren’t protected.
          </div>
          {list.map((m, i) => {
            const prev = list[i - 1];
            const mine = m.senderId === meId;
            const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
            const first = newDay || !prev || prev.senderId !== m.senderId || prev.type === 'system';
            return (
              <div key={m.id} style={{ display: 'contents' }}>
                {newDay && <div className="day-pill">{dayLabel(m.createdAt)}</div>}
                {m.type === 'system' ? (
                  <div className="day-pill">{m.body}</div>
                ) : (
                  <div className={`mrow${mine ? ' out' : ''}${first && i > 0 ? ' gap' : ''}${m.reactions && Object.keys(m.reactions).length ? ' has-react' : ''}`}>
                    <div className={`bubble${first ? ` tail ${mine ? 'out' : 'in'}` : ''}`}>
                      {!m.deleted && (
                        <Dropdown
                          align={mine ? 'right' : 'left'}
                          header={
                            !blocked && (
                              <div className="emojis">
                                {EMOJIS.map((e) => (
                                  <button key={e} onClick={() => st().react(id, m.id, e)}>{e}</button>
                                ))}
                              </div>
                            )
                          }
                          trigger={(t) => (
                            <button className="hover-chev" onClick={t} aria-label="Message options">
                              <ChevronDown size={16} />
                            </button>
                          )}
                          items={[
                            !blocked && { label: 'Reply', icon: <Reply size={17} />, onClick: () => { setReplyTo(m); input.current?.focus(); } },
                            m.body && { label: 'Copy', icon: <Copy size={17} />, onClick: () => { navigator.clipboard?.writeText(m.body!).catch(() => {}); showToast('Copied'); } },
                            { label: m.starred ? 'Unstar' : 'Star', icon: <Star size={17} />, onClick: () => st().toggleStar(id, m.id) },
                            m.status === 'failed' && { label: 'Retry sending', icon: <SendHorizontal size={17} />, onClick: () => st().retryMessage(id, m.id) },
                            !mine && { label: 'Report', icon: <Flag size={17} />, onClick: () => useUI.setState({ report: { type: 'message', target: m.id, name: user.displayName } }) },
                            mine && { label: 'Delete for everyone', icon: <Trash2 size={17} />, danger: true, onClick: () => st().deleteMessage(id, m.id) },
                          ]}
                        />
                      )}
                      {m.replyToId && byId[m.replyToId] && (
                        <div className="quote">
                          <div className="grow">
                            <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12.5 }}>{byId[m.replyToId]!.senderId === meId ? 'You' : user.displayName}</div>
                            <div className="ellipsis" style={{ opacity: 0.85 }}>{preview(byId[m.replyToId], '')}</div>
                          </div>
                        </div>
                      )}
                      <MessageBody m={m} mine={mine} blocked={blocked} onOffer={(state) => st().respondToOffer(id, m.id, state)} onCounter={() => openCounter(m)} />
                      <span className="meta">
                        {m.starred && <Star size={11} fill="currentColor" />}
                        {clockTime(m.createdAt)}
                        {mine && !m.deleted && <Ticks status={m.status} />}
                      </span>
                      {mine && m.status === 'failed' && !m.deleted && (
                        <button className="failed-note" onClick={() => st().retryMessage(id, m.id)}>
                          Not delivered · click to retry
                        </button>
                      )}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <span className="reacts">
                          {Array.from(new Set(Object.values(m.reactions))).join('')}
                          {Object.keys(m.reactions).length > 1 && <span className="rc">{Object.keys(m.reactions).length}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {typing && (
            <div className="mrow gap">
              <div className="bubble tail in muted">typing…</div>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      {blocked ? (
        <div className="composer" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text2)', gap: 12 }}>
          <UserX size={18} /> You blocked {user.displayName}.
          <button className="btn ghost sm" onClick={() => st().toggleBlock(user.id)}>Unblock</button>
        </div>
      ) : (
        <>
          {replyTo && (
            <div className="reply-bar">
              <div className="q">
                <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12.5 }}>{replyTo.senderId === meId ? 'You' : user.displayName}</div>
                <div className="ellipsis muted">{preview(replyTo, '')}</div>
              </div>
              <button className="icon-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                <X size={18} />
              </button>
            </div>
          )}
          {myCount < 2 && !replyTo && !text && (
            <div className="quick-replies">
              {QUICK_REPLIES.map((q) => (
                <button key={q} className="pill" onClick={() => sendQuick(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="composer">
            <Dropdown
              align="left"
              trigger={(t, o) => (
                <button className={`send-btn${o ? ' on' : ''}`} onClick={t} aria-label="Attach" style={{ transform: o ? 'rotate(45deg)' : undefined, transition: 'transform .15s' }}>
                  <Plus size={24} />
                </button>
              )}
              items={[
                { label: 'Photo', icon: <ImageIcon size={18} color="var(--accent)" />, onClick: async () => { const [img] = await pickImages(); if (img) send({ type: 'image', imageUri: img, replyToId: replyTo?.id }); setReplyTo(null); } },
                canOffer && { label: 'Make an offer', icon: <Tag size={18} color="var(--accent)" />, onClick: openOffer },
              ]}
            />
            <textarea
              ref={input}
              rows={1}
              placeholder="Type a message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
                if (e.key === 'Escape') setReplyTo(null);
              }}
            />
            <button className={`send-btn${text.trim() ? ' go' : ''}`} disabled={!text.trim()} onClick={sendText} aria-label="Send">
              <SendHorizontal size={20} />
            </button>
          </div>
        </>
      )}

      {offer !== null && (listing || counterFor) && (
        <Modal
          title={counterFor ? 'Counter offer' : 'Make an offer'}
          onClose={closeOffer}
          footer={
            <button className="btn primary" disabled={!Number(offer)} onClick={sendOffer}>
              {counterFor ? 'Send counter' : 'Send offer'}
              {offerMinor > 0 ? ` · ${formatNaira(offerMinor)}` : ''}
            </button>
          }>
          <div className="muted">
            {listing?.title ?? conv.listingSnapshot?.title ?? 'Offer'}
            {askPrice > 0 && <> · listed at <b style={{ color: 'var(--text)' }}>{formatNaira(askPrice)}</b></>}
            {counterFor?.offer && <> · they offered <b style={{ color: 'var(--text)' }}>{formatNaira(counterFor.offer.amountMinor)}</b></>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>₦</span>
            <input className="field" autoFocus style={{ fontSize: 26, fontWeight: 600, height: 56 }} value={Number(offer || 0).toLocaleString('en-NG')} onChange={(e) => setOffer(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={(e) => e.key === 'Enter' && sendOffer()} />
          </div>
          {askPrice > 0 && offerMinor > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: pct > 25 ? 'var(--danger)' : pct > 10 ? 'var(--text2)' : 'var(--accent)' }}>
              {pct > 0 ? `${pct}% below asking` : pct < 0 ? `${-pct}% above asking` : 'Asking price'}
              {pct > 25 ? ' · very low offers are often ignored' : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {(askPrice > 0 ? [0.95, 0.9, 0.85] : []).map((f) => {
              const v = Math.round((askPrice * f) / 100_000) * 1000;
              return (
                <button key={f} className="pill" onClick={() => setOffer(String(v))}>
                  {formatNaira(v * 100)}
                </button>
              );
            })}
          </div>
          <div className="faint" style={{ fontSize: 12.5 }}>Offers aren’t binding payments. Inspect before paying.</div>
        </Modal>
      )}
    </>
  );
}

function MessageBody({ m, mine, blocked, onOffer, onCounter }: { m: Message; mine: boolean; blocked?: boolean; onOffer: (s: 'accepted' | 'declined') => void; onCounter: () => void }) {
  const listing = useStore((s) => (m.listingId ? s.listings[m.listingId] : undefined));
  const lightbox = (src: string) => useUI.setState({ lightbox: src });
  if (m.deleted) return <i style={{ opacity: 0.7 }}>This message was deleted</i>;
  if (m.type === 'image')
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="photo" src={m.imageUri} alt="" onClick={() => lightbox(m.imageUri!)} />
        {m.body}
      </>
    );
  if (m.type === 'offer' && m.offer) {
    const label = { pending: 'Awaiting response', accepted: 'Accepted', declined: 'Declined', countered: 'Countered' }[m.offer.state];
    return (
      <div className="offer-card" style={{ minWidth: 210 }}>
        <div className="lbl">{mine ? 'Your offer' : 'Offer'}</div>
        <div className="amt">{formatNaira(m.offer.amountMinor)}</div>
        <div style={{ fontSize: 12.5, opacity: 0.8 }}>{label}</div>
        {!mine && !blocked && m.offer.state === 'pending' && (
          <div className="act">
            <button className="btn primary sm" onClick={() => onOffer('accepted')}>Accept</button>
            <button className="btn line sm" onClick={onCounter}>Counter</button>
            <button className="btn line sm" onClick={() => onOffer('declined')}>Decline</button>
          </div>
        )}
      </div>
    );
  }
  if (m.type === 'listing' && listing)
    return (
      <>
        <div className="quote" style={{ cursor: 'pointer', gap: 10, alignItems: 'center' }} onClick={() => openDrawer({ kind: 'listing', id: listing.id })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {listing.images[0] && <img src={listing.images[0]} alt="" style={{ width: 46, height: 46, borderRadius: 6, objectFit: 'cover' }} />}
          <div className="grow">
            <div className="ellipsis" style={{ fontWeight: 500 }}>{listing.title}</div>
            <div style={{ fontWeight: 600 }}>{formatNaira(listing.priceMinor)}</div>
          </div>
        </div>
        {m.body}
      </>
    );
  if (m.type === 'story_reply')
    return (
      <>
        <div className="quote" style={{ gap: 10, alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {m.storyImage && <img src={m.storyImage} alt="" style={{ width: 34, height: 46, borderRadius: 4, objectFit: 'cover' }} />}
          <span className="muted">Status</span>
        </div>
        {m.body}
      </>
    );
  if (m.type === 'voice') return <VoiceNote seconds={Math.max(1, m.voice?.seconds ?? 1)} />;
  return <>{m.body}</>;
}

const BARS = [6, 12, 9, 16, 11, 20, 8, 14, 18, 10, 13, 22, 11, 7, 14, 17, 9, 12, 6, 10, 15, 8];
const clip = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Voice note bubble. Audio isn't stored yet, so playback is simulated progress (same as mobile). Recording stays on mobile. */
function VoiceNote({ seconds }: { seconds: number }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const started = Date.now() - from.current * 1000;
    const t = setInterval(() => {
      const e = Math.min(seconds, (Date.now() - started) / 1000);
      if (e >= seconds) {
        from.current = 0;
        setPlaying(false);
        setElapsed(0);
      } else {
        from.current = e;
        setElapsed(e);
      }
    }, 100);
    return () => clearInterval(t);
  }, [playing, seconds]);
  const progress = elapsed / seconds;
  return (
    <div className="voice">
      <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <div className="wave" aria-hidden>
        {BARS.map((h, i) => (
          <i key={i} className={(i + 0.5) / BARS.length <= progress ? 'on' : ''} style={{ height: h }} />
        ))}
      </div>
      <span className="dur">{clip(Math.floor(playing || elapsed > 0 ? elapsed : seconds))}</span>
    </div>
  );
}

/** Shared by the Archived panel. */
export function SlideHead({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="slide-head">
      <button className="icon-btn" onClick={onBack} aria-label="Back">
        <ArrowLeft size={21} />
      </button>
      <h2 style={right ? { flex: 1 } : undefined}>{title}</h2>
      {right}
    </div>
  );
}

