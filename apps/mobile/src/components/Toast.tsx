import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { FadeIn, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLive } from '@/store';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './ui';

export function ToastHost() {
  const toast = useLive((s) => s.toast);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useLive.setState({ toast: null }), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeIn}
      exiting={FadeOutUp}
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.mode === 'dark' ? '#1C1C21' : '#0B0B0F', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, maxWidth: '90%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
      <Icon name={(toast.icon as IconName) ?? 'checkmark-circle'} size={18} color={t.primary} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{toast.text}</Text>
    </Animated.View>
  );
}
