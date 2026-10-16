import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Avatar, Button, Header, Icon, T } from '@/components/ui';
import { LocationField } from '@/components/LocationField';
import { showToast, useStore } from '@/store';
import { radius, useTheme } from '@/theme';

const RESERVED = ['admin', 'neva', 'support', 'moderator', 'help', 'official'];

export default function EditProfile() {
  const t = useTheme();
  const me = useStore((s) => s.users[s.meId])!;
  const updateProfile = useStore((s) => s.updateProfile);
  const users = useStore((s) => s.users);
  const [name, setName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio ?? '');
  const [shop, setShop] = useState(me.shopName ?? '');
  const [city, setCity] = useState(me.city);
  const [avatarUri, setAvatarUri] = useState(me.avatarUri);
  const [coverUri, setCoverUri] = useState(me.coverUri);
  // Once set, the unsaved-changes guard is lifted and the pending navigation runs (null = plain back).
  const [leaving, setLeaving] = useState<{ action: any } | null>(null);
  const navigation = useNavigation();

  const usernameError = useMemo(() => {
    if (!username) return 'Choose a username';
    if (!/^[a-z0-9._]{3,20}$/.test(username)) return '3–20 characters: letters, numbers, . and _';
    if (RESERVED.includes(username)) return 'That username is reserved';
    if (Object.values(users).some((u) => u.id !== me.id && u.username === username)) return 'Username taken';
    return '';
  }, [username, users, me.id]);
  const nameError = name.trim().length < 2 ? 'At least 2 characters' : '';
  const cityError = city.trim().length < 2 ? 'Add your city' : '';
  const valid = !usernameError && !nameError && !cityError;

  const dirty =
    name.trim() !== me.displayName ||
    username !== me.username ||
    bio.trim() !== (me.bio ?? '') ||
    shop.trim() !== (me.shopName ?? '') ||
    city !== me.city ||
    avatarUri !== me.avatarUri ||
    coverUri !== me.coverUri;

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert('Discard changes?', 'You have unsaved changes to your profile.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setLeaving({ action: data.action }) },
    ]);
  });

  useEffect(() => {
    if (!leaving) return;
    if (leaving.action) navigation.dispatch(leaving.action);
    else router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const pickCover = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.75 });
    if (!r.canceled) setCoverUri(r.assets[0]!.uri);
  };

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled) setAvatarUri(r.assets[0]!.uri);
  };

  const save = () => {
    if (!valid || !dirty) return;
    updateProfile({ displayName: name.trim(), username, bio: bio.trim(), shopName: shop.trim() || undefined, city: city.trim(), avatarUri, coverUri });
    showToast('Profile updated');
    setLeaving({ action: null });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Edit profile" right={<Button small title="Save" onPress={save} disabled={!dirty || !valid} style={{ marginRight: 8 }} />} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <Pressable onPress={pickCover} style={{ height: 150, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
            ) : (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Icon name="image-outline" size={26} color={t.textDim} />
                <T dim size={13}>Add a cover photo</T>
              </View>
            )}
            <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, height: 30, borderRadius: 8 }}>
              <Icon name="camera-outline" size={14} color="#fff" />
              <T size={12} weight="500" color="#fff">{coverUri ? 'Change cover' : 'Upload'}</T>
            </View>
          </Pressable>
          {!!coverUri && (
            <Pressable onPress={() => setCoverUri(undefined)} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              <T size={12.5} color={t.danger}>Remove cover</T>
            </Pressable>
          )}
        </View>
        <Pressable onPress={pick} style={{ alignSelf: 'center', marginTop: -60, borderRadius: 60, borderWidth: 4, borderColor: t.bg }}>
          {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: 110, height: 110, borderRadius: 55 }} /> : <Avatar user={me} size={110} />}
          <View style={{ position: 'absolute', right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: t.bg }}>
            <Icon name="camera" size={16} color={t.primaryText} />
          </View>
        </Pressable>
        {!!avatarUri && (
          <Pressable onPress={() => setAvatarUri(undefined)} hitSlop={8} style={{ alignSelf: 'center', marginTop: -6 }}>
            <T size={12.5} color={t.danger}>Remove photo</T>
          </Pressable>
        )}
        <Field label="Display name" value={name} onChange={setName} error={nameError} />
        <Field
          label="Username"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase().replace(/[\s@]/g, ''))}
          prefix="@"
          error={username !== me.username ? usernameError : ''}
          hint={username !== me.username && !usernameError ? 'Available' : undefined}
        />
        <Field label="Shop name (shown on your listings)" value={shop} onChange={setShop} placeholder="Optional" />
        <Field label="Bio" value={bio} onChange={setBio} multiline placeholder="What do you sell? Where do you meet buyers?" />
        <T dim size={13} weight="600">City</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LocationField value={city} onChange={(v) => setCity(v ?? '')} placeholder="Your city or area" />
        </View>
        {!!cityError && <T size={12.5} color={t.danger} style={{ marginTop: -8 }}>{cityError}</T>}
        <T faint size={12} style={{ lineHeight: 17 }}>People can find you by your @username. Your email is private and never shown.</T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, multiline, placeholder, prefix, error, hint }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; prefix?: string; error?: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T dim size={13} weight="600">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', backgroundColor: t.surface2, borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1.5, borderColor: error ? t.danger : 'transparent' }}>
        {!!prefix && <T dim size={16}>{prefix}</T>}
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={t.textFaint}
          autoCapitalize={prefix ? 'none' : 'sentences'}
          autoCorrect={!prefix}
          style={{ flex: 1, paddingVertical: 13, color: t.text, fontSize: 16, minHeight: multiline ? 100 : 50, textAlignVertical: multiline ? 'top' : 'center', marginLeft: prefix ? 2 : 0 }}
        />
      </View>
      {!!error && <T size={12.5} color={t.danger}>{error}</T>}
      {!error && !!hint && <T size={12.5} dim>{hint}</T>}
    </View>
  );
}
