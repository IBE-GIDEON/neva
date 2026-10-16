import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';
import { Button, Chip, haptic, Icon, type IconName, IconButton, T } from '@/components/ui';
import { LocationField } from '@/components/LocationField';
import { CATEGORIES, categoryById, categoryLabel, conditionById, CONDITIONS, OTHER_CATEGORY_IDEAS } from '@neva/core';
import type { Condition } from '@neva/core';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const PROHIBITED = /\b(stolen|replica|clone|fake|1:1|first copy|blacklisted|icloud locked)\b/i;
const MAX_PHOTOS = 8;

type Picker = 'category' | 'type' | 'condition' | null;

/** Single-page listing form (Marketplace-style). Draft autosaves to the store on every change. */
export default function SellNew() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useStore((s) => s.draft);
  const me = useStore((s) => s.users[s.meId]);
  const setDraft = useStore((s) => s.setDraft);
  const publishDraft = useStore((s) => s.publishDraft);
  const [ack, setAck] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!draft) setDraft({ step: 0, city: me?.city, pickup: true, delivery: false, negotiable: true, images: [], attributes: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = draft ?? { step: 0 };
  const update = (p: Partial<typeof d>) => setDraft(p);
  const cat = categoryById(d.categoryId);
  const isOther = d.categoryId === 'other';
  const images = d.images ?? [];
  const flagged = PROHIBITED.test(`${d.title ?? ''} ${d.description ?? ''}`);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!images.length) m.push('a photo');
    if ((d.title?.trim().length ?? 0) < 6) m.push('a title');
    if (!(d.priceMinor && d.priceMinor > 0)) m.push('a price');
    if (!d.categoryId || (isOther && (d.customCategory?.trim().length ?? 0) < 3)) m.push('a category');
    if (!d.condition) m.push('the condition');
    if ((d.description?.trim().length ?? 0) < 20) m.push('a description');
    if (!d.city) m.push('a city');
    if (!d.pickup && !d.delivery) m.push('pickup or delivery');
    return m;
  }, [images.length, d.title, d.priceMinor, d.categoryId, isOther, d.customCategory, d.condition, d.description, d.city, d.pickup, d.delivery]);

  const ready = missing.length === 0 && ack && !flagged;

  const publish = () => {
    if (!ready) return;
    const id = publishDraft();
    if (id) {
      haptic.success();
      showToast(d.editingId ? 'Listing updated' : 'Listing published', 'checkmark-circle-outline');
      router.replace(`/listing/${id}`);
    }
  };

  const discard = () =>
    Alert.alert('Discard this draft?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setDraft(null); router.back(); } },
    ]);

  const addPhotos = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showToast('Allow photo access to add pictures', 'alert-circle-outline');
    const r = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - images.length });
    if (!r.canceled) update({ images: [...images, ...r.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS) });
  };

  const choosePhotoSource = () =>
    Alert.alert('Add photos', undefined, [
      { text: 'Take photo', onPress: () => addPhotos(true) },
      { text: 'Choose from library', onPress: () => addPhotos(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* header */}
      <View style={{ paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 4 }}>
          <IconButton name="close" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T weight="600" size={16.5}>{d.editingId ? 'Edit listing' : 'New listing'}</T>
            <T faint size={11.5}>Draft saved</T>
          </View>
          {!d.editingId ? (
            <Pressable onPress={discard} hitSlop={8} style={{ paddingHorizontal: 12 }}>
              <T dim size={15}>Discard</T>
            </Pressable>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* photos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
          {images.length < MAX_PHOTOS && (
            <Pressable onPress={choosePhotoSource} style={{ width: 96, height: 96, borderRadius: radius.md, borderWidth: 1, borderColor: t.borderStrong, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icon name="camera-outline" size={24} color={t.text} />
              <T size={12} dim>{images.length}/{MAX_PHOTOS}</T>
            </Pressable>
          )}
          {images.map((uri, i) => (
            <Pressable key={uri + i} onPress={() => i > 0 && update({ images: [uri, ...images.filter((_, j) => j !== i)] })} style={{ width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: t.surface2 }}>
              <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" />
              {i === 0 && (
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 3, alignItems: 'center' }}>
                  <T size={11} weight="500" color="#fff">Cover</T>
                </View>
              )}
              <Pressable onPress={() => update({ images: images.filter((_, j) => j !== i) })} hitSlop={8} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={14} color="#fff" />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
        <T faint size={12} style={{ paddingHorizontal: 16, marginTop: -6, marginBottom: 6 }}>
          {images.length ? 'Tap a photo to make it the cover.' : 'Add real photos of the item — the first one is the cover.'}
        </T>

        <Group>
          <Field placeholder="Title" value={d.title} onChange={(v) => update({ title: v.slice(0, 80) })} />
          <Line />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <T size={16} dim>₦</T>
            <TextInput
              value={d.priceMinor ? (d.priceMinor / 100).toLocaleString('en-NG') : ''}
              onChangeText={(v) => update({ priceMinor: Number(v.replace(/\D/g, '').slice(0, 10)) * 100 || undefined })}
              keyboardType="number-pad"
              placeholder="Price"
              placeholderTextColor={t.textFaint}
              style={{ flex: 1, height: 52, color: t.text, fontSize: 16, marginLeft: 6 }}
            />
          </View>
          <Line />
          <ToggleRow label="Open to offers" value={d.negotiable ?? true} onChange={(v) => update({ negotiable: v })} />
        </Group>

        <Group>
          <SelectRow label="Category" value={categoryLabel(d.categoryId, d.customCategory) || undefined} onPress={() => setPicker('category')} />
          {cat && (cat.subs.length > 0 || d.subcategory) && (
            <>
              <Line />
              <SelectRow label="Type" value={d.subcategory} optional onPress={() => setPicker('type')} />
            </>
          )}
          <Line />
          <SelectRow label="Condition" value={d.condition ? conditionById(d.condition).label : undefined} onPress={() => setPicker('condition')} />
        </Group>

        <Group>
          <TextInput
            value={d.description ?? ''}
            onChangeText={(v) => update({ description: v.slice(0, 1500) })}
            placeholder={isOther ? 'Description — what it is, how it’s been used, what’s included, any flaws' : 'Description — condition, faults or repairs, what’s included, warranty'}
            placeholderTextColor={t.textFaint}
            multiline
            style={{ minHeight: 120, color: t.text, fontSize: 16, lineHeight: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }}
          />
        </Group>

        {/* optional details */}
        <Pressable onPress={() => setShowDetails(!showDetails)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 }}>
          <T weight="500" style={{ flex: 1 }}>More details</T>
          <T dim size={13} style={{ marginRight: 6 }}>Optional</T>
          <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={t.textDim} />
        </Pressable>
        {showDetails && (
          <Group>
            <Field placeholder="Brand" value={d.brand} onChange={(v) => update({ brand: v })} />
            <Line />
            <Field placeholder="Model" value={d.model} onChange={(v) => update({ model: v })} />
            {(cat?.attrs ?? []).map((a) => (
              <View key={a}>
                <Line />
                <Field placeholder={a} value={d.attributes?.[a]} onChange={(v) => update({ attributes: { ...(d.attributes ?? {}), [a]: v } })} />
              </View>
            ))}
            <Line />
            <CustomDetails fixedKeys={cat?.attrs ?? []} attributes={d.attributes ?? {}} onChange={(attributes) => update({ attributes })} />
          </Group>
        )}

        <Group>
          <LocationField variant="row" value={d.city} onChange={(v) => update({ city: v })} placeholder="City or town" />
          <Line />
          <Field placeholder="Area (optional) — only your area is shown" value={d.area} onChange={(v) => update({ area: v })} />
          <Line />
          <ToggleRow label="Pickup" value={d.pickup ?? true} onChange={(v) => update({ pickup: v })} />
          <Line />
          <ToggleRow label="Delivery" value={d.delivery ?? false} onChange={(v) => update({ delivery: v })} />
        </Group>

        {flagged && (
          <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 }}>
            <Icon name="alert-circle-outline" size={17} color={t.danger} />
            <T size={13} color={t.danger} style={{ flex: 1, lineHeight: 18 }}>Remove terms linked to prohibited items (stolen, replica, iCloud locked…) to publish.</T>
          </View>
        )}

        <Pressable onPress={() => setAck(!ack)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 20 }}>
          <Icon name={ack ? 'checkbox' : 'square-outline'} size={22} color={ack ? t.primary : t.textDim} />
          <T size={13} dim style={{ flex: 1, lineHeight: 19 }}>I own this item, the photos are of the actual item, and I’ve described its condition honestly.</T>
        </Pressable>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, gap: 8 }}>
        {missing.length > 0 && <T faint size={12} center numberOfLines={2}>Add {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''} to publish</T>}
        <Button title={d.editingId ? 'Save changes' : 'Publish'} variant={ready ? 'gradient' : 'secondary'} disabled={!ready} onPress={publish} />
      </View>

      {/* pickers */}
      <Sheet visible={picker === 'category'} onClose={() => setPicker(null)} title="Category">
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
          {CATEGORIES.map((c) => (
            <OptionRow
              key={c.id}
              icon={c.icon as IconName}
              label={c.name}
              selected={d.categoryId === c.id}
              onPress={() => {
                update({ categoryId: c.id, subcategory: undefined, customCategory: c.id === 'other' ? d.customCategory : undefined, attributes: {} });
                if (c.id !== 'other') setPicker(null);
              }}
            />
          ))}
          {isOther && <OtherCategory value={d.customCategory ?? ''} onChange={(v) => update({ customCategory: v })} onDone={() => setPicker(null)} />}
        </ScrollView>
      </Sheet>

      <Sheet visible={picker === 'type'} onClose={() => setPicker(null)} title="Type">
        <TypePicker subs={cat?.subs ?? []} value={d.subcategory} onChange={(v) => update({ subcategory: v })} onDone={() => setPicker(null)} />
      </Sheet>

      <Sheet visible={picker === 'condition'} onClose={() => setPicker(null)} title="Condition">
        <ScrollView style={{ maxHeight: 560 }}>
          {CONDITIONS.map((c) => (
            <OptionRow key={c.id} label={c.label} sub={c.definition} selected={d.condition === c.id} onPress={() => { update({ condition: c.id as Condition }); setPicker(null); }} />
          ))}
        </ScrollView>
      </Sheet>

    </KeyboardAvoidingView>
  );
}

/* ---------- building blocks ---------- */

function Group({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ marginTop: 12, marginHorizontal: 16, borderRadius: radius.md, backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, overflow: 'hidden' }}>{children}</View>;
}

function Line() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 }} />;
}

function Field({ placeholder, value, onChange }: { placeholder: string; value?: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return <TextInput value={value ?? ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.textFaint} style={{ height: 52, paddingHorizontal: 16, color: t.text, fontSize: 16 }} />;
}

function SelectRow({ label, value, optional, onPress }: { label: string; value?: string; optional?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
      <T size={16} style={{ flex: 1 }} color={value ? t.text : t.textFaint}>{value ? label : `${label}${optional ? ' (optional)' : ''}`}</T>
      {!!value && <T size={15} dim numberOfLines={1} style={{ maxWidth: '60%', marginRight: 6 }}>{value}</T>}
      <Icon name="chevron-forward" size={17} color={t.textFaint} />
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16 }}>
      <T size={16} style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary, false: t.surface3 }} thumbColor="#fff" />
    </View>
  );
}

function OptionRow({ label, sub, icon, selected, onPress }: { label: string; sub?: string; icon?: IconName; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: sub ? 'flex-start' : 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
      {icon && <Icon name={icon} size={20} color={t.text} />}
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15.5} weight={selected ? '600' : '400'}>{label}</T>
        {!!sub && <T dim size={12.5} style={{ lineHeight: 17 }}>{sub}</T>}
      </View>
      {selected && <Icon name="checkmark" size={20} color={t.primary} />}
    </Pressable>
  );
}

function TypePicker({ subs, value, onChange, onDone }: { subs: readonly string[]; value?: string; onChange: (v?: string) => void; onDone: () => void }) {
  const t = useTheme();
  const [custom, setCustom] = useState(() => !!value && !subs.includes(value));
  return (
    <View>
      {subs.map((s) => (
        <OptionRow key={s} label={s} selected={!custom && value === s} onPress={() => { setCustom(false); onChange(s); onDone(); }} />
      ))}
      <OptionRow label="Other" selected={custom} onPress={() => { setCustom(true); onChange(undefined); }} />
      {custom && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
          <TextInput autoFocus value={value ?? ''} onChangeText={(v) => onChange(v.slice(0, 30))} placeholder="Type it in" placeholderTextColor={t.textFaint} style={{ height: 48, borderRadius: radius.md, backgroundColor: t.surface2, paddingHorizontal: 14, color: t.text, fontSize: 16 }} />
          <Button small title="Done" variant="inverse" disabled={!value?.trim()} onPress={onDone} />
        </View>
      )}
    </View>
  );
}

function OtherCategory({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const t = useTheme();
  const listings = useStore((s) => s.listings);
  const used = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(listings).forEach((l) => {
      if (l.categoryId === 'other' && l.customCategory) counts[l.customCategory] = (counts[l.customCategory] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [listings]);
  const q = value.trim().toLowerCase();
  const pool = Array.from(new Set([...used, ...OTHER_CATEGORY_IDEAS]));
  const suggestions = (q ? pool.filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q) : pool).slice(0, 8);
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
      <TextInput autoFocus value={value} onChangeText={(v) => onChange(v.slice(0, 40))} placeholder="Name the category (e.g. Musical instruments)" placeholderTextColor={t.textFaint} style={{ height: 48, borderRadius: radius.md, backgroundColor: t.surface2, paddingHorizontal: 14, color: t.text, fontSize: 16 }} />
      {suggestions.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {suggestions.map((c) => (
            <Chip key={c} label={c} onPress={() => onChange(c)} />
          ))}
        </View>
      )}
      <Button small title="Done" variant="inverse" disabled={value.trim().length < 3} onPress={onDone} />
    </View>
  );
}

/** Free-form name/value details, stored alongside fixed specs in listing.attributes. */
function CustomDetails({ fixedKeys, attributes, onChange }: { fixedKeys: readonly string[]; attributes: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  const t = useTheme();
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => Object.entries(attributes).filter(([k]) => !fixedKeys.includes(k)).map(([k, v]) => ({ k, v })));
  const commit = (next: { k: string; v: string }[]) => {
    setRows(next);
    const fixed = Object.fromEntries(Object.entries(attributes).filter(([k]) => fixedKeys.includes(k)));
    const extra = Object.fromEntries(next.filter((r) => r.k.trim() && r.v.trim()).map((r) => [r.k.trim(), r.v.trim()]));
    onChange({ ...fixed, ...extra });
  };
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6 }}>
            <TextInput value={r.k} onChangeText={(k) => commit(rows.map((x, j) => (j === i ? { ...x, k: k.slice(0, 30) } : x)))} placeholder="Name" placeholderTextColor={t.textFaint} style={{ flex: 1, height: 52, color: t.text, fontSize: 16 }} />
            <TextInput value={r.v} onChangeText={(v) => commit(rows.map((x, j) => (j === i ? { ...x, v: v.slice(0, 60) } : x)))} placeholder="Value" placeholderTextColor={t.textFaint} style={{ flex: 1.3, height: 52, color: t.text, fontSize: 16 }} />
            <IconButton name="close" size={17} color={t.textDim} onPress={() => commit(rows.filter((_, j) => j !== i))} />
          </View>
          <Line />
        </View>
      ))}
      {rows.length < 8 && (
        <Pressable onPress={() => setRows([...rows, { k: '', v: '' }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 16 }}>
          <Icon name="add" size={19} color={t.primary} />
          <T color={t.primary}>Add a detail</T>
        </Pressable>
      )}
    </View>
  );
}
