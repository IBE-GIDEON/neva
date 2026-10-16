import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingTile } from '@/components/ListingCard';
import { Sheet } from '@/components/Sheet';
import { Avatar, Button, EmptyState, Header, Icon, IconButton, T, VerificationList, VerifiedTick } from '@/components/ui';
import { compactNumber, timeAgo } from '@neva/core';
import { isStoryLive, showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const { width: W } = Dimensions.get('window');
type Tab = 'listings' | 'reviews' | 'about';

export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.users[id]);
  const meId = useStore((s) => s.meId);
  const following = useStore((s) => s.follows.includes(id));
  const blocked = useStore((s) => s.blocked.includes(id));
  const allListings = useStore((s) => s.listings);
  const allReviews = useStore((s) => s.reviews);
  const users = useStore((s) => s.users);
  const hasStory = useStore((s) => s.stories.some((st) => st.userId === id && isStoryLive(st)));
  const store = useStore.getState();
  const [tab, setTab] = useState<Tab>('listings');
  const [menu, setMenu] = useState(false);

  const listings = useMemo(() => Object.values(allListings).filter((l) => l.sellerId === id && ['active', 'sold'].includes(l.status)).sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold') || b.createdAt - a.createdAt), [allListings, id]);
  const reviews = allReviews.filter((r) => r.sellerId === id);

  if (!user) return <View style={{ flex: 1, backgroundColor: t.bg }}><Header /><EmptyState icon="person-outline" title="Profile not found" body="This account may have been deleted or is no longer available." /></View>;

  const isMe = id === meId;
  const shopTitle = user.shopName?.trim() && user.shopName.trim() !== user.displayName ? user.shopName.trim() : undefined;
  const tileW = (W - 12 * 3) / 2;
  const message = () => router.push(`/chat/${store.startConversation(id)}`);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ height: 190 + insets.top, backgroundColor: t.surface2 }}>
          {user.coverUri ? (
            <Image source={{ uri: user.coverUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.55 }} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }} />
          {isMe && (
            <Pressable onPress={() => router.push('/edit-profile')} style={{ position: 'absolute', right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, height: 32, borderRadius: 9 }}>
              <Icon name="camera-outline" size={15} color="#fff" />
              <T size={12.5} weight="500" color="#fff">Edit cover</T>
            </Pressable>
          )}
        </View>
        <View style={{ marginTop: -52, paddingHorizontal: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ borderRadius: 60, borderWidth: 4, borderColor: t.bg, backgroundColor: t.bg }}>
              <Avatar user={user} size={100} ring={hasStory} onPress={hasStory ? () => router.push(`/story/${id}`) : undefined} online={user.online && !hasStory} />
            </View>
            {!isMe && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <Button small title={following ? 'Following' : 'Follow'} variant={following ? 'secondary' : 'primary'} icon={following ? 'checkmark' : 'person-add'} onPress={() => store.toggleFollow(id)} />
                {!blocked && <Button small title="Message" variant="secondary" icon="chatbubble-outline" onPress={message} />}
              </View>
            )}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={24} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{shopTitle ?? user.displayName}</T>
              <VerifiedTick user={user} size={20} />
            </View>
            {!!shopTitle && <T size={15} weight="500" style={{ marginTop: 1 }}>{user.displayName}</T>}
            <T dim>@{user.username}{user.shopType ? ` · ${user.shopType === 'retail' ? 'Retail shop' : 'Individual seller'}` : ''}</T>
          </View>
          {!!user.bio && <T style={{ lineHeight: 21 }}>{user.bio}</T>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Meta icon="location-outline" text={user.city} />
            <Meta icon="calendar-outline" text={`Joined ${new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`} />
            {!!user.responseNote && <Meta icon="flash-outline" text={user.responseNote} color={t.primary} />}
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: radius.lg, paddingVertical: 14, borderWidth: 0.5, borderColor: t.border }}>
            <StatBox value={String(listings.filter((l) => l.status === 'active').length)} label="Listings" />
            <StatBox value={compactNumber(user.followers)} label="Followers" />
            <StatBox value={user.rating ? `★ ${user.rating.avg}` : '—'} label={user.rating ? `${user.rating.count} reviews` : 'No reviews'} />
          </View>
          {blocked && (
            <View style={{ backgroundColor: t.danger + '1A', borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="ban" size={18} color={t.danger} />
              <T size={13.5} style={{ flex: 1 }}>You blocked this account.</T>
              <Button small title="Unblock" variant="ghost" onPress={() => store.toggleBlock(id)} />
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 18, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
          {(['listings', 'reviews', 'about'] as Tab[]).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: tab === k ? t.primary : 'transparent' }}>
              <T weight={tab === k ? '600' : '500'} dim={tab !== k}>{k[0]!.toUpperCase() + k.slice(1)}</T>
            </Pressable>
          ))}
        </View>

        {tab === 'listings' &&
          (listings.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12 }}>
              {listings.map((l) => (
                <ListingTile key={l.id} listing={l} width={tileW} />
              ))}
            </View>
          ) : (
            <EmptyState icon="cube-outline" title="No listings yet" />
          ))}

        {tab === 'reviews' && (
          <View style={{ padding: 16, gap: 14 }}>
            <RatingSummary sellerId={id} isMe={isMe} />
            {reviews.length === 0 && <EmptyState icon="star-outline" title="No reviews yet" body="Reviews come from buyers who have chatted with this seller." />}
            {reviews.map((r) => (
              <View key={r.id} style={{ gap: 6, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar user={users[r.reviewerId]} size={34} />
                  <View style={{ flex: 1 }}>
                    <T weight="600" size={14}>{users[r.reviewerId]?.displayName}</T>
                    <T faint size={12}>{timeAgo(r.createdAt)}</T>
                  </View>
                  <Stars value={r.rating} size={12} />
                </View>
                <T style={{ lineHeight: 20 }}>{r.text}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name={r.verificationType === 'conversation' ? 'chatbubbles-outline' : 'help-circle-outline'} size={13} color={t.textDim} />
                  <T dim size={11.5}>{r.verificationType === 'conversation' ? 'Reviewer chatted with this seller on Neva' : 'Unverified review — no linked interaction'}</T>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === 'about' && (
          <View style={{ padding: 16, gap: 16 }}>
            <T size={16} weight="600">Verification</T>
            <VerificationList labels={user.verifications} />
            <T faint size={12} style={{ lineHeight: 17 }}>Neva shows exactly what was checked and never a vague “trusted” badge. Emails and addresses are never public.</T>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 6 }}>
        <IconButton name="chevron-back" color="#fff" onPress={() => router.back()} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 }} />
        <View style={{ flex: 1 }} />
        <IconButton name="ellipsis-vertical" color="#fff" onPress={() => setMenu(true)} style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 }} />
      </View>

      <Sheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Share profile', icon: 'share-outline', onPress: () => Share.share({ message: `${user.displayName} on Neva — neva://seller/${id}` }) },
          ...(!isMe
            ? [
                { label: blocked ? 'Unblock' : 'Block', icon: 'ban-outline' as const, danger: true, onPress: () => { store.toggleBlock(id); showToast(blocked ? 'Unblocked' : 'Blocked', 'ban'); } },
                { label: 'Report', icon: 'flag-outline' as const, danger: true, onPress: () => router.push({ pathname: '/report', params: { type: 'user', target: id, name: user.displayName } }) },
              ]
            : []),
        ]}
      />
    </View>
  );
}

function RatingSummary({ sellerId, isMe }: { sellerId: string; isMe: boolean }) {
  const t = useTheme();
  const seller = useStore((s) => s.users[sellerId]);
  const reviews = useStore((s) => s.reviews);
  const meId = useStore((s) => s.meId);
  const eligible = useStore((s) => s.canReview(sellerId));
  const mine = reviews.find((r) => r.sellerId === sellerId && r.reviewerId === meId);
  const local = reviews.filter((r) => r.sellerId === sellerId);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: local.filter((r) => r.rating === n).length }));
  const max = Math.max(1, ...dist.map((d) => d.c));
  return (
    <View style={{ gap: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View style={{ alignItems: 'center', minWidth: 76 }}>
          <T size={36} weight="700">{seller?.rating ? seller.rating.avg.toFixed(1) : '–'}</T>
          <Stars value={seller?.rating?.avg ?? 0} size={13} />
          <T dim size={12} style={{ marginTop: 4 }}>{seller?.rating ? `${seller.rating.count} ratings` : 'No ratings'}</T>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          {dist.map((d) => (
            <View key={d.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T dim size={11.5} style={{ width: 8 }}>{d.n}</T>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: t.surface3, overflow: 'hidden' }}>
                <View style={{ width: `${(d.c / max) * 100}%`, height: 5, borderRadius: 3, backgroundColor: t.text }} />
              </View>
            </View>
          ))}
        </View>
      </View>
      {!isMe &&
        (eligible ? (
          <Button
            small
            title={mine ? 'Edit your review' : 'Write a review'}
            icon={mine ? 'create-outline' : 'star-outline'}
            variant={mine ? 'secondary' : 'inverse'}
            onPress={() => router.push({ pathname: '/review', params: { sellerId } })}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="information-circle-outline" size={16} color={t.textDim} />
            <T dim size={12.5} style={{ flex: 1 }}>You can rate this seller after you’ve chatted with them.</T>
          </View>
        ))}
    </View>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star-outline'} size={size} color={t.text} />
      ))}
    </View>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <T size={18} weight="600">{value}</T>
      <T dim size={12}>{label}</T>
    </View>
  );
}

function Meta({ icon, text, color }: { icon: any; text: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={15} color={color ?? t.textDim} />
      <T size={13} color={color} dim={!color}>{text}</T>
    </View>
  );
}
