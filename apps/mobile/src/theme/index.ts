import { useColorScheme } from 'react-native';

import { type Palette, palettes } from '@neva/core';

import { useStore } from '@/store';

export { palettes, radius, space, type } from '@neva/core';
export type { Palette } from '@neva/core';

export function useTheme(): Palette {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  const mode = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
  return palettes[mode] as Palette;
}
