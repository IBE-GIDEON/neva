'use client';

import { CONDITIONS, type VerificationLabel, VERIFICATIONS } from '@neva/core';
import { BadgeCheck, Briefcase, CircleX, CreditCard, Flag, KeyRound, MapPin, MessageSquare, ScanSearch, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Cond } from '../components/ui';

const TIPS: [ReactNode, string, string][] = [
  [<MessageSquare key="i" size={18} />, 'Keep chats on Neva', 'There’s a record if something goes wrong, and you can report straight from the chat.'],
  [<MapPin key="i" size={18} />, 'Meet in public', 'Malls, banks or busy cafés. Bring a friend for high-value items.'],
  [<ScanSearch key="i" size={18} />, 'Inspect before paying', 'Test the device, check battery health, IMEI / serial numbers, and that phones aren’t iCloud or Google locked.'],
  [<CreditCard key="i" size={18} />, 'Know what’s protected', 'Neva doesn’t hold payments yet. Transfers made outside Neva aren’t protected — never pay a deposit to someone you haven’t met.'],
  [<KeyRound key="i" size={18} />, 'Never share codes', 'No genuine buyer, seller or Neva staff will ask for your OTP, PIN or password.'],
  [<Flag key="i" size={18} />, 'Report anything off', 'Scams, stolen goods, fakes or harassment — report from any chat, listing or profile menu.'],
];

const PROHIBITED = ['Stolen or blacklisted devices', 'Counterfeit or “replica / first copy” items', 'iCloud/Google-locked devices sold as unlocked', 'Signal jammers and unlawful devices', 'Devices with tampered IMEI/serial numbers'];

const VERIFICATION_ICONS: Record<VerificationLabel, ReactNode> = {
  contact_confirmed: <BadgeCheck size={18} />,
  business_submitted: <Briefcase size={18} />,
  identity_checked: <ShieldCheck size={18} />,
};

const card = { border: '1px solid var(--border)', borderRadius: 12, padding: 16 } as const;
const roundIcon = { width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text)', flexShrink: 0 } as const;

/** What each seller label means — and what it doesn't. */
export function VerificationMeanings({ labels }: { labels: VerificationLabel[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {labels.map((v) => (
        <div key={v} style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...roundIcon, color: 'var(--accent)' }}>{VERIFICATION_ICONS[v]}</div>
          <div className="grow">
            <div style={{ fontWeight: 500 }}>{VERIFICATIONS[v].label}</div>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{VERIFICATIONS[v].meaning}</div>
            <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 2 }}>{VERIFICATIONS[v].notImplied}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Safety centre (mobile settings/safety): tips, seller labels, condition guide, prohibited items. */
export function SafetyCentre() {
  return (
    <>
      <div>
        <div className="flabel" style={{ marginBottom: 12 }}>Staying safe</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TIPS.map(([icon, title, body]) => (
            <div key={title} style={{ display: 'flex', gap: 14 }}>
              <div style={roundIcon}>{icon}</div>
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{title}</div>
                <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flabel" style={{ marginBottom: 10 }}>What seller labels mean</div>
        <div style={card}>
          <VerificationMeanings labels={['contact_confirmed', 'business_submitted', 'identity_checked']} />
        </div>
      </div>

      <div>
        <div className="flabel" style={{ marginBottom: 10 }}>Condition guide</div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CONDITIONS.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <Cond c={c.id} />
              <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{c.definition}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flabel" style={{ marginBottom: 10 }}>Not allowed on Neva</div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROHIBITED.map((p) => (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <CircleX size={17} color="var(--danger)" style={{ flexShrink: 0 }} />
              <div>{p}</div>
            </div>
          ))}
          <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}>Listings that mention these are blocked from publishing and may be removed after review.</div>
        </div>
      </div>
    </>
  );
}
