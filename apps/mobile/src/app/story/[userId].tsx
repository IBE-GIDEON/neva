import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/Sheet';
import { Avatar, haptic, Icon, VerifiedTick } from '@/components/ui';
import { formatNaira, timeAgo } from '@neva/core';
import { isStoryLive, showToast, useStore } from '@/store';

const { height: H } = Dimensions.get('window');
const DURATION = 5500;
const REACTIONS = ['😍', '🔥', '😂', '😮', '👏🏽', '💯'];

export default function StoryViewer() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const allStories = useStore((s) => s.stories);
  const users = useStore((s) => s.users);
  const listings = useStore((s) => s.listings);
  const viewed = useStore((s) => s.viewedStories);
  const meId = useStore((s) => s.meId);
  const { markStoryViewed, startConversation, sendMessage, deleteStory } = useStore.getState();

  // ordered list of users with live stories (unseen first), starting at userId
  const queue = useMemo(() => {
    const ids = Array.from(new Set(allStories.filter((s) => isStoryLive(s)).map((s) => s.userId)));
    if (userId === meId) return [meId];
    const others = ids.filter((id) => id !== meId);
    const unseen = (id: string) => allStories.some((s) => s.userId === id && isStoryLive(s) && !viewed.includes(s.id));
    const sorted = others.sort((a, b) => Number(unseen(b)) - Number(unseen(a)));
    const start = sorted.indexOf(userId);
    return start >= 0 ? sorted.slice(start).concat(sorted.slice(0, start)) : [userId];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [uIndex, setUIndex] = useState(0);
  const currentUser = queue[uIndex]!;
  const stories = useMemo(() => allStories.filter((s) => s.userId === currentUser && isStoryLive(s)).sort((a, b) => a.createdAt - b.createdAt), [allStories, currentUser]);
  const [sIndex, setSIndex] = useState(() => {
    const first = stories.findIndex((s) => !viewed.includes(s.id));
    return first >= 0 ? first : 0;
  });
  const story = stories[sIndex];
  const user = users[currentUser];
  const listing = story?.listingId ? listings[story.listingId] : undefined;
  const isMine = currentUser === meId;

  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);

  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const remaining = useRef(DURATION);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/updates'));

  const next = () => {
    if (sIndex < stories.length - 1) setSIndex(sIndex + 1);
    else if (uIndex < queue.length - 1) {
      setUIndex(uIndex + 1);
      setSIndex(0);
    } else close();
  };
  const prev = () => {
    if (sIndex > 0) setSIndex(sIndex - 1);
    else if (uIndex > 0) {
      setUIndex(uIndex - 1);
      setSIndex(0);
    } else {
      progress.value = 0;
      start(DURATION);
    }
  };

  const start = (ms: number) => {
    progress.value = withTiming(1, { duration: ms, easing: Easing.linear }, (done) => {
      if (done) runOnJS(next)();
    });
  };

  useEffect(() => {
    if (!story) {
      close();
      return;
    }
    markStoryViewed(story.id);
    progress.value = 0;
    remaining.current = DURATION;
    start(DURATION);
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Preload the next status image so tapping forward is instant
  useEffect(() => {
    const nextStory = stories[sIndex + 1];
    if (nextStory?.imageUri) Image.prefetch(nextStory.imageUri).catch(() => {});
  }, [stories, sIndex]);

  const isHeld = paused || typing || menu || confirming;
  useEffect(() => {
    if (!story) return;
    if (isHeld) {
      cancelAnimation(progress);
      remaining.current = (1 - progress.value) * DURATION;
    } else if (progress.value > 0 && progress.value < 1) {
      start(remaining.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHeld]);

  const confirmDelete = (storyId: string) => {
    setConfirming(true);
    Alert.alert('Delete this status?', 'It will be removed for everyone who can see it.', [
      { text: 'Cancel', style: 'cancel', onPress: () => setConfirming(false) },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteStory(storyId); showToast('Status deleted', 'trash'); close(); } },
    ], { cancelable: true, onDismiss: () => setConfirming(false) });
  };

  const sendReply = (body: string, emoji?: string) => {
    if (!story || isMine) return;
    const cid = startConversation(currentUser, story.listingId);
    sendMessage(cid, { type: 'story_reply', body, storyImage: story.imageUri });
    haptic.success();
    if (emoji) {
      setBurst(emoji);
      setTimeout(() => setBurst(null), 900);
    } else showToast('Reply sent', 'paper-plane');
    setReply('');
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) dragY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 120) runOnJS(close)();
      else if (e.translationY < -80 && listing) runOnJS(router.push)(`/listing/${listing.id}` as any);
      dragY.value = withTiming(0, { duration: 180 });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  // Hold to pause: hide every overlay so only the status itself is visible
  const ui = useSharedValue(1);
  useEffect(() => {
    ui.value = withTiming(paused ? 0 : 1, { duration: 180 });
  }, [paused, ui]);
  const uiStyle = useAnimatedStyle(() => ({ opacity: ui.value }));

  if (!story || !user) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }, dragStyle]}>
        <Animated.View key={story.id} entering={FadeIn.duration(220)} style={{ position: 'absolute', inset: 0 } as any}>
          {story.imageUri ? (
            <Image source={{ uri: story.imageUri }} style={{ flex: 1 }} contentFit="cover" />
          ) : (
            <LinearGradient colors={[story.bg ?? '#312E81', '#000000']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', textAlign: 'center', lineHeight: 40 }}>{story.text}</Text>
            </LinearGradient>
          )}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, uiStyle]}>
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 280 }} />
        </Animated.View>

        {/* tap zones */}
        <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' } as any}>
          <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={180} />
          <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={180} />
        </View>

        {/* progress + header */}
        <Animated.View style={[{ position: 'absolute', top: insets.top + 6, left: 8, right: 8 }, uiStyle]} pointerEvents={paused ? 'none' : 'box-none'}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {stories.map((s, i) => (
              <ProgressBar key={s.id} state={i < sIndex ? 'done' : i === sIndex ? 'active' : 'todo'} progress={progress} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Avatar user={user} size={38} onPress={() => !isMine && router.push(`/seller/${user.id}`)} />
            <Pressable onPress={() => !isMine && router.push(`/seller/${user.id}`)} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{isMine ? 'My status' : user.displayName}</Text>
                <VerifiedTick user={user} size={14} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{timeAgo(story.createdAt)}</Text>
            </Pressable>
            <Pressable onPress={() => setMenu(true)} hitSlop={10} style={{ padding: 6 }}>
              <Icon name="ellipsis-vertical" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={close} hitSlop={10} style={{ padding: 6 }}>
              <Icon name="close" size={28} color="#fff" />
            </Pressable>
          </View>
        </Animated.View>

        {typing && <Animated.View entering={FadeIn.duration(150)} pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as any} />}
        {/* caption + listing + reply */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          <Animated.View style={[{ paddingHorizontal: 14, paddingBottom: insets.bottom + 10, gap: 12 }, uiStyle]} pointerEvents={paused ? 'none' : 'box-none'}>
            {!!story.caption && <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 }}>{story.caption}</Text>}
            {listing && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Pressable onPress={() => router.push(`/listing/${listing.id}`)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={180} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 8, paddingRight: 14 }}>
                  <Image source={{ uri: listing.images[0] }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                  <View style={{ maxWidth: 200 }}>
                    <Text numberOfLines={1} style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{listing.title}</Text>
                    <Text style={{ color: '#4F46E5', fontWeight: '700', fontSize: 15 }}>{formatNaira(listing.priceMinor)}</Text>
                  </View>
                  <Icon name="chevron-up" size={18} color="#000" />
                </Pressable>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>Swipe up to view item</Text>
              </Animated.View>
            )}
            {isMine ? (
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Icon name="eye" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>{story.viewers ?? 0} views</Text>
              </View>
            ) : (
              <>
                {!typing && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                    {REACTIONS.map((e) => (
                      <Pressable key={e} onPress={() => sendReply(e, e)} hitSlop={4}>
                        <Text style={{ fontSize: 28 }}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 25, paddingHorizontal: 18, height: 50 }}>
                    <TextInput
                      value={reply}
                      onChangeText={setReply}
                      keyboardAppearance="dark"
                      onFocus={() => setTyping(true)}
                      onBlur={() => setTyping(false)}
                      placeholder={listing ? 'Ask about this item…' : `Reply to ${user.displayName.split(' ')[0]}…`}
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      style={{ flex: 1, color: '#fff', fontSize: 16 }}
                      returnKeyType="send"
                      onSubmitEditing={() => reply.trim() && sendReply(reply.trim())}
                    />
                  </View>
                  <Pressable onPress={() => reply.trim() && sendReply(reply.trim())} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: reply.trim() ? '#5B5BF0' : '#1C1C1E', borderWidth: reply.trim() ? 0 : 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="send" size={20} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>

        {burst && (
          <Animated.View entering={FadeIn} pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any}>
            <Text style={{ fontSize: 120 }}>{burst}</Text>
          </Animated.View>
        )}

        <Sheet
          visible={menu}
          onClose={() => setMenu(false)}
          actions={
            isMine
              ? [{ label: 'Delete status', icon: 'trash-outline', danger: true, onPress: () => confirmDelete(story.id) }]
              : [
                  { label: 'View shop', icon: 'storefront-outline', onPress: () => router.push(`/seller/${user.id}`) },
                  { label: 'Message', icon: 'chatbubble-outline', onPress: () => router.push(`/chat/${startConversation(user.id, story.listingId)}`) },
                  { label: 'Report status', icon: 'flag-outline', danger: true, onPress: () => router.push({ pathname: '/report', params: { type: 'story', target: story.id, name: user.displayName } }) },
                ]
          }
        />
      </Animated.View>
    </GestureDetector>
  );
}

function ProgressBar({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: { value: number } }) {
  const a = useAnimatedStyle(() => ({ width: `${(state === 'done' ? 1 : state === 'active' ? progress.value : 0) * 100}%` }));
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
      <Animated.View style={[{ height: 3, backgroundColor: '#fff' }, a]} />
    </View>
  );
}
