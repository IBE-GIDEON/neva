import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, Header, Icon, T, VerificationList } from '@/components/ui';
import { CONDITIONS, timeAgo } from '@neva/core';
import { useLive, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const TIPS = [
  ['location', 'Meet in public', 'Malls, banks or busy cafés. Bring a friend for high-value items.'],
  ['search', 'Inspect before paying', 'Test the device, check battery health, serial/IMEI and accessories.'],
  ['card', 'Know what’s protected', 'Neva doesn’t hold payments yet. Transfers made outside Neva aren’t protected.'],
  ['key', 'Never share codes', 'No genuine buyer, seller or Neva staff will ask for your OTP, PIN or password.'],
  ['flag', 'Report anything off', 'Scams, stolen goods, fakes or harassment — report from any chat, listing or profile.'],
] as const;

const PROHIBITED = ['Stolen or blacklisted devices', 'Counterfeit or “replica / first copy” items', 'iCloud/Google-locked devices sold as unlocked', 'Signal jammers and unlawful devices', 'Devices with tampered IMEI/serial numbers'];

export default function Safety() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Safety center" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 60 }}>
        <LiveStatus />
        {TIPS.map(([icon, title, body]) => (
          <View key={title} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={`${icon}-outline` as any} size={19} color={t.text} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="600">{title}</T>
              <T dim style={{ lineHeight: 20 }}>{body}</T>
            </View>
          </View>
        ))}

        <T size={18} weight="600" style={{ marginTop: 8 }}>What seller labels mean</T>
        <Card style={{ padding: 14 }}>
          <VerificationList labels={['contact_confirmed', 'business_submitted', 'identity_checked']} />
        </Card>

        <T size={18} weight="600">Condition guide</T>
        <Card style={{ padding: 14, gap: 12 }}>
          {CONDITIONS.map((c) => (
            <View key={c.id} style={{ gap: 2 }}>
              <T weight="600">{c.label}</T>
              <T dim size={13} style={{ lineHeight: 18 }}>{c.definition}</T>
            </View>
          ))}
        </Card>

        <T size={18} weight="600">Not allowed on Neva</T>
        <View style={{ backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: radius.lg, padding: 14, gap: 8 }}>
          {PROHIBITED.map((p) => (
            <View key={p} style={{ flexDirection: 'row', gap: 8 }}>
              <Icon name="close-circle-outline" size={17} color={t.danger} />
              <T style={{ flex: 1 }}>{p}</T>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function LiveStatus() {
  const t = useTheme();
  const sync = useLive((s) => s.sync);
  const me = useStore((s) => s.users[s.meId]);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const label = { off: 'Not connected', connecting: 'Connecting…', live: 'Connected', reconnecting: 'Reconnecting…', error: 'Connection problem' }[sync.status];
  const dot = sync.status === 'live' ? '#22c55e' : sync.status === 'error' ? t.danger : t.textFaint;
  return (
    <Card style={{ padding: 14, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <T weight="600">Live updates: {label}</T>
      </View>
      <T faint size={13}>Signed in as @{me?.username ?? '—'}</T>
      <T faint size={13}>Last live update: {sync.lastEventAt ? `${timeAgo(sync.lastEventAt)} (${sync.lastEvent})` : 'none yet'}</T>
      {!!sync.lastError && <T size={13} color={t.danger}>Last error: {sync.lastError}</T>}
    </Card>
  );
}
