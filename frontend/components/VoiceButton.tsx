'use client';

import { useCallback, useRef, useState } from 'react';

type Status = 'idle' | 'recording' | 'uploading' | 'sent' | 'error';

const LABELS: Record<Status, string> = {
  idle: 'Tap to record',
  recording: 'Recording… tap to stop',
  uploading: 'Sending…',
  sent: 'Sent!',
  error: 'Error',
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export default function VoiceButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const upload = useCallback(async (blob: Blob) => {
    setStatus('uploading');
    try {
      const form = new FormData();
      const ext = blob.type.includes('webm')
        ? 'webm'
        : blob.type.includes('mp4')
          ? 'm4a'
          : blob.type.includes('ogg')
            ? 'ogg'
            : 'bin';
      form.append('audio', blob, `recording.${ext}`);

      const resp = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setStatus('sent');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
      window.setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = 'audio/webm;codecs=opus';
      const recorder =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(preferredMime)
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        cleanupStream();
        void upload(blob);
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus('recording');
    } catch (err) {
      cleanupStream();
      setErrorMessage(err instanceof Error ? err.message : 'Microphone access denied');
      setStatus('error');
      window.setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, [upload]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const handleClick = () => {
    if (status === 'recording') stopRecording();
    else if (status === 'idle' || status === 'sent' || status === 'error') void startRecording();
  };

  const isRecording = status === 'recording';
  const isBusy = status === 'uploading';
  const labelText = status === 'error' && errorMessage ? errorMessage : LABELS[status];

  return (
    <div className="stack">
      <div className={`label${status === 'error' ? ' label--error' : ''}`}>{labelText}</div>

      <button
        type="button"
        className="mic"
        onClick={handleClick}
        disabled={isBusy}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        aria-pressed={isRecording}
      >
        <span className="mic__ring" aria-hidden />
        {isRecording && <span className="mic__ring mic__ring--pulse" aria-hidden />}
        {isRecording ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
