import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Avatar, EmptyState, haptic, Header, Icon, IconButton, T } from '@/components/ui';
import type { NotificationItem } from '@neva/core';
import { timeAgo } from '@neva/core';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

const ICONS: Record<NotificationItem['type'], string> = {
  message: 'chatbubble',
  follow: 'person-add',
  new_listing: 'pricetag',
  price_drop: 'trending-down',
  moderation: 'shield',
  security: 'lock-closed',
  offer: 'cash',
  system: 'information-circle',
};

export default function Notifications() {
  const t = useTheme();
  const items = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationsRead);
  const clear = useStore((s) => s.clearNotifications);

  useEffect(() => () => markRead(), [markRead]);

  const confirmClear = () =>
    Alert.alert('Clear all notifications?', 'This removes them from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => { haptic.medium(); clear(); } },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title="Notifications"
        right={
          <>
            {items.length > 0 && (
              <Pressable onPress={confirmClear} hitSlop={8} style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: t.primary, fontSize: 15, fontWeight: '500' }}>Clear all</Text>
              </Pressable>
            )}
            <IconButton name="settings-outline" onPress={() => router.push('/settings/notifications')} />
          </>
        }
      />
      <FlatList
        data={[...items].sort((a, b) => b.createdAt - a.createdAt)}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow n={item} />}
        ListHeaderComponent={items.length ? <T faint size={12} style={{ paddingHorizontal: 16, paddingBottom: 6 }}>Swipe left to delete</T> : null}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="All caught up" body="Follows, offers and new drops show up here." />}
      />
    </View>
  );
}

function NotificationRow({ n }: { n: NotificationItem }) {
  const t = useTheme();
  const actor = useStore((s) => (n.actorId ? s.users[n.actorId] : undefined));
  const remove = useStore((s) => s.deleteNotification);
  const icon = ICONS[n.type] as any;

  const del = () => {
    haptic.medium();
    remove(n.id);
  };

  const open = () => {
    if (n.conversationId) router.push(`/chat/${n.conversationId}`);
    else if (n.listingId) router.push(`/listing/${n.listingId}`);
    else if (n.actorId) router.push(`/seller/${n.actorId}`);
    else if (n.type === 'security') router.push('/settings/privacy');
  };

  return (
    <Animated.View exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)}>
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={90}
        overshootRight={false}
        onSwipeableOpen={(direction) => direction === 'left' && del()}
        renderRightActions={() => (
          <Pressable onPress={del} style={{ width: 96, backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Icon name="trash-outline" size={21} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Delete</Text>
          </Pressable>
        )}>
        <Pressable onPress={open} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: pressed ? t.surface2 : t.bg })}>
          <View>
            {actor ? (
              <Avatar user={actor} size={46} />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={21} color={t.text} />
              </View>
            )}
            {actor && (
              <View style={{ position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.bg }}>
                <Icon name={icon} size={11} color="#fff" />
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T weight={n.read ? '400' : '600'} size={14.5}>{n.title}</T>
            {!!n.body && <T dim size={13.5} numberOfLines={2}>{n.body}</T>}
            <T faint size={12}>{timeAgo(n.createdAt)}</T>
          </View>
          {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary, marginTop: 6 }} />}
        </Pressable>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}
