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
            <Stack.Screen name="story/[userId]" options={{ animation: 'fade', presentation: 'transparentModal', contentStyle: { backgroundColor: '#000' } }} />
            <Stack.Screen name="status-new" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="sell-new" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="report" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="review" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="filters" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          </Stack>
          <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
