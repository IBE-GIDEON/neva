import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Ticks } from '@/components/ChatRow';
import { haptic, Icon, T, TypingDots } from '@/components/ui';
import type { Message } from '@neva/core';
import { clockTime, formatNaira } from '@neva/core';
import { useStore } from '@/store';
import { useTheme } from '@/theme';

type Props = {
  m: Message;
  mine: boolean;
  firstInGroup: boolean;
  lastInGroup: boolean;
  onLongPress: (m: Message) => void;
  onReply: (m: Message) => void;
  onRetry: (m: Message) => void;
  onOffer: (m: Message, state: 'accepted' | 'declined') => void;
  onCounter: (m: Message) => void;
  onImage: (uri: string) => void;
  isNew?: boolean;
};

const R = 20;
const J = 5; // joined-corner radius

export const Bubble = memo(function Bubble({ m, mine, firstInGroup, lastInGroup, onLongPress, onReply, onRetry, onOffer, onCounter, onImage, isNew }: Props) {
  const t = useTheme();
  const meId = useStore((s) => s.meId);
  const listing = useStore((s) => (m.listingId ? s.listings[m.listingId] : undefined));
  const replyTo = useStore((s) => (m.replyToId ? s.messages[m.conversationId]?.find((x) => x.id === m.replyToId) : undefined));
  const replyName = useStore((s) => (replyTo ? (replyTo.senderId === s.meId ? 'You' : s.users[replyTo.senderId]?.displayName) : ''));

  const x = useSharedValue(0);
  const fired = useSharedValue(false);
  const pan = Gesture.Pan()
    .activeOffsetX([12, 999])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(72, e.translationX * 0.55));
      if (x.value > 50 && !fired.value) {
        fired.value = true;
        runOnJS(haptic.light)();
      }
    })
    .onEnd(() => {
      if (x.value > 50) runOnJS(onReply)(m);
      x.value = withTiming(0, { duration: 180 });
      fired.value = false;
    });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const replyIcon = useAnimatedStyle(() => ({ opacity: Math.min(1, x.value / 50) }));

  if (m.type === 'system') {
    return (
      <Animated.View entering={isNew ? FadeIn : undefined} style={{ alignItems: 'center', marginVertical: 10, paddingHorizontal: 36 }}>
        <Text style={{ color: t.textDim, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>{m.body}</Text>
      </Animated.View>
    );
  }

  const fg = mine ? t.bubbleOutText : t.bubbleInText;
  const meta = mine ? 'rgba(255,255,255,0.72)' : t.textFaint;
  const reactions = Object.values(m.reactions ?? {});
  const isMedia = m.type === 'image' && !m.deleted;
  const quoteBg = mine ? 'rgba(255,255,255,0.16)' : t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const corners = mine
    ? { borderTopLeftRadius: R, borderBottomLeftRadius: R, borderTopRightRadius: firstInGroup ? R : J, borderBottomRightRadius: lastInGroup ? R : J }
    : { borderTopRightRadius: R, borderBottomRightRadius: R, borderTopLeftRadius: firstInGroup ? R : J, borderBottomLeftRadius: lastInGroup ? R : J };

  const body = (() => {
    if (m.deleted)
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
          <Icon name="ban-outline" size={14} color={meta} />
          <Text style={{ color: meta, fontStyle: 'italic', fontSize: 15 }}>{m.senderId === meId ? 'You deleted this message' : 'This message was deleted'}</Text>
        </View>
      );
    switch (m.type) {
      case 'image':
        return (
          <Pressable onPress={() => onImage(m.imageUri!)} onLongPress={() => onLongPress(m)}>
            <Image source={{ uri: m.imageUri }} style={{ width: 236, height: 260, borderRadius: R - 4 }} contentFit="cover" transition={200} />
            {!!m.body && <Text style={{ color: fg, fontSize: 15.5, paddingHorizontal: 8, paddingTop: 7 }}>{m.body}</Text>}
          </Pressable>
        );
      case 'listing':
        return (
          <View>
            {listing && (
              <Pressable onPress={() => router.push(`/listing/${listing.id}`)} style={{ flexDirection: 'row', gap: 10, backgroundColor: quoteBg, borderRadius: 12, padding: 6, marginBottom: 6 }}>
                <Image source={{ uri: listing.images[0] }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
                  <Text numberOfLines={2} style={{ color: fg, fontWeight: '500', fontSize: 13 }}>{listing.title}</Text>
                  <Text style={{ color: fg, fontWeight: '600', fontSize: 13.5 }}>{formatNaira(listing.priceMinor)}</Text>
                </View>
              </Pressable>
            )}
            {!!m.body && <Text style={{ color: fg, fontSize: 15.5, lineHeight: 21, paddingHorizontal: 4 }}>{m.body}</Text>}
          </View>
        );
      case 'offer':
        return <OfferCard m={m} mine={mine} fg={fg} meta={meta} onOffer={onOffer} onCounter={onCounter} />;
      case 'voice':
        return <VoiceNote seconds={m.voice?.seconds ?? 5} fg={fg} mine={mine} />;
      case 'story_reply':
        return (
          <View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: quoteBg, borderRadius: 12, padding: 6, marginBottom: 6 }}>
              {!!m.storyImage && <Image source={{ uri: m.storyImage }} style={{ width: 34, height: 46, borderRadius: 6 }} />}
              <Text style={{ color: meta, fontSize: 12.5 }}>{mine ? 'You replied to their status' : 'Replied to your status'}</Text>
            </View>
            <Text style={{ color: fg, fontSize: 15.5, lineHeight: 21, paddingHorizontal: 4 }}>{m.body}</Text>
          </View>
        );
      default:
        return <Text style={{ color: fg, fontSize: 15.5, lineHeight: 21, paddingHorizontal: 4 }}>{m.body}</Text>;
    }
  })();

  const inner = (
    <>
      {replyTo && (
        <View style={{ backgroundColor: quoteBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 2, borderRadius: 1, backgroundColor: mine ? 'rgba(255,255,255,0.7)' : t.primary }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: mine ? '#fff' : t.primary, fontWeight: '600', fontSize: 12.5 }}>{replyName}</Text>
            <Text numberOfLines={2} style={{ color: meta, fontSize: 13 }}>{replyTo.type === 'image' ? 'Photo' : replyTo.type === 'offer' ? `Offer ${formatNaira(replyTo.offer!.amountMinor)}` : replyTo.type === 'voice' ? 'Voice message' : replyTo.body}</Text>
          </View>
        </View>
      )}
      {body}
      <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3, paddingHorizontal: 4, marginTop: 2 }, isMedia && !m.body ? { position: 'absolute', right: 10, bottom: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 } : null]}>
        {m.starred && <Icon name="star" size={10} color={isMedia && !m.body ? '#fff' : meta} />}
        <Text style={{ color: isMedia && !m.body ? '#fff' : meta, fontSize: 11 }}>{clockTime(m.createdAt)}</Text>
        {mine && !m.deleted && <Ticks status={m.status} size={14} onBubble />}
      </View>
    </>
  );

  const pad = isMedia ? 3 : 0;
  const bubbleStyle = [{ paddingHorizontal: isMedia ? pad : 10, paddingVertical: isMedia ? pad : 7, minWidth: 76, overflow: 'hidden' as const }, corners];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View entering={isNew ? FadeIn.duration(220) : undefined} style={{ marginTop: firstInGroup ? 8 : 2, marginBottom: reactions.length ? 14 : 0 }}>
        <Animated.View style={[{ position: 'absolute', left: 10, top: 0, bottom: 0, justifyContent: 'center' }, replyIcon]}>
          <Icon name="arrow-undo-outline" size={18} color={t.textDim} />
        </Animated.View>
        <Animated.View style={[{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 12 }, slide]}>
          <Pressable onLongPress={() => { haptic.medium(); onLongPress(m); }} onPress={m.status === 'failed' ? () => onRetry(m) : undefined} delayLongPress={260} style={{ maxWidth: '80%' }}>
            {mine && !m.deleted ? (
              <LinearGradient colors={[...t.brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bubbleStyle}>
                {inner}
              </LinearGradient>
            ) : (
              <View style={[bubbleStyle, { backgroundColor: mine ? t.surface3 : t.bubbleIn }]}>{inner}</View>
            )}
            {m.status === 'failed' && <Text style={{ color: t.danger, fontSize: 11.5, textAlign: 'right', marginTop: 3 }}>Not delivered · tap to retry</Text>}
            {reactions.length > 0 && (
              <Animated.View entering={FadeIn} style={{ position: 'absolute', bottom: -13, [mine ? 'right' : 'left']: 8, flexDirection: 'row', backgroundColor: t.surface2, borderRadius: 12, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 2, borderColor: t.chatBg, gap: 1 }}>
                {Array.from(new Set(reactions)).map((r) => (
                  <Text key={r} style={{ fontSize: 13 }}>{r}</Text>
                ))}
                {reactions.length > 1 && <Text style={{ color: t.textDim, fontSize: 11, alignSelf: 'center', marginLeft: 2 }}>{reactions.length}</Text>}
              </Animated.View>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

function OfferCard({ m, mine, fg, meta, onOffer, onCounter }: { m: Message; mine: boolean; fg: string; meta: string; onOffer: Props['onOffer']; onCounter: Props['onCounter'] }) {
  const t = useTheme();
  const o = m.offer!;
  const stateLabel = { pending: 'Awaiting response', accepted: 'Accepted', declined: 'Declined', countered: 'Countered' }[o.state];
  const stateIcon = { pending: 'time-outline', accepted: 'checkmark-circle', declined: 'close-circle-outline', countered: 'swap-horizontal' }[o.state] as any;
  return (
    <View style={{ width: 224, paddingHorizontal: 4, paddingVertical: 4, gap: 4 }}>
      <Text style={{ color: meta, fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6 }}>{mine ? 'Your offer' : 'Offer'}</Text>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 26, letterSpacing: -0.8 }}>{formatNaira(o.amountMinor)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name={stateIcon} size={14} color={o.state === 'accepted' ? (mine ? '#fff' : t.success) : meta} />
        <Text style={{ color: o.state === 'accepted' ? (mine ? '#fff' : t.success) : meta, fontWeight: '500', fontSize: 12.5 }}>{stateLabel}</Text>
      </View>
      {!mine && o.state === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <Pressable onPress={() => { haptic.success(); onOffer(m, 'accepted'); }} style={{ flex: 1, backgroundColor: t.inverse, borderRadius: 10, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.inverseText, fontWeight: '600', fontSize: 13 }}>Accept</Text>
          </Pressable>
          <Pressable onPress={() => onCounter(m)} style={{ flex: 1, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.text, fontWeight: '600', fontSize: 13 }}>Counter</Text>
          </Pressable>
          <Pressable onPress={() => onOffer(m, 'declined')} style={{ width: 34, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={16} color={t.textDim} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const BARS = [6, 12, 9, 16, 11, 20, 8, 14, 18, 10, 13, 22, 11, 7, 14, 17, 9, 12, 6, 10, 15, 8];

function VoiceNote({ seconds, fg, mine }: { seconds: number; fg: string; mine: boolean }) {
  const t = useTheme();
  const progress = useSharedValue(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waveW, setWaveW] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const started = Date.now() - elapsed * 1000;
    const id = setInterval(() => {
      const s = Math.min(seconds, Math.floor((Date.now() - started) / 1000));
      setElapsed(s);
      if (s >= seconds) {
        setPlaying(false);
        setElapsed(0);
        progress.value = 0;
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const toggle = () => {
    if (playing) {
      cancelAnimation(progress);
      setPlaying(false);
      return;
    }
    const from = elapsed / seconds;
    progress.value = from;
    progress.value = withTiming(1, { duration: (seconds - elapsed) * 1000, easing: Easing.linear });
    setPlaying(true);
  };

  const fill = useAnimatedStyle(() => ({ width: progress.value * waveW }));
  const idle = mine ? 'rgba(255,255,255,0.4)' : t.surface3;
  const active = mine ? '#fff' : t.primary;
  const label = playing || elapsed > 0 ? elapsed : seconds;
  const bars = (color: string) => (
    <View style={{ width: waveW, height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {BARS.map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 230, paddingHorizontal: 2, paddingVertical: 2 }}>
      <Pressable onPress={toggle} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : t.surface3, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={playing ? 'pause' : 'play'} size={16} color={fg} style={{ marginLeft: playing ? 0 : 2 }} />
      </Pressable>
      <View style={{ flex: 1, height: 26, overflow: 'hidden' }} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
        {waveW > 0 && bars(idle)}
        {waveW > 0 && (
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 26, overflow: 'hidden' }, fill]}>{bars(active)}</Animated.View>
        )}
      </View>
      <Text style={{ width: 32, textAlign: 'right', fontSize: 11.5, color: mine ? 'rgba(255,255,255,0.8)' : t.textDim, fontVariant: ['tabular-nums'] }}>0:{String(label).padStart(2, '0')}</Text>
    </View>
  );
}

export function TypingBubble() {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ alignSelf: 'flex-start', marginLeft: 12, marginTop: 8, backgroundColor: t.bubbleIn, borderRadius: R, paddingHorizontal: 14, paddingVertical: 12 }}>
      <TypingDots />
    </Animated.View>
  );
}

export function DayPill({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
      <Text style={{ color: t.textFaint, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}
