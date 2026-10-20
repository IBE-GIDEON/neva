import { getRecordingPermissionsAsync, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { formatVoiceTime, pauseVoice } from '@/components/chat/VoicePlayer';
import { haptic, T } from '@/components/ui';
import { showToast } from '@/store';
import { useTheme } from '@/theme';

export const VOICE_MIN_SECONDS = 1;
export const VOICE_MAX_SECONDS = 5 * 60;

const playbackMode = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

/**
 * Real voice-note recording (AAC .m4a via expo-audio).
 * One tap starts, `finish(true)` sends, `finish(false)` discards. Recording is discarded when the
 * screen loses focus, unmounts, or the app goes to the background; it auto-stops (and sends) at 5 min.
 */
export function useVoiceRecorder(onSend: (seconds: number, uri: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const active = useRef(false); // native recorder is running
  const starting = useRef(false); // permission / prepare in flight
  const abortStart = useRef(false); // screen left while starting
  const startedAt = useRef(0);
  const onSendRef = useRef(onSend);

  useEffect(() => {
    onSendRef.current = onSend;
  });

  const finish = useCallback(
    async (keep: boolean, reason?: string) => {
      if (!active.current) {
        if (starting.current) abortStart.current = true;
        return;
      }
      active.current = false;
      setRecording(false);
      let seconds = (Date.now() - startedAt.current) / 1000;
      try {
        const st = recorder.getStatus();
        if (st.durationMillis > 0) seconds = st.durationMillis / 1000;
      } catch {}
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {}
      await playbackMode();
      if (!keep) {
        haptic.warn();
        if (reason) showToast(reason, 'mic-off-outline');
        return;
      }
      if (seconds < VOICE_MIN_SECONDS) {
        haptic.warn();
        showToast('Hold on — record at least a second', 'mic-outline');
        return;
      }
      if (!uri) {
        showToast('Couldn’t save that voice note', 'alert-circle');
        return;
      }
      onSendRef.current(Math.max(1, Math.min(VOICE_MAX_SECONDS, Math.round(seconds))), uri);
    },
    [recorder],
  );

  const start = useCallback(async () => {
    if (active.current || starting.current) return;
    starting.current = true;
    abortStart.current = false;
    try {
      pauseVoice();
      let perm = await getRecordingPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access needed', 'To send voice notes, allow Neva to use your microphone in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
        return;
      }
      if (abortStart.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (abortStart.current) {
        await playbackMode();
        return;
      }
      recorder.record();
      startedAt.current = Date.now();
      active.current = true;
      setSecs(0);
      setRecording(true);
      haptic.medium();
    } catch {
      showToast('Couldn’t start recording', 'alert-circle');
      await playbackMode();
    } finally {
      starting.current = false;
    }
  }, [recorder]);

  // elapsed timer + 5-minute cap
  useEffect(() => {
    if (!recording) return;
    const i = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSecs(s);
      if (s >= VOICE_MAX_SECONDS) {
        showToast('Voice notes can be up to 5 minutes', 'mic-outline');
        finish(true);
      }
    }, 250);
    return () => clearInterval(i);
  }, [recording, finish]);

  // app backgrounded → discard
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') finish(false, 'Recording stopped');
    });
    return () => sub.remove();
  }, [finish]);

  // screen blurred / unmounted → discard
  useFocusEffect(
    useCallback(
      () => () => {
        if (active.current || starting.current) finish(false, 'Voice note discarded');
      },
      [finish],
    ),
  );

  return { recording, secs, start, send: () => finish(true), cancel: () => finish(false) };
}

export function RecordingBar({ secs }: { secs: number }) {
  const t = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 600 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  const nearCap = secs >= VOICE_MAX_SECONDS - 15;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 16, gap: 10 }}>
      <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.danger }, a]} />
      <T weight="500" style={{ fontVariant: ['tabular-nums'] }}>{formatVoiceTime(secs)}</T>
      {nearCap && <T dim size={12.5}>{formatVoiceTime(VOICE_MAX_SECONDS - secs)} left</T>}
    </View>
  );
}
