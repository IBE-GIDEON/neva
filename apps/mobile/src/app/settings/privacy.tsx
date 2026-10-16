import { ScrollView, Switch, View } from 'react-native';

import { Card, Chip, Divider, Header, Row, T } from '@/components/ui';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Privacy() {
  const t = useTheme();
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const sw = (value: boolean, onChange: (v: boolean) => void) => <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary, false: t.surface3 }} thumbColor="#fff" />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Privacy" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <Row label="Last seen & online" sub="If off, you won’t see others’ last seen either" right={sw(s.showLastSeen, (v) => update({ showLastSeen: v }))} />
          <Divider inset={16} />
          <Row label="Read receipts" sub="Blue ticks when you’ve read a message" right={sw(s.readReceipts, (v) => update({ readReceipts: v }))} />
          <Divider inset={16} />
          <Row label="Show me in search" sub="People can find you by @username or name" right={sw(s.discoverable ?? true, (v) => update({ discoverable: v }))} />
          <Divider inset={16} />
          <Row label="Personalised feed" sub="Use your interests and follows to rank Explore" right={sw(s.personalization, (v) => update({ personalization: v }))} />
        </Card>
        <View style={{ gap: 8 }}>
          <T dim size={13} weight="600" style={{ marginLeft: 4 }}>WHO CAN SEE MY STATUS</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['everyone', 'followers', 'nobody'] as const).map((p) => (
              <Chip key={p} label={p[0]!.toUpperCase() + p.slice(1)} active={s.statusPrivacy === p} onPress={() => update({ statusPrivacy: p })} />
            ))}
          </View>
        </View>
        <T faint size={12} style={{ lineHeight: 18 }}>Your email is never shown publicly. Neva doesn’t read your contacts or send messages on your behalf.</T>
      </ScrollView>
    </View>
  );
}
