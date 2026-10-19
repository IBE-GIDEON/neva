import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Easing, withTiming, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/components/ui';

/** Session-level sound preference for video statuses (WhatsApp keeps it while the app is open). */
export const storyVideoPrefs = { muted: false };

type Props = {
  uri: string;
  /** Hold-to-pause, typing, menus, screen blurred… */
  paused: boolean;
  muted: boolean;
  /** Story progress (0–1) — driven by the video's own clock. */
  progress?: SharedValue<number>;
  /** Fallback length if the player hasn't reported a duration yet. */
  seconds?: number;
  onEnd?: () => void;
  onError?: () => void;
};

/** Full-bleed video for the status viewer: no native controls, no looping. */
export function StoryVideo({ uri, paused, muted, progress, seconds, onEnd, onError }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.1;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const ended = useRef(false);
  const failed = status === 'error';

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    if (ended.current || failed) return;
    if (paused) player.pause();
    else player.play();
  }, [player, paused, failed]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!progress || ended.current) return;
    const d = player.duration > 0 ? player.duration : seconds ?? 0;
    if (d <= 0) return;
    progress.value = withTiming(Math.min(1, currentTime / d), { duration: 110, easing: Easing.linear });
  });

  useEventListener(player, 'playToEnd', () => {
    if (ended.current) return;
    ended.current = true;
    if (progress) progress.value = 1;
    onEnd?.();
  });

  const reported = useRef(false);
  useEffect(() => {
    if (failed && !reported.current) {
      reported.current = true;
      onError?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
        <Icon name="videocam-off-outline" size={40} color="rgba(255,255,255,0.7)" />
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' }}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
      {status !== 'readyToPlay' && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}

/** Muted, looping preview for the composer. */
export function StoryVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} allowsPictureInPicture={false} />;
}
