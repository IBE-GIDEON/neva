import { ScrollView, Switch, View } from 'react-native';

import { Card, Divider, Header, Row, T } from '@/components/ui';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

const ROWS = [
  ['messages', 'Messages', 'New chats and replies'],
  ['offers', 'Offers', 'Offers, counters and accepted deals'],
  ['follows', 'Follows', 'When someone follows you'],
  ['newListings', 'New drops', 'New listings from sellers you follow'],
  ['priceDrops', 'Price drops', 'On items you’ve saved'],
  ['digest', 'Weekly digest', 'A weekly roundup (off by default)'],
] as const;

export default function NotificationSettings() {
  const t = useTheme();
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          {ROWS.map(([k, label, sub], i) => (
            <View key={k}>
              <Row label={label} sub={sub} right={<Switch value={s.notif[k]} onValueChange={(v) => update({ notif: { ...s.notif, [k]: v } })} trackColor={{ true: t.primary, false: t.surface3 }} thumbColor="#fff" />} />
              {i < ROWS.length - 1 && <Divider inset={16} />}
            </View>
          ))}
        </Card>
        <Card>
          <Row label="Show message preview on lock screen" sub="Off by default to keep chats private" right={<Switch value={s.lockScreenPreview} onValueChange={(v) => update({ lockScreenPreview: v })} trackColor={{ true: t.primary, false: t.surface3 }} thumbColor="#fff" />} />
        </Card>
        <T faint size={12} style={{ lineHeight: 18 }}>Security alerts (new sign-ins, account changes) are always on.</T>
      </ScrollView>
    </View>
  );
}
