// Web Speech API wrapper. On mobile the voice list is loaded asynchronously
// (Safari fires `voiceschanged` after first access; Chrome/Android usually
// returns voices synchronously). We cache the resolved list so callers don't
// pay the wait cost on every speak().

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTTSSupported()) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const synth = window.speechSynthesis;
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    const onChange = () => {
      const list = synth.getVoices();
      if (list.length === 0) return;
      synth.removeEventListener('voiceschanged', onChange);
      resolve(list);
    };
    synth.addEventListener('voiceschanged', onChange);
    // Hard fallback: never block longer than 2s waiting for voices.
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onChange);
      resolve(synth.getVoices());
    }, 2000);
  });
  return voicesPromise;
}

function pickEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const enUS = voices.find(
    (v) => v.lang === 'en-US' || v.lang.toLowerCase() === 'en_us',
  );
  if (enUS) return enUS;
  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return anyEn ?? null;
}

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
};

export async function speak(
  text: string,
  rateOrOptions: number | SpeakOptions = 1.0,
): Promise<void> {
  if (!isTTSSupported()) {
    throw new Error('이 기기에서는 음성 재생을 지원하지 않습니다.');
  }
  const trimmed = text.trim();
  if (!trimmed) return;

  const opts: SpeakOptions =
    typeof rateOrOptions === 'number' ? { rate: rateOrOptions } : rateOrOptions;
  const rate = Math.max(0.1, Math.min(10, opts.rate ?? 1.0));
  const pitch = Math.max(0, Math.min(2, opts.pitch ?? 1.0));

  const synth = window.speechSynthesis;
  // Cancel any in-flight utterance so successive taps replace rather than queue.
  synth.cancel();

  const voices = await loadVoices();
  const voice = pickEnglishVoice(voices);

  const utterance = new SpeechSynthesisUtterance(trimmed);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'en-US';
  utterance.rate = rate;
  utterance.pitch = pitch;

  return new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    // 'canceled' is normal when a new utterance replaces this one; treat as resolved.
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve();
      } else {
        reject(new Error(`TTS error: ${event.error}`));
      }
    };
    synth.speak(utterance);
  });
}

export function cancelSpeak(): void {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}
