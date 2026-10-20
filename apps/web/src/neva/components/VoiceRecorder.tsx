'use client';

import { MicOff, SendHorizontal, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { showToast } from '../store';

export type RecordedVoice = { seconds: number; uri: string; ext: string };

/**
 * Container preference, first supported wins. audio/mp4 (AAC) comes first because iPhones / Safari
 * can't play webm/opus at all — a webm note recorded in Chrome or Firefox will show as
 * "unavailable" for an iOS recipient. Chrome 126+ and Safari record mp4; older Chrome and
 * Firefox fall back to webm/ogg opus, which iOS can't decode (known limitation until we transcode).
 * Explicit AAC is tried before bare audio/mp4: Chrome's bare audio/mp4 may mux Opus inside mp4,
 * which older iOS versions can't play either.
 */
const MIME_TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const MIN_MS = 1000;
const MAX_MS = 5 * 60 * 1000;

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return MIME_TYPES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
};
const extFor = (type: string) => (type.includes('webm') ? 'webm' : type.includes('ogg') ? 'ogg' : 'm4a');
export const clipTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Why recording can't start, or null when the browser looks capable. */
export function voiceUnsupportedReason(): string | null {
  if (typeof window === 'undefined') return 'Voice notes aren’t available here.';
  if (!window.isSecureContext) return 'Voice notes need a secure (https) connection.';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'This browser can’t record voice notes. Try the latest Chrome, Safari or Edge.';
  return null;
}

const micError = (e: unknown) => {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found. Connect one and try again.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Your microphone is in use by another app. Close it and try again.';
  return 'Couldn’t start recording. Check your microphone and try again.';
};

/**
 * Recording bar that replaces the composer while it's mounted. Mounting asks for the mic and starts
 * recording immediately; unmounting (cancel, send, leaving the chat) always releases the mic.
 * Duration comes from wall-clock recording time — Chrome's webm blobs usually carry no duration.
 */
export function VoiceRecorder({ onSend, onClose }: { onSend: (v: RecordedVoice) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(() => voiceUnsupportedReason());
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const cb = useRef({ onSend, onClose });
  useEffect(() => {
    cb.current = { onSend, onClose };
  });
  /** finish('send' | 'cancel') — set once the recorder is live. */
  const finishRef = useRef<((intent: 'send' | 'cancel') => void) | null>(null);

  useEffect(() => {
    if (voiceUnsupportedReason()) return;
    let dead = false;
    let stream: MediaStream | null = null;
    let rec: MediaRecorder | null = null;
    let timer = 0;
    let startedAt = 0;
    let intent: 'send' | 'cancel' = 'cancel';
    const chunks: Blob[] = [];

    const release = () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const finish = (why: 'send' | 'cancel') => {
      if (!rec || rec.state === 'inactive') return;
      intent = why;
      const ms = performance.now() - startedAt;
      clearInterval(timer);
      rec.onstop = () => {
        release();
        if (intent !== 'send') return;
        if (ms < MIN_MS) {
          showToast('Voice note too short');
          cb.current.onClose();
          return;
        }
        const type = rec?.mimeType || chunks[0]?.type || 'audio/mp4';
        const blob = new Blob(chunks, { type });
        if (!blob.size) {
          showToast('Couldn’t record a voice note. Try again.');
          cb.current.onClose();
          return;
        }
        cb.current.onSend({ seconds: Math.max(1, Math.round(Math.min(ms, MAX_MS) / 1000)), uri: URL.createObjectURL(blob), ext: extFor(type) });
      };
      try {
        rec.stop();
      } catch {
        release();
      }
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        if (dead) return release();
        const mimeType = pickMime();
        try {
          rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
        } catch {
          rec = new MediaRecorder(s);
        }
        rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);
        rec.onerror = () => {
          intent = 'cancel';
          release();
          setError('Recording stopped unexpectedly. Try again.');
        };
        rec.start();
        startedAt = performance.now();
        timer = window.setInterval(() => {
          const ms = performance.now() - startedAt;
          setElapsed(ms / 1000);
          if (ms >= MAX_MS) {
            showToast('Voice notes are limited to 5 minutes');
            finish('send');
          }
        }, 200);
        finishRef.current = finish;
        setReady(true);
      })
      .catch((e) => {
        if (!dead) setError(micError(e));
      });

    return () => {
      dead = true;
      finishRef.current = null;
      if (rec && rec.state !== 'inactive') {
        intent = 'cancel';
        rec.onstop = null;
        try {
          rec.stop();
        } catch {}
      }
      release();
    };
  }, []);

  if (error)
    return (
      <div className="composer voice-rec" role="alert">
        <MicOff size={19} className="vr-err-ic" />
        <span className="vr-err">{error}</span>
        <button className="send-btn" onClick={() => cb.current.onClose()} aria-label="Dismiss">
          <X size={20} />
        </button>
      </div>
    );

  return (
    <div className="composer voice-rec">
      <button className="send-btn vr-trash" onClick={() => cb.current.onClose()} aria-label="Cancel recording" title="Cancel">
        <Trash2 size={20} />
      </button>
      <div className="vr-status" aria-live="polite">
        <span className={`vr-dot${ready ? ' on' : ''}`} aria-hidden />
        <span className="vr-time">{clipTime(elapsed)}</span>
        <span className="vr-label">{ready ? 'Recording' : 'Starting microphone…'}</span>
      </div>
      <button className="send-btn go" disabled={!ready} onClick={() => finishRef.current?.('send')} aria-label="Send voice note" title="Send">
        <SendHorizontal size={20} />
      </button>
    </div>
  );
}
