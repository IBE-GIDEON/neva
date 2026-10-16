import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingTile } from '@/components/ListingCard';
import { Avatar, Chip, EmptyState, Icon, IconButton, T, VerifiedTick } from '@/components/ui';
import { categoryById } from '@neva/core';
import type { SearchFilters } from '@neva/core';
import { activeFilterCount, searchListings } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const { width: W } = Dimensions.get('window');
const SORTS: { k: SearchFilters['sort']; label: string }[] = [
  { k: 'relevance', label: 'Best match' },
  { k: 'newest', label: 'Newest' },
  { k: 'price_asc', label: 'Price ↑' },
  { k: 'price_desc', label: 'Price ↓' },
];

export default function Search() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const search = useStore((s) => s.search);
  const listings = useStore((s) => s.listings);
  const users = useStore((s) => s.users);
  const blocked = useStore((s) => s.blocked);
  const recent = useStore((s) => s.recentSearches);
  const { setSearch, pushRecentSearch, clearRecentSearches } = useStore.getState();
  const [text, setText] = useState(search.query);
  const [submitted, setSubmitted] = useState(!!search.query || activeFilterCount(search.filters) > 0);

  const results = useMemo(() => searchListings(Object.values(listings), users, search.query, search.filters, blocked), [listings, users, search, blocked]);
  const sellers = useMemo(() => {
    const q = search.query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(users).filter((u) => u.isSeller && u.id !== 'me' && (u.displayName.toLowerCase().includes(q) || u.username.includes(q)));
  }, [users, search.query]);
  const fc = activeFilterCount(search.filters);

  const submit = (q: string) => {
    setText(q);
    setSearch({ query: q });
    pushRecentSearch(q);
    setSubmitted(true);
  };

  const tileW = (W - 12 * 3) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: radius.pill, paddingHorizontal: 14, height: 44, gap: 8 }}>
          <Icon name="search" size={18} color={t.textDim} />
          <TextInput
            autoFocus={!submitted}
            value={text}
            onChangeText={(v) => { setText(v); if (!v) { setSearch({ query: '' }); } }}
            onSubmitEditing={() => submit(text)}
            returnKeyType="search"
            placeholder="Search gadgets, brands, sellers"
            placeholderTextColor={t.textDim}
            style={{ flex: 1, color: t.text, fontSize: 16 }}
          />
          {!!text && <IconButton name="close-circle" size={18} color={t.textDim} onPress={() => { setText(''); setSearch({ query: '' }); }} style={{ padding: 2 }} />}
        </View>
        <View>
          <IconButton name="options-outline" onPress={() => router.push('/filters')} />
          {fc > 0 && <View style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}><T size={10} weight="600" color={t.primaryText}>{fc}</T></View>}
        </View>
      </View>

      {!submitted ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 22 }} keyboardShouldPersistTaps="handled">
          {recent.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 6 }}>
              <Icon name="search-outline" size={28} color={t.textFaint} />
              <T dim center>Search by item, brand, model or seller.</T>
            </View>
          )}
          {recent.length > 0 && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T weight="600" size={16}>Recent</T>
                <Pressable onPress={clearRecentSearches}><T color={t.primary} weight="600" size={13.5}>Clear</T></Pressable>
              </View>
              {recent.map((r) => (
                <Pressable key={r} onPress={() => submit(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
                  <Icon name="time-outline" size={19} color={t.textDim} />
                  <T style={{ flex: 1 }}>{r}</T>
                  <Icon name="arrow-up-outline" size={17} color={t.textFaint} style={{ transform: [{ rotate: '-45deg' }] }} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={(l) => l.id}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
          contentContainerStyle={{ gap: 18, paddingBottom: 60 }}
          ListHeaderComponent={
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 6 }}>
                {SORTS.map((s) => (
                  <Chip key={s.k} label={s.label} active={search.filters.sort === s.k} onPress={() => setSearch({ filters: { sort: s.k } })} />
                ))}
                {search.filters.categoryId && <Chip label={`${categoryById(search.filters.categoryId)?.name} ✕`} active onPress={() => setSearch({ filters: { categoryId: undefined } })} />}
                {search.filters.city && <Chip label={`${search.filters.city} ✕`} active onPress={() => setSearch({ filters: { city: undefined } })} />}
              </ScrollView>
              {sellers.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}>
                  <T dim size={12.5} weight="600">SELLERS</T>
                  {sellers.slice(0, 3).map((u) => (
                    <Pressable key={u.id} onPress={() => router.push(`/seller/${u.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                      <Avatar user={u} size={38} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <T weight="600">{u.displayName}</T>
                        <VerifiedTick user={u} />
                      </View>
                      <T dim size={12}>{u.city}</T>
                    </Pressable>
                  ))}
                </View>
              )}
              <T dim size={13} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                {results.length} result{results.length === 1 ? '' : 's'}{search.query ? ` for “${search.query}”` : ''}
              </T>
            </View>
          }
          renderItem={({ item }) => <ListingTile listing={item} width={tileW} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No matches"
              body={fc ? 'Try removing some filters — we never quietly relax them for you.' : 'Check the spelling or try a broader term like “iPhone” or “laptop”.'}
              action={fc ? <Chip label="Clear all filters" active onPress={() => setSearch({ filters: { categoryId: undefined, conditions: [], minPrice: undefined, maxPrice: undefined, city: undefined, delivery: undefined, sellerType: undefined } })} /> : undefined}
            />
          }
        />
      )}
    </View>
  );
}
