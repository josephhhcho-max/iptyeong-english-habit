import { useEffect, useRef, useState } from 'react';

// The W3C SpeechRecognition API is still vendor-prefixed in some browsers
// (Safari, older Chrome). Declarations below are minimal — TS doesn't ship
// types for it.

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = { error?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type UseSpeechRecognitionOptions = {
  lang?: string;
};

export function useSpeechRecognition(opts: UseSpeechRecognitionOptions = {}) {
  const Ctor = getCtor();
  const supported = Ctor !== null;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = opts.lang ?? 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? '';
        if (r.isFinal) final += t;
        else interim += t;
      }
      setTranscript((prev) => (final ? prev + final : interim || prev));
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (e) => {
      const code = e.error ?? 'unknown';
      // 'no-speech' / 'aborted' are normal user actions — surface a softer label.
      const friendly =
        code === 'not-allowed' || code === 'service-not-allowed'
          ? '마이크 권한이 거부됐습니다. 브라우저 설정에서 허용해주세요.'
          : code === 'no-speech'
            ? '소리가 감지되지 않았습니다.'
            : code === 'aborted'
              ? ''
              : `음성 인식 오류: ${code}`;
      if (friendly) setError(friendly);
      setListening(false);
    };

    recognition.onstart = () => {
      setListening(true);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [Ctor, opts.lang]);

  function start() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setTranscript('');
    setError(null);
    try {
      recognition.start();
    } catch {
      // .start() throws if recognition is already running — safe to ignore.
    }
  }

  function stop() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // ignore
    }
  }

  function reset() {
    setTranscript('');
    setError(null);
  }

  return { supported, listening, transcript, error, start, stop, reset };
}
