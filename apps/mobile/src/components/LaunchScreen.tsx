import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MIN_VISIBLE_MS = 900;

/**
 * In-app twin of the native splash (black + white chat mark). It takes over from the native
 * splash the moment JS is ready, stays until data has loaded, then fades into the app.
 */
export function LaunchScreen({ ready }: { ready: boolean }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(true);
  const [minDone, setMinDone] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const id = setTimeout(() => setMinDone(true), MIN_VISIBLE_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (ready && minDone) {
      opacity.value = withTiming(0, { duration: 260 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [ready, minDone, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!mounted) return null;

  return (
    <Animated.View pointerEvents={ready && minDone ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 999 }, style]}>
      <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 150, height: 150 }} contentFit="contain" />
      <Image source={require('@/assets/images/wordmark.png')} style={{ position: 'absolute', bottom: insets.bottom + 36, width: 104, height: 35 }} contentFit="contain" />
    </Animated.View>
  );
}
