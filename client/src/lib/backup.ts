// Bundle the user's entire learning state into a single JSON file (and
// restore from it). Covers localStorage tables AND the IndexedDB image blobs
// so a restore on a new device reproduces the full experience.

import { openDB } from 'idb';

const LS_KEYS = [
  'iptyeong.sessions.v1',
  'iptyeong.expressions.v1',
  'iptyeong.conversations.v1',
  'iptyeong.writings.v1',
] as const;

const PREFS_KEYS = [
  'iptyeong.playbackRate.v1',
  'iptyeong.theme.v1',
] as const;

const DB_NAME = 'iptyeong';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';
const BACKUP_VERSION = 1;

export type BackupBundle = {
  version: number;
  exportedAt: string;
  app: 'iptyeong-english-habit';
  localStorage: Record<string, unknown>;
  preferences: Record<string, string | null>;
  images: Array<{ id: string; mediaType: string; data: string /* base64 */ }>;
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    },
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== 'string') return reject(new Error('reader.result not string'));
      const comma = r.indexOf(',');
      resolve(comma >= 0 ? r.slice(comma + 1) : r);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mediaType: string): Blob {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

export async function exportAll(): Promise<BackupBundle> {
  const db = await getDB();

  // localStorage tables (parse to preserve structure cleanly)
  const localStorageBundle: Record<string, unknown> = {};
  for (const key of LS_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      localStorageBundle[key] = JSON.parse(raw);
    } catch {
      localStorageBundle[key] = raw; // store as raw string if not JSON
    }
  }

  const preferences: Record<string, string | null> = {};
  for (const key of PREFS_KEYS) {
    preferences[key] = localStorage.getItem(key);
  }

  // IndexedDB images
  const tx = db.transaction(IMAGE_STORE, 'readonly');
  const store = tx.objectStore(IMAGE_STORE);
  const keys = await store.getAllKeys();
  const blobs = await store.getAll();
  await tx.done;

  const images: BackupBundle['images'] = [];
  for (let i = 0; i < keys.length; i++) {
    const id = String(keys[i]);
    const blob = blobs[i] as Blob | undefined;
    if (!blob) continue;
    const data = await blobToBase64(blob);
    images.push({ id, mediaType: blob.type || 'image/jpeg', data });
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'iptyeong-english-habit',
    localStorage: localStorageBundle,
    preferences,
    images,
  };
}

export async function importAll(bundle: BackupBundle, opts: { merge?: boolean } = {}): Promise<{
  sessions: number;
  expressions: number;
  writings: number;
  images: number;
}> {
  if (!bundle || bundle.app !== 'iptyeong-english-habit') {
    throw new Error('백업 파일 형식이 올바르지 않습니다.');
  }
  if (typeof bundle.version !== 'number' || bundle.version > BACKUP_VERSION) {
    throw new Error(`이 앱이 알지 못하는 백업 버전입니다: ${bundle.version}`);
  }

  if (!opts.merge) {
    // Wipe existing local state first.
    for (const key of LS_KEYS) localStorage.removeItem(key);
    // Preferences merge always (keep user's current preferences unless backup overrides).
    const db = await getDB();
    await db.clear(IMAGE_STORE);
  }

  // Restore localStorage tables
  for (const key of LS_KEYS) {
    const value = bundle.localStorage?.[key];
    if (value == null) continue;
    if (opts.merge) {
      // Merge arrays by id; otherwise overwrite.
      const existing = readJSON<unknown>(key, null);
      if (Array.isArray(existing) && Array.isArray(value)) {
        const ids = new Set(value.map((v: { id?: string }) => v.id));
        const merged = [
          ...value,
          ...existing.filter((v: { id?: string }) => !ids.has(v.id)),
        ];
        localStorage.setItem(key, JSON.stringify(merged));
        continue;
      }
      if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const merged = { ...(existing as object), ...(value as object) };
        localStorage.setItem(key, JSON.stringify(merged));
        continue;
      }
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Restore preferences (always merge — don't blow away user's playback/theme)
  for (const [key, value] of Object.entries(bundle.preferences ?? {})) {
    if (value != null && !localStorage.getItem(key)) {
      localStorage.setItem(key, value);
    }
  }

  // Restore IndexedDB images
  const db = await getDB();
  const tx = db.transaction(IMAGE_STORE, 'readwrite');
  const store = tx.objectStore(IMAGE_STORE);
  let imageCount = 0;
  for (const img of bundle.images ?? []) {
    const blob = base64ToBlob(img.data, img.mediaType);
    await store.put(blob, img.id);
    imageCount++;
  }
  await tx.done;

  const sessions = Array.isArray(bundle.localStorage?.['iptyeong.sessions.v1'])
    ? (bundle.localStorage['iptyeong.sessions.v1'] as unknown[]).length
    : 0;
  const expressions = Array.isArray(bundle.localStorage?.['iptyeong.expressions.v1'])
    ? (bundle.localStorage['iptyeong.expressions.v1'] as unknown[]).length
    : 0;
  const writings = Array.isArray(bundle.localStorage?.['iptyeong.writings.v1'])
    ? (bundle.localStorage['iptyeong.writings.v1'] as unknown[]).length
    : 0;
  return { sessions, expressions, writings, images: imageCount };
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function downloadBackup(bundle: BackupBundle): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = bundle.exportedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `iptyeong-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readBundleFromFile(file: File): Promise<BackupBundle> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as BackupBundle;
        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('JSON parse failed'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsText(file);
  });
}
