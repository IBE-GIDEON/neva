'use client';

import { compactNumber, timeAgo, tidyPlace } from '@neva/core';
import { ArrowLeft, Bell, Bookmark, Camera, ChevronRight, CircleHelp, Download, FileText, Fingerprint, KeyRound, LifeBuoy, Lock, LogOut, Palette, Store, Trash2, User, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Avatar, Empty, Modal } from '../components/ui';
import { LocationInput } from '../components/LocationInput';
import { signOutEverywhere } from '../lib/auth';
import { pickImages } from '../lib/images';
import { BACKEND_READY } from '../lib/supabase';
import { useNav } from '../nav';
import { openDrawer, showToast, useStore } from '../store';
import { Intro, SlideHead } from './Chats';
import { SafetyCentre, VerificationMeanings } from './SafetyCentre';

const SECTIONS = [
  { id: 'profile', label: 'Profile', sub: 'Name, photo, shop details', icon: <User size={21} /> },
  { id: 'account', label: 'Account', sub: 'Email, sign-in, your data', icon: <KeyRound size={21} /> },
  { id: 'privacy', label: 'Privacy', sub: 'Last seen, status, blocked', icon: <Lock size={21} /> },
  { id: 'notifications', label: 'Notifications', sub: 'Messages, offers, follows', icon: <Bell size={21} /> },
  { id: 'appearance', label: 'Appearance', sub: 'Theme', icon: <Palette size={21} /> },
  { id: 'help', label: 'Help & safety', sub: 'Safety centre, condition guide, your reports', icon: <CircleHelp size={21} /> },
];

export function SettingsSection() {
  const { id, go } = useNav();
  const me = useStore((s) => s.users[s.meId]);
  const meId = useStore((s) => s.meId);
  const nListings = useStore((s) => Object.values(s.listings).filter((l) => l.sellerId === s.meId && l.status !== 'removed').length);
  const nFollowing = useStore((s) => s.follows.length);
  const nSaved = useStore((s) => s.saved.filter((x) => s.listings[x] && s.listings[x]!.status !== 'removed').length);
  return (
    <>
      <div className={`side${id ? ' hide-sm' : ''}`}>
        <SlideHead title="Settings" onBack={() => go('/chats')} />
        <div className="scroll">
          <div className={`lrow${id === 'profile' ? ' on' : ''}`} style={{ minHeight: 96, padding: '14px 20px' }} onClick={() => go('/settings/profile')}>
            <Avatar user={me} size={72} />
            <div className="grow">
              <div style={{ fontSize: 18 }}>{me?.displayName}</div>
              <div className="st ellipsis">@{me?.username}{me?.bio ? ` · ${me.bio}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', margin: '0 16px 8px', padding: '10px 0', borderRadius: 12, background: 'var(--input)' }}>
            <Stat value={String(nListings)} label="Listings" onClick={() => go('/explore/mine')} />
            <Stat value={compactNumber(me?.followers ?? 0)} label="Followers" onClick={() => openDrawer({ kind: 'shop', id: meId })} />
            <Stat value={String(nFollowing)} label="Following" onClick={() => go('/explore/following')} />
            <Stat value={String(nSaved)} label="Saved" onClick={() => go('/explore/saved')} />
          </div>
          {SECTIONS.slice(1).map((s) => (
            <div key={s.id} className={`lrow${id === s.id ? ' on' : ''}`} onClick={() => go(`/settings/${s.id}`)}>
              <div className="ic">{s.icon}</div>
              <div className="grow">
                <div className="tt">{s.label}</div>
                <div className="st">{s.sub}</div>
              </div>
            </div>
          ))}
          <div className="lrow" onClick={() => go('/explore/mine')}>
            <div className="ic"><Store size={21} /></div>
            <div className="grow"><div className="tt">My listings</div><div className="st">Edit, pause or mark items sold</div></div>
          </div>
          <div className="lrow" onClick={() => go('/explore/saved')}>
            <div className="ic"><Bookmark size={21} /></div>
            <div className="grow"><div className="tt">Saved</div><div className="st">Listings you saved</div></div>
          </div>
          <div className="lrow danger" onClick={() => confirm('Log out of Neva on this browser?') && signOutEverywhere()}>
            <div className="ic"><LogOut size={21} /></div>
            <div className="tt">Log out</div>
          </div>
        </div>
      </div>
      <div className={`main${id ? '' : ' hide-sm'}`}>
        {id ? (
          <>
            <div className="main-head">
              <button className="icon-btn only-sm" onClick={() => go('/settings')} aria-label="Back"><ArrowLeft size={20} /></button>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{SECTIONS.find((s) => s.id === id)?.label ?? 'Settings'}</div>
            </div>
            <div className="scroll">
              <div style={{ maxWidth: 640, padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                {id === 'profile' && <ProfileSettings key={me?.id} />}
                {id === 'account' && <AccountSettings />}
                {id === 'privacy' && <PrivacySettings />}
                {id === 'notifications' && <NotificationSettings />}
                {id === 'appearance' && <AppearanceSettings />}
                {id === 'help' && <HelpSettings />}
              </div>
            </div>
          </>
        ) : (
          <Intro title="Settings" body="Manage your profile, privacy, notifications and how Neva looks on this computer." />
        )}
      </div>
    </>
  );
}

function Stat({ value, label, onClick }: { value: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2px 0' }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
      <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
    </button>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
      <div className="grow">
        <div>{label}</div>
        {sub && <div className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent-strong)' }} />
    </label>
  );
}

function ProfileSettings() {
  const me = useStore((s) => s.users[s.meId])!;
  const users = useStore((s) => s.users);
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [shopName, setShopName] = useState(me.shopName ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [city, setCity] = useState(me.city);
  const usernameError =
    username === me.username ? '' : !/^[a-z0-9._]{3,20}$/.test(username) ? '3–20 characters: letters, numbers, . and _' : Object.values(users).some((u) => u.id !== me.id && u.username === username) ? 'Username taken' : '';
  const dirty = name !== me.displayName || username !== me.username || shopName !== (me.shopName ?? '') || bio !== (me.bio ?? '') || city !== me.city;
  const valid = name.trim().length >= 2 && !usernameError && city.trim().length >= 2;
  const update = useStore.getState().updateProfile;

  return (
    <>
      <div style={{ position: 'relative', marginBottom: 40 }}>
        <div style={{ height: 150, borderRadius: 12, background: me.coverUri ? `center/cover url(${me.coverUri})` : 'var(--gradient)', opacity: me.coverUri ? 1 : 0.55 }} />
        <button className="btn line sm" style={{ position: 'absolute', top: 10, right: 10, background: 'var(--panel)' }} onClick={async () => { const [u] = await pickImages(); if (u) update({ coverUri: u }); }}>
          <Camera size={15} /> Cover
        </button>
        <div style={{ position: 'absolute', left: 24, bottom: -40, border: '4px solid var(--panel)', borderRadius: '50%', cursor: 'pointer' }} onClick={async () => { const [u] = await pickImages(); if (u) update({ avatarUri: u }); }} title="Change photo">
          <Avatar user={me} size={96} />
          <span style={{ position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-strong)', color: '#fff', display: 'grid', placeItems: 'center' }}><Camera size={15} /></span>
        </div>
      </div>
      {(me.avatarUri || me.coverUri) && (
        <div style={{ display: 'flex', gap: 6 }}>
          {me.avatarUri && <button className="btn ghost sm" onClick={() => update({ avatarUri: undefined })}>Remove photo</button>}
          {me.coverUri && <button className="btn ghost sm" onClick={() => update({ coverUri: undefined })}>Remove cover</button>}
        </div>
      )}
      <div>
        <label className="flabel">Your name</label>
        <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="flabel">Username</label>
        <input className="field" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ''))} />
        {usernameError ? <div className="error" style={{ marginTop: 6 }}>{usernameError}</div> : <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>People find you by searching @{username}</div>}
      </div>
      <div>
        <label className="flabel">Shop name (optional)</label>
        <input className="field" value={shopName} maxLength={40} placeholder={name} onChange={(e) => setShopName(e.target.value)} />
      </div>
      <div>
        <label className="flabel">About</label>
        <textarea className="field" value={bio} maxLength={300} placeholder="What you sell, opening hours, where you’re based" onChange={(e) => setBio(e.target.value)} />
      </div>
      <div>
        <label className="flabel">City or area</label>
        <LocationInput variant="field" value={city} onChange={setCity} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn primary"
          disabled={!dirty || !valid}
          onClick={() => {
            update({ displayName: name.trim(), username, shopName: shopName.trim() || undefined, bio: bio.trim() || undefined, city: tidyPlace(city) });
            showToast('Profile saved');
          }}>
          Save
        </button>
        {dirty && <button className="btn line" onClick={() => { setName(me.displayName); setUsername(me.username); setShopName(me.shopName ?? ''); setBio(me.bio ?? ''); setCity(me.city); }}>Discard</button>}
      </div>
      <div>
        <div className="flabel">Verification</div>
        {me.verifications.length ? (
          <VerificationMeanings labels={me.verifications} />
        ) : (
          <div className="muted" style={{ fontSize: 13.5 }}>{BACKEND_READY ? 'Confirm your email to get your first label.' : 'Verification labels become available when your account is on the Neva server.'}</div>
        )}
      </div>
    </>
  );
}

type DocKey = 'terms' | 'privacy' | 'support';
const DOCS: Record<DocKey, { title: string; body: string }> = {
  terms: { title: 'Terms of service', body: 'Neva’s full Terms of Service will be published here before launch. Until then: list only items you own, describe them honestly, and don’t sell anything on the prohibited list in Help & safety.' },
  privacy: { title: 'Privacy policy', body: 'Neva’s privacy policy (aligned with Nigeria’s Data Protection Act) will be published here before launch. While the server isn’t connected, your profile, chats and listings stay in this browser only.' },
  support: { title: 'Contact support', body: 'Email support@neva.app and include your @username and, for a report, its case number. We reply by email.' },
};

function AccountSettings() {
  const auth = useStore((s) => s.auth);
  const { go } = useNav();
  const [doc, setDoc] = useState<DocKey | null>(null);
  return (
    <>
      <div>
        <div className="flabel">Signed in with</div>
        <div>{auth.provider === 'google' ? 'Google' : 'Email'}{auth.email ? ` · ${auth.email}` : ''}</div>
      </div>
      <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        {BACKEND_READY ? 'Your account is stored on the Neva server.' : 'The server isn’t connected yet, so your account and chats are stored in this browser only.'}
      </div>
      <div style={{ margin: '0 -20px' }}>
        <LinkRow icon={<FileText size={20} />} label="Terms of service" onClick={() => setDoc('terms')} />
        <LinkRow icon={<Fingerprint size={20} />} label="Privacy policy" onClick={() => setDoc('privacy')} />
        <LinkRow icon={<Users size={20} />} label="Community rules & prohibited items" onClick={() => go('/settings/help')} />
        <LinkRow icon={<LifeBuoy size={20} />} label="Contact support" onClick={() => setDoc('support')} />
      </div>
      <div style={{ margin: '0 -20px', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <LinkRow
          icon={<Download size={20} />}
          label="Request my data"
          sub="Get a copy of your profile, listings and chats"
          onClick={() => showToast(BACKEND_READY ? 'Request received. We’ll email your data export to you.' : 'Data exports are emailed to you once the Neva server is connected. Right now everything is stored in this browser.')}
        />
        <LinkRow
          icon={<Trash2 size={20} />}
          label="Clear data on this browser"
          sub="Removes everything stored here and signs you out"
          onClick={() => confirm('Delete all Neva data stored in this browser? This removes your chats, listings and profile here and can’t be undone.') && useStore.getState().clearDeviceData()}
        />
        <LinkRow icon={<LogOut size={20} />} label="Log out" onClick={() => confirm('Log out of Neva on this browser?') && signOutEverywhere()} />
        <LinkRow
          danger
          icon={<Trash2 size={20} />}
          label="Delete account"
          onClick={async () => {
            const msg = BACKEND_READY
              ? 'Delete your Neva account? Your profile and listings will be removed. Server-side deletion isn’t available yet, so for now this clears your data in this browser and signs you out — contact support@neva.app to remove your server account.'
              : 'Delete your Neva account? Your account only exists in this browser right now, so this removes your profile, listings and chats here and signs you out. It can’t be undone.';
            if (!confirm(msg)) return;
            await signOutEverywhere();
            useStore.getState().clearDeviceData();
          }}
        />
      </div>
      {doc && (
        <Modal
          title={DOCS[doc].title}
          onClose={() => setDoc(null)}
          footer={
            <>
              {doc === 'support' && <a className="btn line" href="mailto:support@neva.app">Email support</a>}
              <button className="btn primary" onClick={() => setDoc(null)}>Done</button>
            </>
          }>
          <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.55 }}>{DOCS[doc].body}</div>
        </Modal>
      )}
    </>
  );
}

function LinkRow({ icon, label, sub, danger, onClick }: { icon: ReactNode; label: string; sub?: string; danger?: boolean; onClick: () => void }) {
  return (
    <div className={`lrow${danger ? ' danger' : ''}`} style={{ minHeight: sub ? 60 : 50 }} onClick={onClick}>
      <div className="ic">{icon}</div>
      <div className="grow">
        <div style={{ fontSize: 15 }}>{label}</div>
        {sub && <div className="st">{sub}</div>}
      </div>
      {!danger && <ChevronRight size={17} className="faint" />}
    </div>
  );
}

function PrivacySettings() {
  const settings = useStore((s) => s.settings);
  const blocked = useStore((s) => s.blocked);
  const users = useStore((s) => s.users);
  const set = useStore.getState().updateSettings;
  return (
    <>
      <Toggle label="Show last seen & online" sub="If you turn this off, you won’t see other people’s either." checked={settings.showLastSeen} onChange={(v) => set({ showLastSeen: v })} />
      <Toggle label="Read receipts" sub="Show blue ticks when you’ve read a message." checked={settings.readReceipts} onChange={(v) => set({ readReceipts: v })} />
      <Toggle label="Findable by @username" sub="Let people find your profile when they search your username or name." checked={settings.discoverable} onChange={(v) => set({ discoverable: v })} />
      <Toggle label="Personalised Explore" sub="Use what you browse and save to order listings." checked={settings.personalization} onChange={(v) => set({ personalization: v })} />
      <div>
        <label className="flabel">Who can see my status</label>
        <select className="box" value={settings.statusPrivacy} onChange={(e) => set({ statusPrivacy: e.target.value as typeof settings.statusPrivacy })}>
          <option value="everyone">Everyone</option>
          <option value="followers">My followers</option>
          <option value="nobody">Nobody</option>
        </select>
      </div>
      <div>
        <div className="flabel">Blocked ({blocked.length})</div>
        {blocked.length === 0 && <div className="muted" style={{ fontSize: 13.5 }}>You haven’t blocked anyone.</div>}
        {blocked.map((uid) => (
          <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <Avatar user={users[uid]} size={36} />
            <div className="grow">{users[uid]?.displayName ?? 'Unknown'}</div>
            <button className="btn ghost sm" onClick={() => useStore.getState().toggleBlock(uid)}>Unblock</button>
          </div>
        ))}
      </div>
    </>
  );
}

function NotificationSettings() {
  const notif = useStore((s) => s.settings.notif);
  const preview = useStore((s) => s.settings.lockScreenPreview);
  const set = (p: Partial<typeof notif>) => useStore.getState().updateSettings({ notif: { ...notif, ...p } });
  return (
    <>
      <Toggle label="Messages" checked={notif.messages} onChange={(v) => set({ messages: v })} />
      <Toggle label="Show message preview" sub="Include the message text in notifications. Turn off to show only who it’s from." checked={preview} onChange={(v) => useStore.getState().updateSettings({ lockScreenPreview: v })} />
      <Toggle label="Offers" sub="When someone makes or answers an offer." checked={notif.offers} onChange={(v) => set({ offers: v })} />
      <Toggle label="New followers" checked={notif.follows} onChange={(v) => set({ follows: v })} />
      <Toggle label="New listings from people I follow" checked={notif.newListings} onChange={(v) => set({ newListings: v })} />
      <Toggle label="Price drops on saved items" checked={notif.priceDrops} onChange={(v) => set({ priceDrops: v })} />
      <Toggle label="Weekly digest email" checked={notif.digest} onChange={(v) => set({ digest: v })} />
    </>
  );
}

function AppearanceSettings() {
  const theme = useStore((s) => s.settings.theme);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="flabel">Theme</div>
      {(['system', 'light', 'dark'] as const).map((t) => (
        <label key={t} className="check">
          <input type="radio" name="theme" checked={theme === t} onChange={() => useStore.getState().updateSettings({ theme: t })} />
          {t === 'system' ? 'System default' : t[0]!.toUpperCase() + t.slice(1)}
        </label>
      ))}
    </div>
  );
}

function HelpSettings() {
  const reports = useStore((s) => s.reports);
  return (
    <>
      <SafetyCentre />
      <div>
        <div className="flabel">Your reports</div>
        {reports.length === 0 ? (
          <Empty icon={<CircleHelp size={24} />} title="No reports" body="Reports you send appear here with a case number." />
        ) : (
          reports.map((r) => (
            <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex' }}>
                <b className="grow">{r.caseId}</b>
                <span className="faint" style={{ fontSize: 12.5 }}>{timeAgo(r.createdAt)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13.5 }}>{r.reason} · {r.targetType} · {r.status.replace('_', ' ')}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
