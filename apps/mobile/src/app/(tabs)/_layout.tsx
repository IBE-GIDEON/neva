import { Redirect, router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, haptic, Icon, type IconName } from '@/components/ui';
import { isStoryLive, useStore } from '@/store';
import { useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  chats: { label: 'Chats', icon: 'chatbubble-outline', iconOn: 'chatbubble' },
  updates: { label: 'Updates', icon: 'radio-button-off-outline', iconOn: 'radio-button-on' },
  sell: { label: 'Sell', icon: 'add-circle-outline', iconOn: 'add-circle' },
  explore: { label: 'Explore', icon: 'search-outline', iconOn: 'search' },
  me: { label: 'Profile', icon: 'person-outline', iconOn: 'person' },
};

export default function TabsLayout() {
  const stage = useStore((s) => s.auth.stage);
  if (stage !== 'ready') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="updates" />
      <Tabs.Screen name="sell" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

function TabBar({ state, navigation }: any) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const unreadChats = useStore((s) => Object.values(s.conversations).filter((c) => c.unread > 0 && c.status !== 'archived' && !c.muted).length);
  const hasNewStories = useStore((s) => s.stories.some((st) => st.userId !== s.meId && isStoryLive(st) && !s.viewedStories.includes(st.id)));
  const unreadNotifs = useStore((s) => s.notifications.filter((n) => !n.read).length);

  return (
    <View style={{ backgroundColor: t.tabBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, flexDirection: 'row' }}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const cfg = TABS[route.name];
        if (!cfg) return null;
        const onPress = () => {
          haptic.select();
          if (route.name === 'sell' && focused) {
            router.push('/sell-new');
            return;
          }
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        const badge = route.name === 'chats' ? unreadChats : route.name === 'me' ? unreadNotifs : 0;
        const color = focused ? t.text : t.textDim;
        return (
          <Pressable key={route.key} onPress={onPress} onLongPress={route.name === 'sell' ? () => router.push('/sell-new') : undefined} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View>
              <Icon name={focused ? cfg.iconOn : cfg.icon} size={route.name === 'sell' ? 27 : 25} color={color} />
              {badge > 0 && <Badge count={badge} style={{ position: 'absolute', top: -5, left: 15 }} />}
              {route.name === 'updates' && hasNewStories && <View style={{ position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary, borderWidth: 1.5, borderColor: t.tabBar }} />}
            </View>
            <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '600' : '500' }}>{cfg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
