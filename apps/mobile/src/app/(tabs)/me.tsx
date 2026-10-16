import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Divider, IconButton, Row, T, Tap } from '@/components/ui';
import { compactNumber } from '@neva/core';
import { isStoryLive, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

export default function Me() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.users[s.meId]);
  const meId = useStore((s) => s.meId);
  const follows = useStore((s) => s.follows.length);
  const saved = useStore((s) => s.saved.length);
  const listings = useStore((s) => Object.values(s.listings).filter((l) => l.sellerId === s.meId && l.status === 'active').length);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const blocked = useStore((s) => s.blocked.length);
  const reports = useStore((s) => s.reports.length);
  const hasStory = useStore((s) => s.stories.some((st) => st.userId === s.meId && isStoryLive(st)));

  if (!me) return null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56 + insets.top }}>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', flex: 1, letterSpacing: -0.7 }}>Profile</Text>
        <IconButton name="storefront-outline" onPress={() => router.push(`/seller/${meId}`)} />
        <IconButton name="settings-outline" onPress={() => router.push('/settings')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, gap: 16 }}>
        <Tap onPress={() => router.push('/edit-profile')} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: t.surface, borderRadius: radius.xl, borderWidth: 0.5, borderColor: t.border }}>
          <Avatar user={me} size={72} ring={hasStory} ringSeen onPress={hasStory ? () => router.push(`/story/${meId}`) : undefined} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={20} weight="600">{me.displayName}</T>
            <T dim>@{me.username} · {me.city}</T>
            <T size={13} color={t.primary} weight="600" style={{ marginTop: 4 }}>Edit profile</T>
          </View>
        </Tap>

        <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: radius.lg, paddingVertical: 14, borderWidth: 0.5, borderColor: t.border }}>
          <Stat value={String(listings)} label="Listings" onPress={() => router.navigate('/(tabs)/sell')} />
          <Stat value={compactNumber(me.followers)} label="Followers" />
          <Stat value={String(follows)} label="Following" />
          <Stat value={String(saved)} label="Saved" onPress={() => router.push('/saved')} />
        </View>

        <Card>
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} right={<Badge count={unread} />} />
          <Divider inset={64} />
          <Row icon="bookmark-outline" label="Saved items" value={String(saved)} onPress={() => router.push('/saved')} />
          <Divider inset={64} />
          <Row icon="star-outline" label="Starred messages" onPress={() => router.push('/starred')} />
          <Divider inset={64} />
          <Row icon="storefront-outline" label="My public shop" onPress={() => router.push(`/seller/${meId}`)} />
        </Card>

        <Card>
          <Row icon="shield-checkmark-outline" label="Safety center" sub="Tips, reporting and how Neva verifies sellers" onPress={() => router.push('/settings/safety')} />
          <Divider inset={64} />
          <Row icon="flag-outline" label="My reports" value={reports ? String(reports) : undefined} onPress={() => router.push('/reports')} />
          <Divider inset={64} />
          <Row icon="ban-outline" label="Blocked accounts" value={blocked ? String(blocked) : undefined} onPress={() => router.push('/settings/blocked')} />
        </Card>

        <Card>
          <Row icon="lock-closed-outline" label="Privacy" onPress={() => router.push('/settings/privacy')} />
          <Divider inset={64} />
          <Row icon="notifications-circle-outline" label="Notification settings" onPress={() => router.push('/settings/notifications')} />
          <Divider inset={64} />
          <Row icon="color-palette-outline" label="Appearance" onPress={() => router.push('/settings')} />
        </Card>
        <T faint size={12} center>Neva v1.0 · Made in Nigeria 🇳🇬</T>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  return (
    <Tap onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <T size={18} weight="600">{value}</T>
      <T dim size={12}>{label}</T>
    </Tap>
  );
}
