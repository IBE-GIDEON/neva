import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { features } from '@/config';
import { signInWithGoogle } from '@/lib/auth';
import { showToast } from '@/store';

/** Minimal, premium entry: the mark, one line, one action. Continues seamlessly from the splash. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* faint accent glow behind the mark */}
      <LinearGradient colors={['transparent', 'rgba(99,102,241,0.14)', 'transparent']} locations={[0.2, 0.5, 0.8]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 150, height: 150 }} contentFit="contain" />
        <Animated.View entering={FadeIn.duration(400).delay(150)} style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600', letterSpacing: -0.4, textAlign: 'center' }}>Buy and sell in conversation.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.duration(400).delay(250)} style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 18, gap: 16 }}>
        <Button title="Create account" variant="gradient" onPress={() => router.push({ pathname: '/(auth)/email', params: { mode: 'signup' } })} />
        <Button title="Log in" variant="secondary" onPress={() => router.push({ pathname: '/(auth)/email', params: { mode: 'login' } })} />
        {features.googleSignIn && (
          <Button
            title="Continue with Google"
            variant="secondary"
            icon="logo-google"
            onPress={async () => {
              const res = await signInWithGoogle();
              if (res.ok) router.replace('/');
              else if (res.error) showToast(res.error, 'alert-circle-outline');
            }}
          />
        )}
        <Text style={{ color: '#5A5A63', fontSize: 11.5, textAlign: 'center', lineHeight: 16 }}>By continuing you agree to the Terms and Privacy Policy.</Text>
        <Image source={require('@/assets/images/wordmark.png')} style={{ width: 72, height: 24, alignSelf: 'center' }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
