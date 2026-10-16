import { router } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';

import { Card, Chip, Divider, Header, Row, T } from '@/components/ui';
import { signOutRemote } from '@/lib/auth';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

export default function Settings() {
  const t = useTheme();
  const settings = useStore((s) => s.settings);
  const email = useStore((s) => s.auth.email);
  const provider = useStore((s) => s.auth.provider);
  const { updateSettings, signOut, clearDeviceData } = useStore.getState();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}>
        <Card>
          <Row icon="person-outline" label="Account" sub={provider === 'google' ? `Signed in with Google${email ? ` · ${email}` : ''}` : `Signed in as ${email ?? 'email'} (private)`} onPress={() => router.push('/edit-profile')} />
          <Divider inset={64} />
          <Row icon="lock-closed-outline" label="Privacy" sub="Last seen, read receipts, status audience" onPress={() => router.push('/settings/privacy')} />
          <Divider inset={64} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
          <Divider inset={64} />
          <Row icon="ban-outline" label="Blocked accounts" onPress={() => router.push('/settings/blocked')} />
          <Divider inset={64} />
          <Row icon="shield-checkmark-outline" label="Safety center" onPress={() => router.push('/settings/safety')} />
        </Card>

        <View style={{ gap: 8 }}>
          <T dim size={13} weight="600" style={{ marginLeft: 4 }}>APPEARANCE</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['system', 'dark', 'light'] as const).map((m) => (
              <Chip key={m} label={m === 'system' ? 'Match system' : m === 'dark' ? 'Dark' : 'Light'} icon={m === 'dark' ? 'moon' : m === 'light' ? 'sunny' : 'phone-portrait'} active={settings.theme === m} onPress={() => updateSettings({ theme: m })} />
            ))}
          </View>
        </View>

        <Card>
          <Row icon="document-text-outline" label="Terms of service" onPress={() => Alert.alert('Terms', 'Publish your Terms of Service before launch (blueprint Appendix B).')} />
          <Divider inset={64} />
          <Row icon="finger-print-outline" label="Privacy policy" onPress={() => Alert.alert('Privacy policy', 'Publish your privacy policy (NDPA-aligned) before launch.')} />
          <Divider inset={64} />
          <Row icon="people-outline" label="Community rules & prohibited items" onPress={() => router.push('/settings/safety')} />
          <Divider inset={64} />
          <Row icon="help-circle-outline" label="Help & support" onPress={() => Alert.alert('Support', 'Connect a support inbox (e.g. support@yourdomain) before launch.')} />
        </Card>

        <Card>
          <Row icon="download-outline" label="Request my data" onPress={() => Alert.alert('Data request received', 'We’ll prepare an export of your account data.')} />
          <Divider inset={64} />
          <Row icon="refresh-outline" label="Clear data on this device" sub="Removes everything stored locally and signs you out" onPress={() => Alert.alert('Clear this device?', 'This removes all data stored on this device and signs you out.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => { clearDeviceData(); router.replace('/'); } }])} />
          <Divider inset={64} />
          <Row icon="log-out-outline" label="Sign out" danger onPress={() => Alert.alert('Sign out?', 'You can sign back in any time with the same account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { signOutRemote(); signOut(); router.replace('/'); } }])} />
          <Divider inset={64} />
          <Row icon="trash-outline" label="Delete account" danger onPress={() => Alert.alert('Delete account?', 'Your profile and listings will be removed. Some records may be kept where the law requires.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { clearDeviceData(); router.replace('/'); } }])} />
        </Card>
        <T faint size={11.5} center>Data is stored on this device until the server is connected.</T>
      </ScrollView>
    </View>
  );
}
