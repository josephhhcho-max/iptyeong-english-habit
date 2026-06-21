import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'iptyeong.playbackRate.v1';
export const PLAYBACK_RATES = [0.75, 1.0] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
const DEFAULT_RATE: PlaybackRate = 1.0;

function readStoredRate(): PlaybackRate {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATE;
    const parsed = parseFloat(raw);
    if (PLAYBACK_RATES.includes(parsed as PlaybackRate)) {
      return parsed as PlaybackRate;
    }
  } catch {
    // ignore (private mode etc.)
  }
  return DEFAULT_RATE;
}

// Keep tabs / windows in sync (and any sibling hook instances).
const subscribers = new Set<(rate: PlaybackRate) => void>();
function broadcast(rate: PlaybackRate) {
  subscribers.forEach((fn) => fn(rate));
}

export function usePlaybackRate() {
  const [rate, setRateState] = useState<PlaybackRate>(readStoredRate);

  useEffect(() => {
    const onChange = (r: PlaybackRate) => setRateState(r);
    subscribers.add(onChange);
    return () => {
      subscribers.delete(onChange);
    };
  }, []);

  const setRate = useCallback((r: PlaybackRate) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(r));
    } catch {
      // ignore
    }
    setRateState(r);
    broadcast(r);
  }, []);

  const toggle = useCallback(() => {
    setRate(rate === 1.0 ? 0.75 : 1.0);
  }, [rate, setRate]);

  return { rate, setRate, toggle };
}
