import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, type IconName, T } from '@/components/ui';
import { LocationField } from '@/components/LocationField';
import { CATEGORIES, CONDITIONS } from '@neva/core';
import type { SearchFilters } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

export default function Filters() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const current = useStore((s) => s.search.filters);
  const setSearch = useStore((s) => s.setSearch);
  const [f, setF] = useState<SearchFilters>(current);
  const [min, setMin] = useState(current.minPrice ? String(current.minPrice / 100) : '');
  const [max, setMax] = useState(current.maxPrice ? String(current.maxPrice / 100) : '');

  const apply = () => {
    setSearch({ filters: { ...f, minPrice: min ? Number(min) * 100 : undefined, maxPrice: max ? Number(max) * 100 : undefined } });
    if (router.canGoBack()) router.back();
    setTimeout(() => router.navigate('/search'), 50);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Filters" right={<Button small variant="ghost" title="Reset" onPress={() => { setF({ conditions: [], sort: 'relevance' }); setMin(''); setMax(''); }} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Group title="Category">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon as IconName} active={f.categoryId === c.id} onPress={() => setF({ ...f, categoryId: f.categoryId === c.id ? undefined : c.id })} />
          ))}
        </Group>
        <Group title="Condition">
          {CONDITIONS.map((c) => (
            <Chip key={c.id} label={c.label} active={f.conditions.includes(c.id)} onPress={() => setF({ ...f, conditions: f.conditions.includes(c.id) ? f.conditions.filter((x) => x !== c.id) : [...f.conditions, c.id] })} />
          ))}
        </Group>
        <View style={{ gap: 10 }}>
          <T weight="600" size={16}>Price (₦)</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              ['Min', min, setMin],
              ['Max', max, setMax],
            ].map(([label, val, set]: any) => (
              <TextInput key={label} value={val} onChangeText={(v) => set(v.replace(/\D/g, ''))} placeholder={label} placeholderTextColor={t.textFaint} keyboardType="number-pad" style={{ flex: 1, height: 50, borderRadius: radius.md, backgroundColor: t.surface2, paddingHorizontal: 14, color: t.text, fontSize: 16 }} />
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T weight="600" size={16}>Location</T>
          <LocationField value={f.city} onChange={(v) => setF({ ...f, city: v })} placeholder="Any location" clearable />
        </View>
        <Group title="Seller type">
          <Chip label="Retail shops" active={f.sellerType === 'retail'} onPress={() => setF({ ...f, sellerType: f.sellerType === 'retail' ? undefined : 'retail' })} />
          <Chip label="Individuals" active={f.sellerType === 'individual'} onPress={() => setF({ ...f, sellerType: f.sellerType === 'individual' ? undefined : 'individual' })} />
        </Group>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T weight="600" style={{ flex: 1 }}>Delivery available</T>
          <Switch value={!!f.delivery} onValueChange={(v) => setF({ ...f, delivery: v || undefined })} trackColor={{ true: t.primary, false: t.surface3 }} thumbColor="#fff" />
        </View>
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: insets.bottom + 12, borderTopWidth: 0.5, borderTopColor: t.border }}>
        <Button title="Show results" onPress={apply} />
      </View>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <T weight="600" size={16}>{title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}
