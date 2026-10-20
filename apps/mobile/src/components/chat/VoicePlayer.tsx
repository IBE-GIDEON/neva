import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme';

/* ---------- app-wide voice playback: one shared player, one note at a time ---------- */

type VoiceState = { key: string | null; playing: boolean; loading: boolean; currentTime: number; duration: number };
const IDLE: VoiceState = { key: null, playing: false, loading: false, currentTime: 0, duration: 0 };

let state: VoiceState = IDLE;
let player: AudioPlayer | null = null;
let pendingSeek: number | null = null; // seek requested before the new source finished loading
let lastPlayAt = 0;
const listeners = new Set<() => void>();

function emit(next: Partial<VoiceState>) {
  const merged = { ...state, ...next };
  if (merged.key === state.key && merged.playing === state.playing && merged.loading === state.loading && merged.currentTime === state.currentTime && merged.duration === state.duration) return;
  state = merged;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const playbackMode = () => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' }).catch(() => {});

function onStatus(s: AudioStatus) {
  if (!state.key || !player) return;
  if (s.didJustFinish) {
    player.pause();
    player.seekTo(0).catch(() => {});
    emit({ playing: false, loading: false, currentTime: 0 });
    return;
  }
  if (s.isLoaded && pendingSeek != null) {
    const to = pendingSeek;
    pendingSeek = null;
    player.seekTo(to).catch(() => {});
    emit({ currentTime: to, loading: false });
    return;
  }
  const loading = !s.isLoaded || s.isBuffering;
  // Something outside the app paused us (call, Siri, route change): reflect it, but ignore the
  // first status ticks right after play() which can still report the old paused state.
  const stoppedExternally = state.playing && s.isLoaded && !s.playing && !s.isBuffering && Date.now() - lastPlayAt > 800;
  emit({
    playing: stoppedExternally ? false : state.playing,
    loading: state.playing && loading,
    currentTime: pendingSeek ?? s.currentTime,
    duration: s.duration > 0 ? s.duration : state.duration,
  });
}

function getPlayer() {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 100 });
    player.addListener('playbackStatusUpdate', onStatus);
  }
  return player;
}

async function startNote(key: string, uri: string, duration: number, at: number) {
  const p = getPlayer();
  if (state.playing) p.pause();
  pendingSeek = at > 0 ? at : null;
  emit({ key, playing: true, loading: true, currentTime: at, duration });
  await playbackMode();
  if (state.key !== key) return; // another note was tapped meanwhile
  p.replace({ uri });
  p.play();
  lastPlayAt = Date.now();
}

export async function toggleVoice(key: string, uri: string, duration: number) {
  if (state.key !== key) return startNote(key, uri, duration, 0);
  const p = getPlayer();
  if (state.playing) {
    p.pause();
    emit({ playing: false, loading: false });
    return;
  }
  emit({ playing: true });
  await playbackMode();
  p.play();
  lastPlayAt = Date.now();
}

export function seekVoice(key: string, uri: string, fraction: number, duration: number) {
  const f = Math.max(0, Math.min(1, fraction));
  if (state.key !== key) {
    startNote(key, uri, duration, f * duration);
    return;
  }
  const to = f * (state.duration || duration);
  if (pendingSeek != null) pendingSeek = to;
  else getPlayer().seekTo(to).catch(() => {});
  emit({ currentTime: to });
}

/** Pause whatever voice note is playing (screen blur, app background, recording start). */
export function pauseVoice() {
  if (!player || !state.playing) return;
  player.pause();
  emit({ playing: false, loading: false });
}

function useVoiceState(key: string) {
  return useSyncExternalStore(subscribe, () => (state.key === key ? state : IDLE));
}

export function formatVoiceTime(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- bubble UI ---------- */

const BARS = [6, 12, 9, 16, 11, 20, 8, 14, 18, 10, 13, 22, 11, 7, 14, 17, 9, 12, 6, 10, 15, 8];

export function VoiceNote({ id, uri, seconds, fg, mine, onLongPress }: { id: string; uri?: string; seconds: number; fg: string; mine: boolean; onLongPress?: () => void }) {
  const t = useTheme();
  const v = useVoiceState(id);
  const [waveW, setWaveW] = useState(0);
  const progress = useSharedValue(0);

  const active = v.key === id;
  const duration = active && v.duration > 0 ? v.duration : seconds;
  const ratio = active && duration > 0 ? Math.min(1, v.currentTime / duration) : 0;

  useEffect(() => {
    progress.value = ratio === 0 ? 0 : withTiming(ratio, { duration: 110, easing: Easing.linear });
  }, [ratio, progress]);

  const fill = useAnimatedStyle(() => ({ width: progress.value * waveW }));
  const idle = mine ? 'rgba(255,255,255,0.4)' : t.surface3;
  const lit = mine ? '#fff' : t.primary;
  const metaColor = mine ? 'rgba(255,255,255,0.8)' : t.textDim;
  const label = active && (v.playing || v.currentTime > 0) ? v.currentTime : seconds;
  const bars = (color: string) => (
    <View style={{ width: waveW, height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {BARS.map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 230, paddingHorizontal: 2, paddingVertical: 2 }}>
      <Pressable
        disabled={!uri}
        onPress={() => uri && toggleVoice(id, uri, seconds)}
        onLongPress={onLongPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={!uri ? 'Voice note unavailable' : v.playing && active ? 'Pause voice note' : 'Play voice note'}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : t.surface3, alignItems: 'center', justifyContent: 'center', opacity: uri ? 1 : 0.45 }}>
        {active && v.loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Icon name={active && v.playing ? 'pause' : 'play'} size={16} color={fg} style={{ marginLeft: active && v.playing ? 0 : 2 }} />
        )}
      </Pressable>
      {uri ? (
        <Pressable
          onPress={(e) => waveW > 0 && seekVoice(id, uri, e.nativeEvent.locationX / waveW, seconds)}
          onLongPress={onLongPress}
          style={{ flex: 1, height: 26, overflow: 'hidden' }}
          onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
          <View pointerEvents="none" style={{ height: 26 }}>
            {waveW > 0 && bars(idle)}
            {waveW > 0 && <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 26, overflow: 'hidden' }, fill]}>{bars(lit)}</Animated.View>}
          </View>
        </Pressable>
      ) : (
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontStyle: 'italic', color: metaColor }}>
          Voice note unavailable
        </Text>
      )}
      <Text style={{ minWidth: 32, textAlign: 'right', fontSize: 11.5, color: metaColor, fontVariant: ['tabular-nums'] }}>{formatVoiceTime(label)}</Text>
    </View>
  );
}
