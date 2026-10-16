import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedPost, ListingTile } from '@/components/ListingCard';
import { Chip, EmptyState, Icon, type IconName, IconButton, T, Tap } from '@/components/ui';
import { CATEGORIES } from '@neva/core';
import type { Listing } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const { width: W } = Dimensions.get('window');
type Tab = 'foryou' | 'following' | 'market';

export default function Explore() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const listings = useStore((s) => s.listings);
  const follows = useStore((s) => s.follows);
  const interests = useStore((s) => s.interests);
  const blocked = useStore((s) => s.blocked);
  const personalization = useStore((s) => s.settings.personalization);
  const [tab, setTab] = useState<Tab>('foryou');
  const params = useLocalSearchParams<{ tab?: Tab; t?: string }>();

  // Deep link from Updates › "See all": open straight on the requested tab
  useEffect(() => {
    if (params.tab === 'following' || params.tab === 'market' || params.tab === 'foryou') {
      setTab(params.tab);
      setCat(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [params.tab, params.t]);
  const [cat, setCat] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList>(null);

  const active = useMemo(() => Object.values(listings).filter((l) => l.status === 'active' && !blocked.includes(l.sellerId)), [listings, blocked]);

  const data: Listing[] = useMemo(() => {
    let base = active.filter((l) => !cat || l.categoryId === cat);
    if (tab === 'following') base = base.filter((l) => follows.includes(l.sellerId));
    // Blueprint §12: understandable ranking — freshness + interest match + follow graph; promoted labelled, never hides relevance
    const score = (l: Listing) => {
      const ageH = (Date.now() - (l.publishedAt ?? l.createdAt)) / 3600_000;
      let s = 100 / (1 + ageH / 24);
      if (personalization && interests.includes(l.categoryId)) s += 25;
      if (follows.includes(l.sellerId)) s += 15;
      s += Math.min(10, l.images.length * 3 + Object.keys(l.attributes).length);
      return s;
    };
    return base.sort((a, b) => score(b) - score(a));
  }, [active, cat, tab, follows, interests, personalization]);

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 10 }}>
        <Chip label="All" active={!cat} onPress={() => setCat(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.name} icon={c.icon as IconName} active={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />
        ))}
      </ScrollView>
      {tab === 'market' && !cat && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 6 }}>
          {CATEGORIES.slice(0, 8).map((c, i) => (
            <Tap key={c.id} onPress={() => setCat(c.id)} style={{ width: (W - 24 - 24) / 4, aspectRatio: 1, borderRadius: radius.lg, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon as IconName} size={21} color={t.text} />
              </View>
              <T size={11.5} weight="600" numberOfLines={1}>{c.name}</T>
            </Tap>
          ))}
        </View>
      )}
    </View>
  );

  const emptyAll =
    active.length === 0 ? (
      <EmptyState
        icon="storefront-outline"
        title="No listings yet"
        body="Be the first to sell on Neva. Listings from sellers will show up here."
        action={<Tap onPress={() => router.push('/sell-new')} style={{ marginTop: 12, paddingHorizontal: 18, height: 38, justifyContent: 'center', borderRadius: 10, backgroundColor: t.inverse }}><T weight="600" size={14} color={t.inverseText}>Create a listing</T></Tap>}
      />
    ) : (
      <EmptyState icon="cube-outline" title="Nothing in this category" body="Try another category or check back later." />
    );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  };

  const tileW = (W - 12 * 3) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 56 }}>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', flex: 1, letterSpacing: -0.7 }}>Explore</Text>
          <IconButton name="bookmark-outline" onPress={() => router.push('/saved')} />
          <IconButton name="options-outline" onPress={() => router.push('/filters')} />
        </View>
        <Pressable onPress={() => router.push('/search')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.surface2, borderRadius: radius.pill, paddingHorizontal: 14, height: 44 }}>
          <Icon name="search" size={18} color={t.textDim} />
          <T dim size={15.5}>Search iPhone 13, PS5, MacBook…</T>
        </Pressable>
        <View style={{ flexDirection: 'row', marginTop: 10, gap: 20 }}>
          {(
            [
              ['foryou', 'For you'],
              ['following', 'Following'],
              ['market', 'Marketplace'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <Pressable key={k} onPress={() => { setTab(k); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }} style={{ paddingVertical: 8 }}>
              <T size={16} weight={tab === k ? '600' : '500'} dim={tab !== k}>{label}</T>
              {tab === k && <Animated.View entering={FadeIn} style={{ height: 2, borderRadius: 1, backgroundColor: t.text, marginTop: 6 }} />}
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'market' ? (
        <FlatList
          ref={listRef}
          key="grid"
          data={data}
          numColumns={2}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
          contentContainerStyle={{ gap: 18, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          renderItem={({ item }) => <ListingTile listing={item} width={tileW} />}
          ListEmptyComponent={emptyAll}
        />
      ) : (
        <FlatList
          ref={listRef}
          key="feed"
          data={data}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          renderItem={({ item }) => <FeedPost listing={item} width={W} />}
          initialNumToRender={3}
          windowSize={7}
          ListEmptyComponent={
            tab === 'following' ? (
              <EmptyState icon="people-outline" title="Follow some sellers" body="Listings from sellers you follow show up here." action={<Tap onPress={() => setTab('foryou')} style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: t.primary }}><T weight="600" color={t.primaryText}>Browse For you</T></Tap>} />
            ) : (
              emptyAll
            )
          }
        />
      )}
    </View>
  );
}
