/**
 * Neva design tokens — mature, near-monochrome surfaces with a single
 * purple→blue accent blend. Color is reserved for meaning (accent, state).
 */
const shared = {
  // accent blend
  violet: '#7C5CFF',
  indigo: '#5B5BF0',
  blue: '#3B82F6',
  accentGradient: ['#8B5CF6', '#6366F1', '#3B82F6'] as const,
  storyRing: ['#8B5CF6', '#6366F1', '#3B82F6'] as const,
  brandGradient: ['#8B5CF6', '#3B82F6'] as const,
  // state (muted)
  success: '#22A06B',
  danger: '#E5484D',
  warning: '#D9A23A',
  white: '#FFFFFF',
  black: '#000000',
  // avatar fills — muted violet/blue/slate family only
  avatarTones: ['#5B5BD6', '#3E63DD', '#6E56CF', '#4A5578', '#3A4A6B', '#5D4E8C', '#2F6FB0', '#4B4FA8'] as const,
};

export const palettes = {
  dark: {
    ...shared,
    mode: 'dark' as const,
    primary: '#7C7CFF',
    primaryText: '#FFFFFF',
    bg: '#000000',
    surface: '#0E0E11',
    surface2: '#18181C',
    surface3: '#232329',
    elevated: '#141418',
    border: '#1F1F25',
    borderStrong: '#2C2C33',
    text: '#F4F4F6',
    textDim: '#8E8E98',
    textFaint: '#5A5A63',
    chatBg: '#000000',
    bubbleIn: '#1C1C21',
    bubbleInText: '#F4F4F6',
    bubbleOutText: '#FFFFFF',
    tick: '#A5B4FC',
    overlay: 'rgba(0,0,0,0.65)',
    tabBar: '#000000',
    inverse: '#F4F4F6',
    inverseText: '#000000',
    info: '#7C9CFF',
  },
  light: {
    ...shared,
    mode: 'light' as const,
    primary: '#5B4BF5',
    primaryText: '#FFFFFF',
    bg: '#FFFFFF',
    surface: '#F7F7F8',
    surface2: '#F0F0F2',
    surface3: '#E4E4E8',
    elevated: '#FFFFFF',
    border: '#EAEAEE',
    borderStrong: '#D9D9DF',
    text: '#0B0B0F',
    textDim: '#6B6B76',
    textFaint: '#A1A1AA',
    chatBg: '#FFFFFF',
    bubbleIn: '#F0F0F2',
    bubbleInText: '#0B0B0F',
    bubbleOutText: '#FFFFFF',
    tick: '#E0E7FF',
    overlay: 'rgba(0,0,0,0.4)',
    tabBar: '#FFFFFF',
    inverse: '#0B0B0F',
    inverseText: '#FFFFFF',
    info: '#4F6BED',
  },
};

export type Palette = typeof palettes.dark;


export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = (n: number) => n * 4;

export const type = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12.5, fontWeight: '400' as const },
};
