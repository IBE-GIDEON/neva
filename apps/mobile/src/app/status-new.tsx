import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, Icon, IconButton } from '@/components/ui';
import { STATUS_BGS } from '@neva/core';
import { formatNaira } from '@neva/core';
import { showToast, useStore } from '@/store';

export default function NewStatus() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const meId = useStore((s) => s.meId);
  const myListings = useStore(useShallow((s) => Object.values(s.listings).filter((l) => l.sellerId === s.meId && l.status === 'active')));
  const privacy = useStore((s) => s.settings.statusPrivacy);
  const addStory = useStore((s) => s.addStory);
  const [imageUri, setImageUri] = useState<string>();
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [bg, setBg] = useState(0);
  const [listingId, setListingId] = useState<string>();
  const [isText, setIsText] = useState(mode === 'text');

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showToast('Permission needed', 'alert-circle');
    const r = camera ? await ImagePicker.launchCameraAsync({ quality: 0.7, aspect: [9, 16] }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) {
      setImageUri(r.assets[0]!.uri);
      setIsText(false);
    }
  };

  useEffect(() => {
    if (mode !== 'text') pick(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canPost = isText ? text.trim().length > 0 : !!imageUri;
  const post = () => {
    if (!canPost) return;
    addStory(isText ? { text: text.trim(), bg: STATUS_BGS[bg], listingId } : { imageUri, caption: caption.trim() || undefined, listingId });
    haptic.success();
    showToast('Status posted · visible for 24h', 'aperture');
    router.back();
  };
  const linked = myListings.find((l) => l.id === listingId);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: isText ? STATUS_BGS[bg] : '#000' }}>
      {!isText && imageUri && <Image source={{ uri: imageUri }} style={{ position: 'absolute', inset: 0 } as any} contentFit="contain" />}
      <View style={{ paddingTop: insets.top + 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
        <IconButton name="close" color="#fff" size={28} onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        {isText ? (
          <IconButton name="color-palette" color="#fff" onPress={() => { haptic.select(); setBg((bg + 1) % STATUS_BGS.length); }} />
        ) : null}
        <IconButton name={isText ? 'image' : 'text'} color="#fff" onPress={() => (isText ? pick(false) : setIsText(true))} />
        <IconButton name="camera" color="#fff" onPress={() => pick(true)} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        {isText ? (
          <TextInput autoFocus value={text} onChangeText={setText} placeholder="Type a status" placeholderTextColor="rgba(255,255,255,0.6)" multiline maxLength={240} style={{ color: '#fff', fontSize: 32, fontWeight: '700', textAlign: 'center' }} />
        ) : !imageUri ? (
          <Pressable onPress={() => pick(false)} style={{ alignItems: 'center', gap: 10 }}>
            <Icon name="images-outline" size={54} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Pick a photo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingBottom: insets.bottom + 10, gap: 10 }}>
        {myListings.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {myListings.map((l) => {
              const on = l.id === listingId;
              return (
                <Pressable key={l.id} onPress={() => setListingId(on ? undefined : l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 6, paddingRight: 12 }}>
                  <Image source={{ uri: l.images[0] }} style={{ width: 34, height: 34, borderRadius: 8 }} />
                  <View>
                    <Text numberOfLines={1} style={{ color: on ? '#000' : '#fff', fontWeight: '700', fontSize: 12, maxWidth: 130 }}>{l.title}</Text>
                    <Text style={{ color: on ? '#4F46E5' : '#fff', fontWeight: '700', fontSize: 12 }}>{formatNaira(l.priceMinor)}</Text>
                  </View>
                  {on && <Icon name="checkmark-circle" size={18} color="#4F46E5" />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {linked && <Animated.Text entering={FadeIn} style={{ color: '#fff', textAlign: 'center', fontSize: 12 }}>Viewers can swipe up to open “{linked.title}”</Animated.Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }}>
          {!isText && (
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24, paddingHorizontal: 16, height: 48, justifyContent: 'center' }}>
              <TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption…" placeholderTextColor="rgba(255,255,255,0.6)" style={{ color: '#fff', fontSize: 16 }} />
            </View>
          )}
          {isText && (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignSelf: 'flex-start' }}>
              <Icon name="people" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '600' }}>Status: {privacy === 'everyone' ? 'Everyone' : privacy === 'followers' ? 'My followers' : 'Nobody'}</Text>
            </View>
          )}
          <Pressable onPress={post} disabled={!canPost} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: canPost ? '#5B5BF0' : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={22} color="#fff" />
          </Pressable>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' }}>{meId ? 'Disappears after 24 hours' : ''}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}
