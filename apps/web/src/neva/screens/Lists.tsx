'use client';

import { clockTime, dayLabel, type Profile } from '@neva/core';
import { Archive, AtSign, Compass, Search, Send, Star, UserX, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Empty, Verified } from '../components/ui';
import { useNav } from '../nav';
import { showToast, useStore } from '../store';
import { ChatRow, preview, SlideHead } from './Chats';

export function ArchivedPanel() {
  const { go, id } = useNav();
  const conversations = useStore((s) => s.conversations);
  const list = Object.values(conversations)
    .filter((c) => c.status === 'archived')
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return (
    <>
      <SlideHead title="Archived" onBack={() => go('/chats')} />
      <div className="scroll">
        {list.length > 0 && <div className="faint" style={{ fontSize: 13, padding: '14px 24px', lineHeight: 1.5 }}>Archived chats stay here when new messages arrive. Unarchive from the chat menu.</div>}
        {list.map((c) => (
          <ChatRow key={c.id} c={c} active={c.id === id} onOpen={() => go(`/archived/${c.id}`)} />
        ))}
        {list.length === 0 && <Empty icon={<Archive size={26} />} title="No archived chats" body="Archive a chat from its menu to tidy your list." />}
      </div>
    </>
  );
}

export function StarredPanel() {
  const { go } = useNav();
  const users = useStore((s) => s.users);
  const conversations = useStore((s) => s.conversations);
  const meId = useStore((s) => s.meId);
  const starred = useStore(useShallow((s) => Object.values(s.messages).flatMap((list) => list.filter((m) => m.starred && !m.deleted))));
  const list = [...starred].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <>
      <SlideHead title="Starred messages" onBack={() => go('/chats')} />
      <div className="scroll">
        {list.map((m) => {
          const other = users[conversations[m.conversationId]?.participantId ?? ''];
          const sender = m.senderId === meId ? 'You' : (other?.displayName ?? 'Unknown');
          return (
            <div key={m.id} className="lrow" style={{ alignItems: 'flex-start' }} onClick={() => go(`/starred/${m.conversationId}`)}>
              <Avatar user={m.senderId === meId ? users[meId] : other} size={40} />
              <div className="grow">
                <div style={{ display: 'flex', gap: 6, fontSize: 13.5 }}>
                  <span className="grow ellipsis">{sender}{m.senderId === meId && other ? ` › ${other.displayName}` : ''}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{dayLabel(m.createdAt)}</span>
                </div>
                <div style={{ marginTop: 6, background: m.senderId === meId ? 'var(--bubble-out)' : 'var(--input)', color: m.senderId === meId ? 'var(--bubble-out-text)' : undefined, padding: '6px 9px', borderRadius: 8, display: 'inline-block', maxWidth: '100%' }}>
                  <span style={{ wordBreak: 'break-word' }}>{preview(m, '')}</span>
                  <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}><Star size={10} fill="currentColor" style={{ display: 'inline', verticalAlign: -1 }} /> {clockTime(m.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <Empty icon={<Star size={26} />} title="No starred messages" body="Hover a message, open its menu and choose Star to find it here later." />}
      </div>
    </>
  );
}

/** Start a DM by @username / name — no stranger directory, no phone numbers. */
export function NewChatPanel() {
  const { go } = useNav();
  const me = useStore((s) => s.users[s.meId]);
  const users = useStore((s) => s.users);
  const follows = useStore((s) => s.follows);
  const conversations = useStore((s) => s.conversations);
  const blocked = useStore((s) => s.blocked);
  const [q, setQ] = useState('');
  const query = q.trim();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const results = useMemo(() => (query.replace(/^@/, '').length >= 2 ? useStore.getState().searchPeople(query) : []), [query, users]);
  const known = useMemo(
    () =>
      Array.from(new Set([...follows, ...Object.values(conversations).map((c) => c.participantId)]))
        .map((id) => users[id])
        .filter((u): u is Profile => !!u && !blocked.includes(u.id))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [follows, conversations, users, blocked],
  );
  const open = (u: Profile) => go(`/chats/${useStore.getState().startConversation(u.id)}`);
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(done);
    } catch {
      showToast(text);
    }
  };
  const searching = query.replace(/^@/, '').length >= 2;
  const people = searching ? results : known;

  return (
    <>
      <SlideHead title="New chat" onBack={() => go('/chats')} />
      <div className="search" style={{ marginTop: 10 }}>
        <Search size={17} />
        <input autoFocus placeholder="Search @username or name" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button onClick={() => setQ('')} aria-label="Clear">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="scroll">
        {!searching && (
          <>
            <Action icon={<AtSign size={21} />} title="Share your username" sub={`People can search @${me?.username ?? ''} to message you`} onClick={() => copy(`Find me on Neva: @${me?.username ?? ''}`, 'Copied — paste it anywhere')} />
            <Action icon={<Send size={20} />} title="Invite friends" sub="Copy an invite message" onClick={() => copy(`Join me on Neva — buy and sell gadgets and chat with sellers. Search @${me?.username ?? ''} when you’re in.`, 'Invite copied')} />
            <Action icon={<Compass size={21} />} title="Find sellers" sub="Browse Explore and message from any listing" onClick={() => go('/explore')} />
            {known.length > 0 && <div className="section-label">Following & recent</div>}
          </>
        )}
        {people.map((u) => (
          <div key={u.id} className="lrow" onClick={() => open(u)}>
            <Avatar user={u} size={44} online={u.online} />
            <div className="grow">
              <div className="tt" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>{u.displayName}<Verified user={u} /></div>
              <div className="st ellipsis">@{u.username}{u.city ? ` · ${u.city}` : ''}{u.bio ? ` · ${u.bio}` : ''}</div>
            </div>
          </div>
        ))}
        {searching && results.length === 0 && <Empty icon={<UserX size={26} />} title={`No one found for “${query}”`} body="Check the spelling of their @username, or invite them to Neva." />}
      </div>
    </>
  );
}

function Action({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <div className="lrow" onClick={onClick}>
      <div className="avatar" style={{ width: 44, height: 44, background: 'var(--accent-strong)', color: '#fff' }}>{icon}</div>
      <div className="grow">
        <div className="tt">{title}</div>
        <div className="st">{sub}</div>
      </div>
    </div>
  );
}
