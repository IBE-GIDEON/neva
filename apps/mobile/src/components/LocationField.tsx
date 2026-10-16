import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { suggestPlaces, tidyPlace } from '@neva/core';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';
import { Icon, T } from './ui';

/**
 * Free-text location with search-style suggestions. Type anything (town, area, estate),
 * or tap a suggestion. `variant="row"` blends into grouped form rows; `"box"` is a standalone field.
 */
export function LocationField({ value, onChange, placeholder = 'City, town or area', variant = 'box', clearable }: { value?: string; onChange: (v: string | undefined) => void; placeholder?: string; variant?: 'box' | 'row'; clearable?: boolean }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(value ?? '');
  const latest = useRef(value ?? '');
  // Places already used across listings & profiles on this device, so local spellings get reused.
  const used = useStore((s) => s.listings);
  const recent = useMemo(() => Array.from(new Set(Object.values(used).map((l) => l.city))).slice(0, 4), [used]);
  const suggestions = useMemo(() => suggestPlaces(text, recent), [text, recent]);
  const exact = suggestions.some((p) => p.name.toLowerCase() === text.trim().toLowerCase());

  const commit = (v: string) => {
    const tidy = tidyPlace(v);
    latest.current = tidy;
    setText(tidy);
    onChange(tidy || undefined);
  };

  const box = variant === 'box';
  return (
    <View>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: box ? 14 : 16, height: box ? 50 : 52 }, box && { borderRadius: radius.md, backgroundColor: t.surface2 }]}>
        <Icon name="location-outline" size={18} color={t.textDim} />
        <TextInput
          value={text}
          onChangeText={(v) => {
            latest.current = v;
            setText(v);
            onChange(v.trim() ? v : undefined);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // short grace period so a tap on a suggestion lands before the list hides
            setTimeout(() => {
              setFocused(false);
              if (latest.current.trim()) commit(latest.current);
            }, 180);
          }}
          placeholder={placeholder}
          placeholderTextColor={t.textFaint}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          style={{ flex: 1, color: t.text, fontSize: 16 }}
        />
        {(clearable || focused) && !!text && (
          <Pressable onPress={() => { latest.current = ''; setText(''); onChange(undefined); }} hitSlop={8}>
            <Icon name="close-circle" size={17} color={t.textFaint} />
          </Pressable>
        )}
      </View>
      {focused && (suggestions.length > 0 || (!!text.trim() && !exact)) && (
        <View style={[{ marginTop: box ? 6 : 0, overflow: 'hidden' }, box ? { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.surface } : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
          {!!text.trim() && !exact && (
            <Suggestion label={`Use “${tidyPlace(text)}”`} sub="Your own location" icon="create-outline" onPress={() => commit(text)} />
          )}
          {suggestions.map((p) => (
            <Suggestion key={p.name} label={p.name} sub={p.region} icon={p.region === 'Recent' ? 'time-outline' : 'location-outline'} onPress={() => commit(p.name)} />
          ))}
        </View>
      )}
    </View>
  );
}

function Suggestion({ label, sub, icon, onPress }: { label: string; sub: string; icon: any; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
      <Icon name={icon} size={16} color={t.textDim} />
      <View style={{ flex: 1 }}>
        <T size={15}>{label}</T>
        <T faint size={12}>{sub}</T>
      </View>
    </Pressable>
  );
}
