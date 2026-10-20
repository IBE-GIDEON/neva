'use client';

import { LoaderCircle, Pause, Play } from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

import { clipTime } from './VoiceRecorder';

const BARS = [6, 12, 9, 16, 11, 20, 8, 14, 18, 10, 13, 22, 11, 7, 14, 17, 9, 12, 6, 10, 15, 8];

/** Only one voice note plays at a time across the whole app. */
let current: HTMLAudioElement | null = null;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Voice note bubble with real playback. `uri` is a blob: URL for our own just-recorded notes and a
 * signed chat-media URL once synced; undefined means the server couldn't resolve the file.
 * The <audio> element is created on first play/seek so a long chat doesn't preload every note.
 */
export function VoiceNote({ seconds, uri }: { seconds: number; uri?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /** Where the user has dragged to while scrubbing (seconds), shown instead of currentTime. */
  const [scrub, setScrub] = useState<number | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const fallback = Math.max(1, seconds);
  const durOf = (a: HTMLAudioElement | null) => (a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : fallback);
  const [duration, setDuration] = useState(fallback);

  // The server echo swaps our blob: URL for a signed URL. Keep a working element; retry a failed one with the new URL.
  const [seenUri, setSeenUri] = useState(uri);
  if (uri !== seenUri) {
    setSeenUri(uri);
    if (failed) setFailed(false);
  }
  useEffect(() => {
    const a = audio.current;
    if (a && a.error && uri && a.src !== uri) {
      a.src = uri;
      a.load();
    }
  }, [uri]);

  useEffect(
    () => () => {
      const a = audio.current;
      if (!a) return;
      a.pause();
      if (current === a) current = null;
      a.removeAttribute('src');
      a.load();
      audio.current = null;
    },
    [],
  );

  const ensure = () => {
    if (audio.current) return audio.current;
    if (!uri) return null;
    const a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => {
      setDuration(durOf(a));
      if (pendingSeek.current != null) {
        try {
          a.currentTime = pendingSeek.current;
        } catch {}
        pendingSeek.current = null;
      }
    });
    a.addEventListener('durationchange', () => setDuration(durOf(a)));
    a.addEventListener('timeupdate', () => setElapsed(a.currentTime));
    a.addEventListener('waiting', () => setLoading(true));
    a.addEventListener('canplay', () => setLoading(false));
    a.addEventListener('playing', () => {
      setLoading(false);
      setPlaying(true);
    });
    a.addEventListener('pause', () => {
      setPlaying(false);
      setLoading(false);
    });
    a.addEventListener('ended', () => {
      setPlaying(false);
      setLoading(false);
      setElapsed(0);
      try {
        a.currentTime = 0;
      } catch {}
      if (current === a) current = null;
    });
    a.addEventListener('error', () => {
      setPlaying(false);
      setLoading(false);
      setFailed(true);
      if (current === a) current = null;
    });
    a.src = uri;
    audio.current = a;
    return a;
  };

  const toggle = () => {
    const a = ensure();
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    if (current && current !== a) current.pause();
    current = a;
    setFailed(false);
    if (a.readyState < 3) setLoading(true);
    a.play().catch((e: { name?: string }) => {
      setLoading(false);
      if (e?.name === 'AbortError') return; // paused before it started
      setFailed(true);
      if (current === a) current = null;
    });
  };

  /* ---- seek by click / drag on the waveform ---- */
  const wave = useRef<HTMLDivElement>(null);
  const fracAt = (clientX: number) => {
    const r = wave.current?.getBoundingClientRect();
    return r && r.width ? clamp01((clientX - r.left) / r.width) : 0;
  };
  const commitSeek = (t: number) => {
    const a = ensure();
    if (!a) return;
    setElapsed(t);
    if (a.readyState >= 1) {
      try {
        a.currentTime = t;
      } catch {}
    } else {
      pendingSeek.current = t;
      a.load();
    }
  };
  const onWaveDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!uri || failed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setScrub(fracAt(e.clientX) * durOf(audio.current));
  };
  const onWaveMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub === null) return;
    setScrub(fracAt(e.clientX) * durOf(audio.current));
  };
  const onWaveUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub === null) return;
    const t = fracAt(e.clientX) * durOf(audio.current);
    setScrub(null);
    commitSeek(t);
  };
  const onWaveKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const d = durOf(audio.current);
    commitSeek(Math.min(d, Math.max(0, (scrub ?? elapsed) + (e.key === 'ArrowRight' ? 5 : -5))));
  };

  if (!uri || failed)
    return (
      <div className="voice unavailable">
        <span className="play" aria-hidden>
          <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />
        </span>
        <span className="vn-na">Voice note unavailable</span>
        <span className="dur">{clipTime(fallback)}</span>
      </div>
    );

  const shown = scrub ?? elapsed;
  const progress = clamp01(shown / duration);
  const active = playing || shown > 0;
  return (
    <div className="voice">
      <button className="play" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {loading ? <LoaderCircle size={17} className="vn-spin" /> : playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <div
        ref={wave}
        className="wave seekable"
        role="slider"
        tabIndex={0}
        aria-label="Seek voice message"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${clipTime(shown)} of ${clipTime(duration)}`}
        onPointerDown={onWaveDown}
        onPointerMove={onWaveMove}
        onPointerUp={onWaveUp}
        onPointerCancel={() => setScrub(null)}
        onKeyDown={onWaveKey}>
        {BARS.map((h, i) => (
          <i key={i} className={(i + 0.5) / BARS.length <= progress ? 'on' : ''} style={{ height: h }} />
        ))}
      </div>
      <span className="dur">{clipTime(active ? shown : duration)}</span>
    </div>
  );
}
