import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LaunchScreen } from '@/components/LaunchScreen';
import { ToastHost } from '@/components/Toast';
import { startSync } from '@/lib/sync';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Screens that should never be open twice at once (double taps open them once). */
const SINGLE_SCREENS = ['archived', 'edit-profile', 'new-chat', 'notifications', 'reports', 'saved', 'search', 'starred', 'settings/index', 'settings/blocked', 'settings/notifications', 'settings/privacy', 'settings/safety'];
/** Singular per route param, e.g. one chat screen per conversation id. */
const byParam = (key: string) => (_name: string, params: Record<string, unknown>) => (params[key] == null ? undefined : String(params[key]));

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated) startSync();
  }, [hydrated]);
  const t = useTheme();

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: hydrated ? t.bg : '#000' }}>
        {hydrated && <App />}
        <LaunchScreen ready={hydrated} />
      </View>
    </SafeAreaProvider>
  );
}

function App() {
  const t = useTheme();
  const navTheme = t.mode === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: t.bg, card: t.bg, text: t.text, border: t.border, primary: t.primary } }}>
          <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: t.bg } }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            {/* One screen per item, no matter how fast it's tapped: re-opening the same chat/listing/shop/status
                reuses the open screen instead of stacking a copy. */}
            <Stack.Screen name="chat/[id]" dangerouslySingular={byParam('id')} />
            <Stack.Screen name="listing/[id]" dangerouslySingular={byParam('id')} />
            <Stack.Screen name="seller/[id]" dangerouslySingular={byParam('id')} />
            <Stack.Screen name="story/[userId]" dangerouslySingular={byParam('userId')} options={{ animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="status-new" dangerouslySingular options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="sell-new" dangerouslySingular options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="report" dangerouslySingular options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="review" dangerouslySingular options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="filters" dangerouslySingular options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            {SINGLE_SCREENS.map((name) => (
              <Stack.Screen key={name} name={name} dangerouslySingular />
            ))}
          </Stack>
          <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
