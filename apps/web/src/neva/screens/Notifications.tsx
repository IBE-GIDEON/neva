'use client';

import { type NotificationItem, timeAgo } from '@neva/core';
import { Bell, MessageCircle, Settings2, ShieldAlert, Tag, TrendingDown, UserPlus, X } from 'lucide-react';
import { useEffect } from 'react';

import { Avatar, Empty } from '../components/ui';
import { useNav } from '../nav';
import { openDrawer, useStore, useUI } from '../store';
import { Intro, SlideHead } from './Chats';
import { InfoDrawer } from './Info';

const ICONS: Record<NotificationItem['type'], React.ReactNode> = {
  message: <MessageCircle size={20} />,
  follow: <UserPlus size={20} />,
  new_listing: <Tag size={20} />,
  price_drop: <TrendingDown size={20} />,
  moderation: <ShieldAlert size={20} />,
  security: <ShieldAlert size={20} />,
  offer: <Tag size={20} />,
  system: <Bell size={20} />,
};

export function NotificationsSection() {
  const { go } = useNav();
  const items = useStore((s) => s.notifications);
  const users = useStore((s) => s.users);
  const drawer = useUI((s) => s.drawer);
  useEffect(() => {
    // Opening the panel marks everything read after a moment, like WhatsApp's unread divider.
    const t = setTimeout(() => useStore.getState().markNotificationsRead(), 1500);
    return () => clearTimeout(t);
  }, []);

  const open = (n: NotificationItem) => {
    if (n.type === 'security') go('/settings/privacy');
    else if (n.conversationId) go(`/chats/${n.conversationId}`);
    else if (n.listingId) openDrawer({ kind: 'listing', id: n.listingId });
    else if (n.actorId) openDrawer({ kind: 'shop', id: n.actorId });
  };
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <div className="side">
        <SlideHead
          title="Notifications"
          onBack={() => go('/chats')}
          right={
            <button className="icon-btn" title="Notification settings" aria-label="Notification settings" onClick={() => go('/settings/notifications')}>
              <Settings2 size={20} />
            </button>
          }
        />
        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px' }}>
            <button className="btn ghost sm" onClick={() => confirm('Clear all notifications?') && useStore.getState().clearNotifications()}>Clear all</button>
          </div>
        )}
        <div className="scroll">
          {sorted.map((n) => {
            const actor = n.actorId ? users[n.actorId] : undefined;
            return (
              <div key={n.id} className="lrow crow-like" style={{ alignItems: 'flex-start', position: 'relative' }} onClick={() => open(n)}>
                {actor ? <Avatar user={actor} size={44} /> : <div className="avatar" style={{ width: 44, height: 44, background: 'var(--input)', color: 'var(--text)' }}>{ICONS[n.type]}</div>}
                <div className="grow">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="tt grow" style={{ fontWeight: n.read ? 400 : 600, fontSize: 15 }}>{n.title}</span>
                    <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="st" style={{ lineHeight: 1.4 }}>{n.body}</div>
                </div>
                {!n.read && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />}
                <button
                  className="icon-btn"
                  style={{ width: 30, height: 30 }}
                  aria-label="Delete notification"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    useStore.getState().deleteNotification(n.id);
                  }}>
                  <X size={16} />
                </button>
              </div>
            );
          })}
          {items.length === 0 && <Empty icon={<Bell size={26} />} title="You’re all caught up" body="Follows, offers, price drops and safety alerts show up here." />}
        </div>
      </div>
      <div className="main hide-sm">
        <Intro title="Notifications" body="Activity on your shop and the sellers you follow. Click a notification to open it, or remove it with ×." />
      </div>
      {drawer && <InfoDrawer />}
    </>
  );
}
