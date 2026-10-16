import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingTile } from '@/components/ListingCard';
import { PhotoViewer } from '@/components/PhotoViewer';
import { Sheet } from '@/components/Sheet';
import { Avatar, Button, Card, ConditionBadge, Divider, EmptyState, haptic, Icon, T, Tap, VerificationList, VerifiedTick } from '@/components/ui';
import { categoryLabel, conditionById } from '@neva/core';
import { compactNumber, formatNaira, timeAgo } from '@neva/core';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const { width: W } = Dimensions.get('window');

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const listing = useStore((s) => s.listings[id]);
  const seller = useStore((s) => (listing ? s.users[listing.sellerId] : undefined));
  const saved = useStore((s) => s.saved.includes(id));
  const following = useStore((s) => (listing ? s.follows.includes(listing.sellerId) : false));
  const meId = useStore((s) => s.meId);
  const all = useStore((s) => s.listings);
  const store = useStore.getState();
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [condSheet, setCondSheet] = useState(false);
  const [trustSheet, setTrustSheet] = useState(false);
  const [ownerMenu, setOwnerMenu] = useState(false);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    if (listing && listing.sellerId !== meId) store.bumpView(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const similar = useMemo(
    () => (listing ? Object.values(all).filter((l) => l.id !== listing.id && l.status === 'active' && l.categoryId === listing.categoryId).slice(0, 8) : []),
    [all, listing],
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const headerBg = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [W * 0.7, W], [0, 1], 'clamp') }));
  const parallax = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.value < 0 ? scrollY.value / 2 : scrollY.value * 0.4 }] }));

  if (!listing || !seller) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 40 }}>
        <EmptyState icon="alert-circle-outline" title="Listing unavailable" body="It may have been removed by the seller or moderators." action={<Button title="Go back" variant="secondary" onPress={() => router.back()} />} />
      </View>
    );
  }

  const mine = listing.sellerId === meId;
  const cond = conditionById(listing.condition);

  const chat = (prefill?: string) => {
    const cid = store.startConversation(listing.sellerId, listing.id);
    router.push({ pathname: '/chat/[id]', params: { id: cid, prefill: prefill ?? 'Hi, is this still available?' } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* gallery */}
        <Animated.View style={[{ width: W, height: W * 1.05 }, parallax]}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}>
            {listing.images.length ? (
              listing.images.map((uri, i) => (
                <Pressable key={uri} onPress={() => setViewer(i)}>
                  <Image source={{ uri }} style={{ width: W, height: W * 1.05, backgroundColor: t.surface2 }} contentFit="cover" transition={200} />
                </Pressable>
              ))
            ) : (
              <View style={{ width: W, height: W * 1.05, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="image-outline" size={60} color={t.textFaint} />
              </View>
            )}
          </ScrollView>
          {listing.images.length > 1 && (
            <View style={{ position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
              {listing.images.map((_, i) => (
                <View key={i} style={{ width: i === page ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </View>
          )}
          {listing.status !== 'active' && (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' } as any}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>{listing.status}</Text>
            </View>
          )}
        </Animated.View>

        <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -22, paddingTop: 20, paddingHorizontal: 16, gap: 14 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={() => setCondSheet(true)}>
                <ConditionBadge condition={listing.condition} />
              </Pressable>
              {listing.promoted && <View style={{ backgroundColor: t.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}><T size={11.5} weight="600" dim>Sponsored</T></View>}
              <T faint size={12.5}>{categoryLabel(listing.categoryId, listing.customCategory)}{listing.subcategory ? ` › ${listing.subcategory}` : ''}</T>
            </View>
            <T size={23} weight="600" style={{ lineHeight: 29 }}>{listing.title}</T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <T size={30} weight="600" color={t.primary}>{formatNaira(listing.priceMinor)}</T>
              <T dim size={13.5} weight="600">{listing.negotiable ? 'Negotiable' : 'Fixed price'}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
              <Stat icon="location-outline" text={`${listing.city}${listing.area ? `, ${listing.area}` : ''}`} />
              <Stat icon="time-outline" text={timeAgo(listing.publishedAt ?? listing.createdAt)} />
            </View>
            {listing.sellerId === meId && (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Stat icon="eye-outline" text={`${compactNumber(listing.views)} views`} />
                <Stat icon="bookmark-outline" text={`${compactNumber(listing.saves)} saves`} />
                <Stat icon="chatbubble-outline" text={`${compactNumber(listing.enquiries)} enquiries`} />
              </View>
            )}
          </View>

          {/* seller card */}
          <Card>
            <Pressable onPress={() => router.push(`/seller/${seller.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar user={seller} size={50} online={seller.online} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <T weight="600" size={16}>{seller.displayName}</T>
                  <VerifiedTick user={seller} />
                </View>
                <T dim size={12.5}>
                  {seller.rating ? `★ ${seller.rating.avg} (${seller.rating.count}) · ` : ''}
                  {compactNumber(seller.followers)} followers · on Neva since {new Date(seller.joinedAt).getFullYear()}
                </T>
                {!!seller.responseNote && <T size={12} color={t.primary} weight="600">{seller.responseNote}</T>}
              </View>
              {!mine && (
                <Tap haptics onPress={() => store.toggleFollow(seller.id)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 999, justifyContent: 'center', backgroundColor: following ? t.surface2 : t.primary }}>
                  <T size={13} weight="600" color={following ? t.text : t.primaryText}>{following ? 'Following' : 'Follow'}</T>
                </Tap>
              )}
            </Pressable>
            <Divider />
            <Pressable onPress={() => setTrustSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11 }}>
              <Icon name="shield-checkmark-outline" size={17} color={t.primary} />
              <T size={13} style={{ flex: 1 }}>{seller.verifications.length} check{seller.verifications.length === 1 ? '' : 's'} completed · see exactly what was checked</T>
              <Icon name="chevron-forward" size={16} color={t.textFaint} />
            </Pressable>
          </Card>

          {/* specs */}
          {(listing.brand || Object.keys(listing.attributes).length > 0) && (
            <View>
              <T size={17} weight="600" style={{ marginBottom: 8 }}>Details</T>
              <Card>
                {[
                  ...(listing.brand ? [['Brand', listing.brand]] : []),
                  ...(listing.model ? [['Model', listing.model]] : []),
                  ['Condition', cond.label],
                  ...Object.entries(listing.attributes),
                ].map(([k, v], i, arr) => (
                  <View key={k}>
                    <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11 }}>
                      <T dim size={14} style={{ width: '42%' }}>{k}</T>
                      <T size={14} weight="600" style={{ flex: 1 }}>{v}</T>
                    </View>
                    {i < arr.length - 1 && <Divider inset={14} />}
                  </View>
                ))}
              </Card>
            </View>
          )}

          {!!listing.description && (
            <View>
              <T size={17} weight="600" style={{ marginBottom: 8 }}>Description</T>
              <T style={{ lineHeight: 22 }}>{listing.description}</T>
            </View>
          )}

          <View>
            <T size={17} weight="600" style={{ marginBottom: 8 }}>Getting it</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Fulfil on={listing.pickup} icon="walk-outline" label="Pickup" sub={listing.area ?? listing.city} />
              <Fulfil on={listing.delivery} icon="bicycle-outline" label="Delivery" sub={listing.delivery ? 'Arrange in chat' : 'Not offered'} />
            </View>
          </View>

          <View style={{ backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: radius.lg, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="shield-half-outline" size={18} color={t.text} />
              <T weight="600">Stay safe</T>
            </View>
            {['Meet in a busy public place and inspect the item first.', 'Check serial/IMEI and ownership through official channels.', 'Neva doesn’t hold payments yet — off-app payments aren’t protected.', 'Never share OTPs, passwords or bank PINs.'].map((s) => (
              <T key={s} size={13} dim style={{ lineHeight: 18 }}>• {s}</T>
            ))}
          </View>

          {!mine && (
            <Pressable onPress={() => router.push({ pathname: '/report', params: { type: 'listing', target: listing.id, name: listing.title } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', padding: 8 }}>
              <Icon name="flag-outline" size={16} color={t.danger} />
              <T color={t.danger} weight="600" size={14}>Report this listing</T>
            </Pressable>
          )}
        </View>

        {similar.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <T size={17} weight="600" style={{ paddingHorizontal: 16, marginBottom: 10 }}>Similar items</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {similar.map((l) => (
                <ListingTile key={l.id} listing={l} width={150} />
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.ScrollView>

      {/* floating header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top }}>
        <Animated.View style={[{ position: 'absolute', inset: 0, backgroundColor: t.bg, borderBottomWidth: 0.5, borderBottomColor: t.border } as any, headerBg]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 54, paddingHorizontal: 10, gap: 8 }}>
          <RoundBtn icon="chevron-back" onPress={() => router.back()} />
          <Animated.Text numberOfLines={1} style={[{ flex: 1, color: t.text, fontWeight: '700', fontSize: 16 }, headerBg]}>{listing.title}</Animated.Text>
          <RoundBtn icon="share-outline" onPress={() => Share.share({ message: `${listing.title} — ${formatNaira(listing.priceMinor)} on Neva\nneva://listing/${listing.id}` })} />
          {mine ? (
            <RoundBtn icon="ellipsis-horizontal" onPress={() => setOwnerMenu(true)} />
          ) : (
            <RoundBtn icon={saved ? 'bookmark' : 'bookmark-outline'} color={saved ? t.primary : undefined} onPress={() => { store.toggleSave(listing.id); haptic.light(); showToast(saved ? 'Removed from saved' : 'Saved', 'bookmark'); }} />
          )}
        </View>
      </View>

      {/* bottom CTA */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: t.bg, borderTopWidth: 0.5, borderTopColor: t.border, flexDirection: 'row', gap: 10 }}>
        {mine ? (
          <>
            <Button title="Edit" icon="create-outline" variant="secondary" style={{ flex: 1 }} onPress={() => { store.editListing(listing.id); router.push('/sell-new'); }} />
            <Button
              title={listing.status === 'sold' ? 'Relist' : 'Mark sold'}
              icon={listing.status === 'sold' ? 'refresh' : 'checkmark-done'}
              style={{ flex: 1 }}
              onPress={() => { store.setListingStatus(listing.id, listing.status === 'sold' ? 'active' : 'sold'); haptic.success(); }}
            />
          </>
        ) : listing.status === 'active' ? (
          <>
            <Tap haptics onPress={() => chat('What’s your last price?')} style={{ width: 54, height: 50, borderRadius: 999, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pricetag-outline" size={22} />
            </Tap>
            <Button title="Chat with seller" icon="chatbubble-ellipses" variant="gradient" style={{ flex: 1 }} onPress={() => chat()} />
          </>
        ) : (
          <Button title="Sold — see similar items" variant="secondary" style={{ flex: 1 }} onPress={() => router.navigate('/(tabs)/explore')} />
        )}
      </View>

      <PhotoViewer images={listing.images} index={viewer} onClose={() => setViewer(null)} />
      <Sheet visible={condSheet} onClose={() => setCondSheet(false)} title={cond.label}>
        <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 10 }}>
          <T style={{ lineHeight: 21 }}>{cond.definition}</T>
          <T dim size={13} style={{ lineHeight: 19 }}>This is the seller’s declared condition. If the item doesn’t match, you can report the listing.</T>
        </View>
      </Sheet>
      <Sheet visible={trustSheet} onClose={() => setTrustSheet(false)} title="What Neva has checked">
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
          <VerificationList labels={seller.verifications} />
          <T faint size={12} style={{ lineHeight: 17 }}>Checks reduce risk but don’t guarantee a transaction. Always inspect before paying.</T>
        </View>
      </Sheet>
      <Sheet
        visible={ownerMenu}
        onClose={() => setOwnerMenu(false)}
        actions={[
          { label: listing.status === 'paused' ? 'Resume listing' : 'Pause listing', icon: listing.status === 'paused' ? 'play-outline' : 'pause-outline', onPress: () => store.setListingStatus(listing.id, listing.status === 'paused' ? 'active' : 'paused') },
          { label: 'Share to my status', icon: 'aperture-outline', onPress: () => { store.addStory({ imageUri: listing.images[0], caption: listing.title, listingId: listing.id }); showToast('Posted to your status', 'aperture'); } },
          { label: 'Delete listing', icon: 'trash-outline', danger: true, onPress: () => Alert.alert('Delete this listing?', 'It will be removed from Explore and your shop.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { store.setListingStatus(listing.id, 'removed'); showToast('Listing deleted', 'trash-outline'); router.back(); } }]) },
        ]}
      />
    </View>
  );
}

function RoundBtn({ icon, onPress, color }: { icon: any; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Tap onPress={onPress} scaleTo={0.85} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={21} color={color} />
    </Tap>
  );
}

function Stat({ icon, text }: { icon: any; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
      <Icon name={icon} size={15} color={t.textDim} />
      <T dim size={13} numberOfLines={1}>{text}</T>
    </View>
  );
}

function Fulfil({ on, icon, label, sub }: { on: boolean; icon: any; label: string; sub: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, opacity: on ? 1 : 0.5 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: on ? t.primary + '22' : t.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={on ? t.primary : t.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="600" size={14}>{label}</T>
        <T dim size={12} numberOfLines={1}>{sub}</T>
      </View>
    </View>
  );
}
