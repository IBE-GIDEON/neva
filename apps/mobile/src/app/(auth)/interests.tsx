import { router } from 'expo-router';
import { useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Divider, Icon, type IconName, T, Tap, VerifiedTick } from '@/components/ui';
import { CATEGORIES } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const TILE = (Dimensions.get('window').width - 32 - 20) / 3;

export default function Interests() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<string[]>([]);
  const users = useStore((s) => s.users);
  const follows = useStore((s) => s.follows);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const completeInterests = useStore((s) => s.completeInterests);
  const sellers = Object.values(users).filter((u) => u.isSeller && u.id !== 'me').slice(0, 8);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const finish = () => {
    completeInterests(picked);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(sellers.length ? [0, 1] : [0]).map((i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? t.text : t.surface3 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={26} weight="700">{step === 0 ? 'What are you into?' : 'Follow a few sellers'}</T>
          <Tap onPress={finish} hitSlop={10}>
            <T dim size={15}>Skip</T>
          </Tap>
        </View>
        <T dim style={{ lineHeight: 21, marginTop: -6 }}>{step === 0 ? 'Pick categories to shape your feed. You can change this later.' : 'You’ll see their new listings and status updates first.'}</T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 30 }}>
        {step === 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CATEGORIES.map((c) => {
              const on = picked.includes(c.id);
              return (
                <Tap key={c.id} haptics onPress={() => toggle(c.id)} style={{ width: TILE, height: 96, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? t.primary : t.border, backgroundColor: on ? (t.mode === 'dark' ? 'rgba(124,124,255,0.10)' : 'rgba(91,75,245,0.06)') : t.surface, padding: 12, justifyContent: 'space-between' }}>
                  <Icon name={c.icon as IconName} size={22} color={on ? t.primary : t.text} />
                  <T size={13.5} weight="500">{c.name}</T>
                  {on && (
                    <View style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Icon name="checkmark-circle" size={18} color={t.primary} />
                    </View>
                  )}
                </Tap>
              );
            })}
          </View>
        ) : (
          <View>
            {sellers.map((u, i) => {
              const on = follows.includes(u.id);
              return (
                <View key={u.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 }}>
                    <Avatar user={u} size={48} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <T weight="600">{u.displayName}</T>
                        <VerifiedTick user={u} />
                      </View>
                      <T dim size={13} numberOfLines={1}>{u.city} · {u.shopType === 'retail' ? 'Shop' : 'Individual'}</T>
                    </View>
                    <Button small title={on ? 'Following' : 'Follow'} variant={on ? 'secondary' : 'inverse'} onPress={() => toggleFollow(u.id)} />
                  </View>
                  {i < sellers.length - 1 && <Divider inset={64} />}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: insets.bottom + 14, borderTopWidth: 0.5, borderTopColor: t.border }}>
        {step === 0 ? (
          <Button title={picked.length ? `Continue · ${picked.length} selected` : 'Continue'} variant="inverse" onPress={() => (sellers.length ? setStep(1) : finish())} />
        ) : (
          <Button title="Start exploring" variant="gradient" onPress={finish} />
        )}
      </View>
    </View>
  );
}
