import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useRef } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import type { Listing } from '@neva/core';
import { formatNaira, timeAgo } from '@neva/core';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';
import { Avatar, ConditionBadge, haptic, Icon, IconButton, T, Tap, VerifiedTick } from './ui';

/** Feed post: clean full-bleed image, details below (Instagram/Threads rhythm). Double-tap to save. */
export const FeedPost = memo(function FeedPost({ listing, width }: { listing: Listing; width: number }) {
  const t = useTheme();
  const seller = useStore((s) => s.users[listing.sellerId]);
  const saved = useStore((s) => s.saved.includes(listing.id));
  const following = useStore((s) => s.follows.includes(listing.sellerId));
  const toggleSave = useStore((s) => s.toggleSave);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const startConversation = useStore((s) => s.startConversation);
  const pop = useSharedValue(0);
  const lastTap = useRef(0);
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value }));

  const onImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (!saved) toggleSave(listing.id);
      haptic.success();
      pop.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 450 }));
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) router.push(`/listing/${listing.id}`);
      }, 290);
    }
  };

  const h = width * 1.1;
  const mine = listing.sellerId === 'me';
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
        <Avatar user={seller} size={34} onPress={() => router.push(`/seller/${listing.sellerId}`)} />
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/seller/${listing.sellerId}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T weight="600" size={14}>{seller?.displayName}</T>
            <VerifiedTick user={seller} size={13} />
            <T faint size={13}>  {timeAgo(listing.publishedAt ?? listing.createdAt).replace(' ago', '')}</T>
          </View>
          <T dim size={12}>
            {listing.promoted ? 'Sponsored · ' : ''}
            {listing.city}
            {listing.area ? `, ${listing.area}` : ''}
          </T>
        </Pressable>
        {!following && !mine && (
          <Pressable onPress={() => { toggleFollow(listing.sellerId); showToast(`Following ${seller?.displayName}`, 'person-add-outline'); }} hitSlop={8}>
            <Text style={{ color: t.primary, fontWeight: '600', fontSize: 14 }}>Follow</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={onImagePress}>
        <Image source={{ uri: listing.images[0] }} style={{ width, height: h, backgroundColor: t.surface2 }} contentFit="cover" transition={200} recyclingKey={listing.id} cachePolicy="memory-disk" />
        {listing.images.length > 1 && (
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '500' }}>1/{listing.images.length}</Text>
          </View>
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, popStyle]}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bookmark" size={44} color="#fff" />
          </View>
        </Animated.View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4 }}>
        {!mine && (
          <IconButton
            name="chatbubble-outline"
            onPress={() => {
              const cid = startConversation(listing.sellerId, listing.id);
              router.push({ pathname: '/chat/[id]', params: { id: cid, prefill: 'Hi, is this still available?' } });
            }}
          />
        )}
        <IconButton name="paper-plane-outline" onPress={() => Share.share({ message: `${listing.title} — ${formatNaira(listing.priceMinor)} on Neva\nneva://listing/${listing.id}` })} />
        <View style={{ flex: 1 }} />
        <IconButton name={saved ? 'bookmark' : 'bookmark-outline'} color={saved ? t.primary : undefined} onPress={() => { toggleSave(listing.id); haptic.light(); }} />
      </View>

      <Pressable onPress={() => router.push(`/listing/${listing.id}`)} style={{ paddingHorizontal: 14, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T size={18} weight="700">{formatNaira(listing.priceMinor)}</T>
          {listing.negotiable && <T dim size={12.5}>Negotiable</T>}
          <View style={{ flex: 1 }} />
          <ConditionBadge condition={listing.condition} small />
        </View>
        <T size={14.5} numberOfLines={2} style={{ lineHeight: 20 }}>{listing.title}</T>
      </Pressable>
    </View>
  );
});

/** Compact grid tile */
export const ListingTile = memo(function ListingTile({ listing, width, showStatus }: { listing: Listing; width: number; showStatus?: boolean }) {
  const t = useTheme();
  const saved = useStore((s) => s.saved.includes(listing.id));
  const toggleSave = useStore((s) => s.toggleSave);
  const statusLabel = (showStatus || listing.status !== 'active') && listing.status !== 'active' ? listing.status : listing.promoted ? 'Sponsored' : null;
  return (
    <Tap onPress={() => router.push(`/listing/${listing.id}`)} scaleTo={0.98} style={{ width }}>
      <View style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: t.surface2 }}>
        <Image source={{ uri: listing.images[0] }} style={{ width, height: width * 1.15 }} contentFit="cover" transition={150} recyclingKey={listing.id} cachePolicy="memory-disk" />
        <Pressable onPress={() => { toggleSave(listing.id); haptic.light(); }} hitSlop={8} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={15} color="#fff" />
        </Pressable>
        {statusLabel && (
          <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 10.5, textTransform: 'capitalize' }}>{statusLabel}</Text>
          </View>
        )}
      </View>
      <View style={{ paddingTop: 8, paddingHorizontal: 2, gap: 2 }}>
        <T weight="600" size={15}>{formatNaira(listing.priceMinor)}</T>
        <T numberOfLines={1} size={13.5} dim>{listing.title}</T>
        <T faint size={12} numberOfLines={1}>{listing.city} · {listing.condition.startsWith('new') ? 'New' : listing.condition === 'refurbished' ? 'Refurbished' : 'Used'}</T>
      </View>
    </Tap>
  );
});
