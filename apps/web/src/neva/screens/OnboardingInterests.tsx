'use client';

import { CATEGORIES } from '@neva/core';
import { BatteryCharging, Camera, CircleCheck, Gamepad2, Headphones, House, Laptop, LayoutGrid, Smartphone, Watch, Zap } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Verified } from '../components/ui';
import { useStore } from '../store';
import { Frame } from './Auth';

const ICONS: Record<string, ReactNode> = {
  phones: <Smartphone size={22} />,
  computers: <Laptop size={22} />,
  audio: <Headphones size={22} />,
  wearables: <Watch size={22} />,
  gaming: <Gamepad2 size={22} />,
  power: <BatteryCharging size={22} />,
  smarthome: <House size={22} />,
  cameras: <Camera size={22} />,
  accessories: <Zap size={22} />,
  other: <LayoutGrid size={22} />,
};

/** Onboarding after profile setup: pick interests, then follow a few sellers. Same steps as the mobile app. */
export function OnboardingInterestsPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<string[]>([]);
  const sellerIds = useStore(useShallow((s) => Object.values(s.users).filter((u) => u.isSeller && u.id !== s.meId).slice(0, 8).map((u) => u.id)));
  const users = useStore((s) => s.users);
  const follows = useStore((s) => s.follows);
  const steps = sellerIds.length ? [0, 1] : [0];

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const finish = () => useStore.getState().completeInterests(picked);

  return (
    <Frame>
      <div className="auth-card onb">
        <div>
          <div className="onb-steps">
            {steps.map((i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
          <h1>{step === 0 ? 'What are you into?' : 'Follow a few sellers'}</h1>
          <ol>
            {step === 0 ? (
              <>
                <li>Pick categories to shape your Explore feed</li>
                <li>Choose as many as you like</li>
                <li>You can change this later in Settings</li>
              </>
            ) : (
              <>
                <li>You’ll see their new listings first</li>
                <li>Their status updates show at the top of Updates</li>
                <li>Unfollow any time from their shop</li>
              </>
            )}
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {step === 0 ? (
            <div className="onb-grid">
              {CATEGORIES.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`onb-tile${on ? ' on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={on}>
                    {ICONS[c.id]}
                    <span>{c.name}</span>
                    {on && <CircleCheck size={16} className="ck" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="onb-sellers">
              {sellerIds.map((uid) => {
                const u = users[uid]!;
                const on = follows.includes(uid);
                return (
                  <div key={uid} className="lrow" style={{ cursor: 'default', padding: '8px 4px', gap: 12 }}>
                    <Avatar user={u} size={44} />
                    <div className="grow">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="ellipsis" style={{ fontWeight: 600 }}>{u.displayName}</span>
                        <Verified user={u} />
                      </div>
                      <div className="st ellipsis">
                        {u.city} · {u.shopType === 'retail' ? 'Shop' : 'Individual'}
                      </div>
                    </div>
                    <button type="button" className={`btn sm ${on ? 'line' : 'primary'}`} onClick={() => useStore.getState().toggleFollow(uid)}>
                      {on ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {step === 0 ? (
            <button className="btn primary" onClick={() => (sellerIds.length ? setStep(1) : finish())}>
              {picked.length ? `Continue · ${picked.length} selected` : 'Continue'}
            </button>
          ) : (
            <button className="btn grad" onClick={finish}>Start exploring</button>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {step === 1 ? (
              <button type="button" className="btn ghost sm" onClick={() => setStep(0)}>Back</button>
            ) : (
              <span />
            )}
            <button type="button" className="btn ghost sm" onClick={finish}>Skip</button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
