'use client';

import { Archive, Bell, CircleDashed, Compass, MessageSquareText, PlusSquare, Settings, Star } from 'lucide-react';
import { useEffect } from 'react';

import { Avatar, Badge, Lightbox, ToastHost } from './components/ui';
import { startSync } from './lib/sync';
import { useNav } from './nav';
import { AuthPage, ProfileSetupPage } from './screens/Auth';
import { ChatsSection } from './screens/Chats';
import { ExploreSection } from './screens/Explore';
import { ArchivedPanel, NewChatPanel, StarredPanel } from './screens/Lists';
import { ReportModal, ReviewModal } from './screens/Modals';
import { NotificationsSection } from './screens/Notifications';
import { OnboardingInterestsPage } from './screens/OnboardingInterests';
import { SellModal } from './screens/Sell';
import { SettingsSection } from './screens/Settings';
import { UpdatesSection } from './screens/Updates';
import { isStoryLive, openDrawer, openSell, useStore, useUI } from './store';
import { useApplyTheme } from './theme';

export function NevaApp() {
  useApplyTheme();
  const hydrated = useStore((s) => s.hydrated);
  const stage = useStore((s) => s.auth.stage);
  useEffect(() => {
    if (hydrated) startSync();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--panel)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/neva-mark.png" alt="Neva" style={{ width: 88, height: 88 }} />
      </div>
    );
  }
  if (stage === 'signed_out') return <><AuthPage /><ToastHost /></>;
  if (stage === 'profile') return <><ProfileSetupPage /><ToastHost /></>;
  if (stage === 'interests') return <><OnboardingInterestsPage /><ToastHost /></>;
  return <Shell />;
}

function Shell() {
  const { section, go } = useNav();
  const me = useStore((s) => s.users[s.meId]);
  const unread = useStore((s) => Object.values(s.conversations).filter((c) => c.unread > 0 && c.status !== 'archived' && !c.muted).length);
  const newStories = useStore((s) => s.stories.some((st) => st.userId !== s.meId && isStoryLive(st) && !s.viewedStories.includes(st.id)));
  const notifs = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const sell = useUI((s) => s.sell);
  const report = useUI((s) => s.report);
  const review = useUI((s) => s.review);


  // Shared links (/explore?listing=<id> or ?shop=<id>) open that listing or shop.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const listing = q.get('listing');
    const shop = q.get('shop');
    if (listing) openDrawer({ kind: 'listing', id: listing });
    else if (shop) openDrawer({ kind: 'shop', id: shop });
  }, []);

  let content: React.ReactNode;
  switch (section) {
    case 'updates':
      content = <UpdatesSection />;
      break;
    case 'explore':
      content = <ExploreSection />;
      break;
    case 'settings':
      content = <SettingsSection />;
      break;
    case 'notifications':
      content = <NotificationsSection />;
      break;
    case 'archived':
      content = <ChatsSection panel={<ArchivedPanel />} />;
      break;
    case 'starred':
      content = <ChatsSection panel={<StarredPanel />} />;
      break;
    case 'new':
      content = <ChatsSection panel={<NewChatPanel />} />;
      break;
    default:
      content = <ChatsSection />;
  }

  return (
    <div className="app">
      <nav className="rail" aria-label="Neva">
        <RailButton go={go} active={section === 'chats'} id="chats" label="Chats" icon={<MessageSquareText size={22} />} badge={unread} />
        <RailButton go={go} active={section === 'updates'} id="updates" label="Updates" icon={<CircleDashed size={22} />} dot={newStories} />
        <RailButton go={go} active={section === 'explore'} id="explore" label="Explore" icon={<Compass size={22} />} />
        <RailButton go={go} active={section === 'sell'} id="sell" label="Sell an item" icon={<PlusSquare size={22} />} onClick={() => openSell()} />
        <div className="rail-sep" />
        <RailButton go={go} active={section === 'starred'} id="starred" label="Starred messages" icon={<Star size={21} />} />
        <RailButton go={go} active={section === 'archived'} id="archived" label="Archived" icon={<Archive size={21} />} />
        <div className="rail-spacer" />
        <RailButton go={go} active={section === 'notifications'} id="notifications" label="Notifications" icon={<Bell size={21} />} badge={notifs} />
        <RailButton go={go} active={section === 'settings'} id="settings" label="Settings" icon={<Settings size={21} />} />
        <button className="rail-btn tip" data-tip="Profile" aria-label="Profile" onClick={() => go('/settings/profile')} style={{ marginTop: 6 }}>
          <Avatar user={me} size={30} />
        </button>
      </nav>
      {content}
      {sell.open && <SellModal editingId={sell.editingId} />}
      {report && <ReportModal />}
      {review && <ReviewModal sellerId={review} />}
      <Lightbox />
      <ToastHost />
    </div>
  );
}

type RailProps = { id: string; label: string; icon: React.ReactNode; badge?: number; dot?: boolean; onClick?: () => void; active: boolean; go: (to: string) => void };

function RailButton({ id, label, icon, badge, dot, onClick, active, go }: RailProps) {
  return (
    <button className={`rail-btn tip${active ? ' on' : ''}`} data-tip={label} aria-label={label} onClick={onClick ?? (() => go(`/${id}`))}>
      {icon}
      {!!badge && <Badge count={badge} />}
      {dot && <span className="dot" />}
    </button>
  );
}
