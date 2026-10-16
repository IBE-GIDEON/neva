import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { conditionById, VERIFICATIONS } from '@neva/core';
import type { Condition, Profile, VerificationLabel } from '@neva/core';
import { initials } from '@neva/core';
import { radius, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 22, color, style }: { name: IconName; size?: number; color?: string; style?: TextStyle }) => {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.text} style={style} />;
};

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  select: () => Haptics.selectionAsync().catch(() => {}),
};

/* ---------- Pressable with calm opacity feedback (layout styles apply to the pressable itself) ---------- */
export function Tap({ children, style, onPress, haptics, scaleTo: _scaleTo, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptics?: boolean; children?: ReactNode }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
      onPress={(e) => {
        if (haptics) haptic.light();
        onPress?.(e);
      }}>
      {children}
    </Pressable>
  );
}

/* ---------- Text ---------- */
export function T({ children, style, dim, faint, size = 15, weight, color, numberOfLines, center }: { children?: ReactNode; style?: StyleProp<TextStyle>; dim?: boolean; faint?: boolean; size?: number; weight?: TextStyle['fontWeight']; color?: string; numberOfLines?: number; center?: boolean }) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: color ?? (faint ? t.textFaint : dim ? t.textDim : t.text), fontSize: size, fontWeight: weight, textAlign: center ? 'center' : undefined, letterSpacing: size >= 20 ? -0.4 : size >= 16 ? -0.15 : 0 }, style]}>
      {children}
    </Text>
  );
}

/* ---------- Avatar ---------- */
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export function Avatar({ user, size = 48, ring, ringSeen, online, onPress }: { user?: Pick<Profile, 'displayName' | 'avatarColor' | 'avatarUri'>; size?: number; ring?: boolean; ringSeen?: boolean; online?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const name = user?.displayName ?? '?';
  const tone = t.avatarTones[Math.abs(hash(name)) % t.avatarTones.length]!;
  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: tone }}>
      {user?.avatarUri ? (
        <Image source={{ uri: user.avatarUri }} style={{ width: size, height: size }} cachePolicy="memory-disk" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600', fontSize: size * 0.36, letterSpacing: 0.3 }}>{initials(name)}</Text>
        </View>
      )}
    </View>
  );
  const gap = Math.max(2, Math.round(size * 0.045));
  const content = ring ? (
    ringSeen ? (
      <View style={{ padding: gap, borderRadius: size, borderWidth: 1.5, borderColor: t.borderStrong }}>{inner}</View>
    ) : (
      <LinearGradient colors={[...t.storyRing]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ padding: 2, borderRadius: size }}>
        <View style={{ padding: gap - 0.5, borderRadius: size, backgroundColor: t.bg }}>{inner}</View>
      </LinearGradient>
    )
  ) : (
    inner
  );
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      {content}
      {online && (
        <View style={{ position: 'absolute', right: ring ? 3 : 0, bottom: ring ? 3 : 0, width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26), borderRadius: size, backgroundColor: t.success, borderWidth: 2.5, borderColor: t.bg }} />
      )}
    </Pressable>
  );
}

/* ---------- Buttons & chips ---------- */
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, small }: { title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'inverse'; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.surface2, ghost: 'transparent', danger: t.danger, gradient: 'transparent', inverse: t.inverse }[variant];
  const fg = { primary: t.primaryText, secondary: t.text, ghost: t.primary, danger: '#fff', gradient: '#fff', inverse: t.inverseText }[variant];
  const h = small ? 34 : 50;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: small ? 14 : 20, height: h }}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13.5 : 15.5, letterSpacing: -0.1 }}>{title}</Text>
    </View>
  );
  return (
    <Tap onPress={disabled || loading ? undefined : onPress} haptics style={[{ borderRadius: small ? 10 : radius.md, overflow: 'hidden', backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}>
      {variant === 'gradient' ? (
        <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {body}
        </LinearGradient>
      ) : (
        body
      )}
    </Tap>
  );
}

/** Threads-style chip: neutral when idle, inverted when active. */
export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Tap onPress={onPress} haptics style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 32, borderRadius: 9, backgroundColor: active ? t.inverse : 'transparent', borderWidth: 1, borderColor: active ? t.inverse : t.borderStrong }}>
      {icon && <Icon name={icon} size={14} color={active ? t.inverseText : t.textDim} />}
      <Text style={{ color: active ? t.inverseText : t.text, fontWeight: '500', fontSize: 13.5 }}>{label}</Text>
    </Tap>
  );
}

export function IconButton({ name, onPress, color, size = 24, badge, style }: { name: IconName; onPress?: () => void; color?: string; size?: number; badge?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap onPress={onPress} scaleTo={0.88} style={[{ padding: 8 }, style]} hitSlop={6}>
      <Icon name={name} size={size} color={color} />
      {!!badge && <Badge count={badge} style={{ position: 'absolute', top: 3, right: 1 }} />}
    </Tap>
  );
}

export function Badge({ count, style, muted }: { count: number; style?: StyleProp<ViewStyle>; muted?: boolean }) {
  const t = useTheme();
  if (!count) return null;
  return (
    <View style={[{ minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: muted ? t.surface3 : t.primary, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: muted ? t.textDim : '#fff', fontSize: 11, fontWeight: '700' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/** Small brand mark: gradient rounded square with a speech glyph. */
export function BrandMark({ size = 30 }: { size?: number }) {
  const t = useTheme();
  return (
    <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="chatbubble" size={size * 0.52} color="#fff" />
    </LinearGradient>
  );
}

/* ---------- Header ---------- */
export function Header({ title, subtitle, back = true, right, large, transparent, onTitlePress, left, border }: { title?: string; subtitle?: string; back?: boolean; right?: ReactNode; large?: boolean; transparent?: boolean; onTitlePress?: () => void; left?: ReactNode; border?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: transparent ? 'transparent' : t.bg, borderBottomWidth: border ? StyleSheet.hairlineWidth : 0, borderBottomColor: t.border }}>
      <View style={{ height: large ? 58 : 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: back ? 4 : 16 }}>
        {back && <IconButton name="chevron-back" size={26} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        {left}
        <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={{ flex: 1, marginLeft: back ? 2 : 0 }}>
          {!!title && (
            <Text numberOfLines={1} style={{ color: t.text, fontSize: large ? 26 : 17, fontWeight: large ? '700' : '600', letterSpacing: large ? -0.6 : -0.2 }}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text numberOfLines={1} style={{ color: t.textDim, fontSize: 12.5, marginTop: 1 }}>
              {subtitle}
            </Text>
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
      </View>
    </View>
  );
}

/* ---------- Trust & condition ---------- */
export function ConditionBadge({ condition, small }: { condition: Condition; small?: boolean }) {
  const t = useTheme();
  const c = conditionById(condition);
  const dot = condition.startsWith('new') ? t.primary : condition === 'refurbished' ? t.blue : t.textDim;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: t.surface2, paddingHorizontal: small ? 7 : 9, paddingVertical: small ? 2.5 : 4, borderRadius: 6 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dot }} />
      <Text style={{ color: t.text, fontWeight: '500', fontSize: small ? 11 : 12.5 }}>{small ? c.short : c.label}</Text>
    </View>
  );
}

export function VerifiedTick({ user, size = 14 }: { user?: Profile; size?: number }) {
  const t = useTheme();
  if (!user?.verifications.includes('identity_checked')) return null;
  return <Ionicons name="checkmark-circle" size={size} color={t.primary} style={{ marginLeft: 3 }} />;
}

export function VerificationList({ labels }: { labels: VerificationLabel[] }) {
  const t = useTheme();
  if (!labels.length) return <T dim size={13}>No verification checks completed yet.</T>;
  return (
    <View style={{ gap: 14 }}>
      {labels.map((l) => (
        <View key={l} style={{ flexDirection: 'row', gap: 12 }}>
          <Icon name={VERIFICATIONS[l].icon as IconName} size={19} color={t.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <T weight="600" size={14.5}>{VERIFICATIONS[l].label}</T>
            <T dim size={13} style={{ lineHeight: 18 }}>{VERIFICATIONS[l].meaning} {VERIFICATIONS[l].notImplied}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- Misc ---------- */
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingVertical: 48, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={28} color={t.text} />
      </View>
      <T size={17} weight="600" center>{title}</T>
      {!!body && <T dim center size={14} style={{ lineHeight: 20 }}>{body}</T>}
      {action}
    </View>
  );
}

export function TypingDots({ color }: { color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 14 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={color ?? t.textDim} />
      ))}
    </View>
  );
}
function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1));
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 6.5, height: 6.5, borderRadius: 4, backgroundColor: color }, a]} />;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: inset }} />;
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        <T size={16} weight="600">{title}</T>
        {!!action && (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={{ color: t.primary, fontWeight: '500', fontSize: 14 }}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** Settings-style row: monochrome icon, no colored tiles. */
export function Row({ icon, label, value, onPress, danger, right, sub }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; right?: ReactNode; sub?: string; iconBg?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
      {icon && <Icon name={icon} size={21} color={danger ? t.danger : t.text} />}
      <View style={{ flex: 1 }}>
        <T size={15.5} color={danger ? t.danger : undefined}>{label}</T>
        {!!sub && <T dim size={12.5} style={{ marginTop: 2 }}>{sub}</T>}
      </View>
      {!!value && <T dim size={14}>{value}</T>}
      {right ?? (onPress && !danger ? <Icon name="chevron-forward" size={17} color={t.textFaint} /> : null)}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }, style]}>{children}</View>;
}

/** Notice: neutral info strip used for safety copy (no loud yellow). */
export function Notice({ icon = 'shield-checkmark-outline', children }: { icon?: IconName; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
      <Icon name={icon} size={17} color={t.textDim} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: t.textDim, fontSize: 12.5, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}
