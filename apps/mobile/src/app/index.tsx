import { Redirect } from 'expo-router';

import { useStore } from '@/store';

export default function Index() {
  const stage = useStore((s) => s.auth.stage);
  if (stage === 'ready') return <Redirect href="/(tabs)/chats" />;
  if (stage === 'profile') return <Redirect href="/(auth)/profile-setup" />;
  if (stage === 'interests') return <Redirect href="/(auth)/interests" />;
  return <Redirect href="/(auth)/welcome" />;
}
