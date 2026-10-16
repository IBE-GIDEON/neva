import { router } from 'expo-router';
import { Dimensions, FlatList, View } from 'react-native';

import { ListingTile } from '@/components/ListingCard';
import { EmptyState, Header, T, Tap } from '@/components/ui';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

const { width: W } = Dimensions.get('window');

export default function Saved() {
  const t = useTheme();
  const saved = useStore((s) => s.saved);
  const listings = useStore((s) => s.listings);
  const data = saved.map((id) => listings[id]).filter((l) => !!l && l.status !== 'removed');
  const tileW = (W - 12 * 3) / 2;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Saved items" subtitle="Private — only you can see these" />
      <FlatList
        data={data}
        numColumns={2}
        keyExtractor={(l) => l!.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 18, paddingVertical: 12 }}
        renderItem={({ item }) => <ListingTile listing={item!} width={tileW} showStatus />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Nothing saved yet"
            body="Tap the bookmark — or double-tap a post — to save it for later."
            action={<Tap onPress={() => router.navigate('/(tabs)/explore')} style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: t.primary }}><T weight="600" color={t.primaryText}>Explore</T></Tap>}
          />
        }
      />
    </View>
  );
}
