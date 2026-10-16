import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Chip, Header, Icon, T } from '@/components/ui';
import { LocationField } from '@/components/LocationField';
import { signOutRemote } from '@/lib/auth';
import { useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const RESERVED = ['admin', 'neva', 'support', 'moderator', 'help', 'official'];

export default function ProfileSetup() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const users = useStore((s) => s.users);
  const completeProfile = useStore((s) => s.completeProfile);
  const prefill = useStore((s) => s.auth.prefill);
  const [name, setName] = useState(prefill?.displayName ?? '');
  const [username, setUsername] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(prefill?.avatarUri);

  const usernameError = useMemo(() => {
    if (!username) return '';
    if (!/^[a-z0-9._]{3,20}$/.test(username)) return '3–20 characters: letters, numbers, . and _';
    if (RESERVED.includes(username)) return 'That username is reserved';
    if (Object.values(users).some((u) => u.username === username)) return 'Username taken';
    return '';
  }, [username, users]);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled) setAvatarUri(r.assets[0]!.uri);
  };

  const valid = name.trim().length >= 2 && username.length >= 3 && !usernameError && city.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header back={false} title="Set up your profile" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pick} style={{ alignSelf: 'center' }}>
          {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: 110, height: 110, borderRadius: 55 }} /> : <Avatar user={{ displayName: name || '?', avatarColor: t.indigo }} size={110} />}
          <View style={{ position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: t.bg }}>
            <Icon name="camera" size={16} color={t.primaryText} />
          </View>
        </Pressable>
        <Field label="Display name" value={name} onChange={setName} placeholder="e.g. Emeka D." />
        <Field label="Username" value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))} placeholder="emeka.d" prefix="@" error={usernameError} />
        <View style={{ gap: 8 }}>
          <T dim size={13} weight="600">City (we only show your city, never your address)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LocationField value={city} onChange={(v) => setCity(v ?? '')} placeholder="Your city or area" />
          </View>
        </View>
      </ScrollView>
      <View style={{ padding: 24, paddingBottom: insets.bottom + 16 }}>
        <Button
          title="Continue"
          disabled={!valid}
          onPress={() => {
            completeProfile({ displayName: name.trim(), username, city, avatarUri });
            router.replace('/(auth)/interests');
          }}
        />
        <Pressable
          hitSlop={8}
          onPress={() => {
            signOutRemote();
            useStore.getState().signOut();
            // The (auth) group has no reactive gating, so navigate explicitly back to welcome.
            router.replace('/(auth)/welcome');
          }}
          style={{ alignSelf: 'center', marginTop: 14 }}
        >
          <T dim size={13.5}>Use a different account</T>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, prefix, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; error?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T dim size={13} weight="600">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface2, borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: error ? t.danger : 'transparent' }}>
        {!!prefix && <T dim size={17}>{prefix}</T>}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.textFaint} autoCapitalize={prefix ? 'none' : 'words'} style={{ flex: 1, height: 52, color: t.text, fontSize: 17, marginLeft: prefix ? 2 : 0 }} />
      </View>
      {!!error && <T size={12.5} color={t.danger}>{error}</T>}
    </View>
  );
}
