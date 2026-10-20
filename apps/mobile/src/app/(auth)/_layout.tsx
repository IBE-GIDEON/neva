import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const t = useTheme();
  const stage = useStore((s) => s.auth.stage);
  // The server can finish sign-in after these screens are shown (e.g. an account already set up on the
  // website loads its profile a moment after login). Follow the auth stage so nobody is asked twice.
  useEffect(() => {
    if (stage === 'ready') router.replace('/(tabs)/chats');
  }, [stage]);
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: t.bg } }} />;
}
