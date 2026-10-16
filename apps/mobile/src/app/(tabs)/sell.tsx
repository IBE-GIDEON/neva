import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';
import { Chip, ConditionBadge, EmptyState, Icon, IconButton, T, Tap } from '@/components/ui';
import type { Listing, ListingStatus } from '@neva/core';
import { compactNumber, formatNaira, timeAgo } from '@neva/core';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

type F = 'active' | 'paused' | 'sold';

export default function MyShop() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const meId = useStore((s) => s.meId);
  const all = useStore((s) => s.listings);
  const draft = useStore((s) => s.draft);
  const conversations = useStore((s) => s.conversations);
  const store = useStore.getState();
  const [f, setF] = useState<F>('active');
  const [target, setTarget] = useState<Listing | null>(null);

  const mine = useMemo(() => Object.values(all).filter((l) => l.sellerId === meId && l.status !== 'removed'), [all, meId]);
  const list = mine.filter((l) => l.status === f).sort((a, b) => b.createdAt - a.createdAt);
  const totals = mine.reduce((acc, l) => ({ views: acc.views + l.views, saves: acc.saves + l.saves, enquiries: acc.enquiries + l.enquiries }), { views: 0, saves: 0, enquiries: 0 });
  const sellingChats = Object.values(conversations).filter((c) => c.listingId && all[c.listingId]?.sellerId === meId);
  const unanswered = sellingChats.filter((c) => c.unread > 0).length;

  const setStatus = (l: Listing, s: ListingStatus, msg: string) => {
    store.setListingStatus(l.id, s);
    showToast(msg, 'checkmark-circle');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', height: 56 + insets.top }}>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', flex: 1, letterSpacing: -0.7 }}>My shop</Text>
        <IconButton name="storefront-outline" onPress={() => router.push(`/seller/${meId}`)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Tap onPress={() => router.push('/sell-new')} haptics scaleTo={0.98} style={{ marginHorizontal: 16, borderRadius: radius.xl, overflow: 'hidden' }}>
          <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={draft ? 'document-text' : 'add'} size={30} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '700' }}>{draft ? 'Continue your draft' : 'Sell something'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 2 }}>{draft ? `${draft.title || 'Untitled'} · tap to continue` : 'List in under 2 minutes. Free, no fees.'}</Text>
            </View>
            <Icon name="arrow-forward" size={22} color="#fff" />
          </LinearGradient>
        </Tap>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 }}>
          <Metric icon="eye-outline" value={compactNumber(totals.views)} label="Views" color={t.text} />
          <Metric icon="bookmark-outline" value={compactNumber(totals.saves)} label="Saves" color={t.text} />
          <Metric icon="chatbubbles-outline" value={compactNumber(totals.enquiries)} label="Enquiries" color={t.primary} />
        </View>
        <T faint size={11.5} style={{ paddingHorizontal: 16, marginTop: 6 }}>Views = listing opens by others. Enquiries = chats started from your listings.</T>

        {unanswered > 0 && (
          <Pressable onPress={() => router.navigate('/(tabs)/chats')} style={{ marginHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border }}>
            <Icon name="chatbubble-ellipses-outline" size={20} color={t.primary} />
            <T style={{ flex: 1 }} weight="600">{unanswered} buyer{unanswered > 1 ? 's' : ''} waiting for a reply</T>
            <Icon name="chevron-forward" size={18} color={t.textFaint} />
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 20, marginBottom: 6 }}>
          {(['active', 'paused', 'sold'] as F[]).map((k) => (
            <Chip key={k} label={`${k[0]!.toUpperCase() + k.slice(1)} · ${mine.filter((l) => l.status === k).length}`} active={f === k} onPress={() => setF(k)} />
          ))}
        </View>

        {list.length === 0 ? (
          <EmptyState icon="pricetags-outline" title={f === 'active' ? 'No active listings' : `Nothing ${f}`} body={f === 'active' ? 'Your first listing is a tap away. Clear photos and honest condition get more chats.' : undefined} />
        ) : (
          list.map((l, i) => (
            <Animated.View key={l.id} entering={FadeIn.duration(200)}>
              <Pressable onPress={() => router.push(`/listing/${l.id}`)} onLongPress={() => setTarget(l)} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
                <Image source={{ uri: l.images[0] }} style={{ width: 76, height: 76, borderRadius: 12, backgroundColor: t.surface2 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T numberOfLines={1} weight="600">{l.title}</T>
                  <T weight="600" color={t.primary}>{formatNaira(l.priceMinor)}</T>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <ConditionBadge condition={l.condition} small />
                    <T faint size={12}>👁 {l.views} · 🔖 {l.saves} · 💬 {l.enquiries}</T>
                  </View>
                  <T faint size={11.5}>Listed {timeAgo(l.createdAt)}</T>
                </View>
                <IconButton name="ellipsis-vertical" size={20} color={t.textDim} onPress={() => setTarget(l)} />
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Sheet
        visible={!!target}
        onClose={() => setTarget(null)}
        title={target?.title}
        actions={
          target
            ? [
                { label: 'Edit', icon: 'create-outline', onPress: () => { store.editListing(target.id); router.push('/sell-new'); } },
                ...(target.status === 'active'
                  ? [
                      { label: 'Mark as sold', icon: 'checkmark-done-outline' as const, onPress: () => setStatus(target, 'sold', 'Marked as sold') },
                      { label: 'Pause', icon: 'pause-outline' as const, onPress: () => setStatus(target, 'paused', 'Listing paused') },
                      { label: 'Post to my status', icon: 'aperture-outline' as const, onPress: () => { store.addStory({ imageUri: target.images[0], caption: target.title, listingId: target.id }); showToast('Posted to status', 'aperture'); } },
                    ]
                  : [{ label: 'Reactivate', icon: 'play-outline' as const, onPress: () => setStatus(target, 'active', 'Listing is live again') }]),
                { label: 'Delete', icon: 'trash-outline', danger: true, onPress: () => { const l = target; Alert.alert('Delete this listing?', 'It will be removed from Explore and your shop.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setStatus(l, 'removed', 'Listing deleted') }]); } },
              ]
            : []
        }
      />
    </View>
  );
}

function Metric({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: radius.lg, padding: 14, gap: 6, borderWidth: 0.5, borderColor: t.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <T size={22} weight="600">{value}</T>
      <T dim size={12}>{label}</T>
    </View>
  );
}
