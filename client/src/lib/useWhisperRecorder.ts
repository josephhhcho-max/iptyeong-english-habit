import { useEffect, useRef, useState } from 'react';
import { transcribeAudio } from './api';

// Records audio via MediaRecorder, ships it to /api/transcribe (OpenAI Whisper),
// and exposes the same surface shape as the in-browser SpeechRecognition hook
// so the Flashcards UI is the same. Works on iOS Safari, Android Chrome, and
// desktop browsers where in-browser SR isn't available.

const MAX_RECORDING_MS = 45_000; // safety stop so a forgotten mic doesn't burn API time

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  // Preferred from most-supported-by-Whisper to fallback.
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ''; // let the browser pick
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader returned non-string result'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export type WhisperRecorder = {
  supported: boolean;
  recording: boolean;
  transcribing: boolean;
  /** Convenience alias mirroring useSpeechRecognition: any in-flight work. */
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

export function useWhisperRecorder(): WhisperRecorder {
  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      cleanupStream();
    };
  }, []);

  async function start() {
    if (!supported) {
      setError('이 기기는 녹음을 지원하지 않습니다.');
      return;
    }
    if (recording || transcribing) return;
    setTranscript('');
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (stopTimerRef.current !== null) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        cleanupStream();
        setRecording(false);

        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];

        if (blob.size === 0) {
          setError('녹음된 소리가 없습니다.');
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const result = await transcribeAudio({
            audioBase64: base64,
            mediaType: type,
          });
          setTranscript(result.text ?? '');
        } catch (err) {
          setError(err instanceof Error ? err.message : '변환 실패');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);

      stopTimerRef.current = window.setTimeout(() => {
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          // ignore
        }
      }, MAX_RECORDING_MS);
    } catch (err) {
      cleanupStream();
      const msg = err instanceof Error ? err.message : 'unknown error';
      const friendly =
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('not allowed')
          ? '마이크 권한이 거부됐습니다. 브라우저 설정에서 허용해주세요.'
          : `마이크를 켤 수 없습니다: ${msg}`;
      setError(friendly);
      setRecording(false);
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      // ignore
    }
  }

  function reset() {
    setTranscript('');
    setError(null);
  }

  return {
    supported,
    recording,
    transcribing,
    listening: recording || transcribing,
    transcript,
    error,
    start,
    stop,
    reset,
  };
}
