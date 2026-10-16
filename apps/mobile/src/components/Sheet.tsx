import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';
import { Icon, type IconName } from './ui';

export type SheetAction = { label: string; icon?: IconName; danger?: boolean; onPress: () => void };

/** Bottom sheet. Pass `actions` for an action menu or `children` for custom content. */
export function Sheet({ visible, onClose, title, actions, children, header }: { visible: boolean; onClose: () => void; title?: string; actions?: SheetAction[]; children?: ReactNode; header?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(600);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      fade.value = withTiming(1, { duration: 200 });
    } else if (mounted) {
      fade.value = withTiming(0, { duration: 180 });
      y.value = withTiming(600, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, y, fade]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} animationType="none">
      <Animated.View style={[{ flex: 1, backgroundColor: t.overlay }, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 10, maxHeight: '88%' }, sheetStyle]}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.surface3 }} />
        </View>
        {header}
        {!!title && <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 8 }}>{title}</Text>}
        {actions?.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              onClose();
              setTimeout(a.onPress, 220);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22, paddingVertical: 15, backgroundColor: pressed ? t.surface2 : 'transparent' })}>
            {a.icon && <Icon name={a.icon} size={22} color={a.danger ? t.danger : t.textDim} />}
            <Text style={{ color: a.danger ? t.danger : t.text, fontSize: 16, fontWeight: '500' }}>{a.label}</Text>
          </Pressable>
        ))}
        {children}
      </Animated.View>
    </Modal>
  );
}
