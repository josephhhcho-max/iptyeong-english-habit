// Dev (Vite proxy): VITE_API_BASE_URL is unset → relative paths hit the proxy.
// Prod (PWA hosted apart from server): set VITE_API_BASE_URL to the absolute
// server origin (e.g. https://iptyeong-server.onrender.com) at build time.
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = `: ${body.error}`;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(`HTTP ${res.status} for ${path}${detail}`);
  }
  return (await res.json()) as T;
}

import type {
  ChatRole,
  ConversationResponse,
  EnrichResponse,
  ExtractResponse,
  SentenceFeedbackResponse,
  WritingFeedbackResponse,
  WritingPromptResponse,
} from '../types';

export async function extractExpressions(input: {
  imageBase64: string;
  mediaType: string;
}): Promise<ExtractResponse> {
  return apiFetch<ExtractResponse>('/api/extract', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function enrichExpression(input: {
  expression: { english: string; korean: string };
}): Promise<EnrichResponse> {
  return apiFetch<EnrichResponse>('/api/enrich', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getSentenceFeedback(input: {
  expression: { english: string; korean: string };
  userSentence: string;
}): Promise<SentenceFeedbackResponse> {
  return apiFetch<SentenceFeedbackResponse>('/api/sentence-feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function transcribeAudio(input: {
  audioBase64: string;
  mediaType: string;
}): Promise<{ text: string }> {
  return apiFetch<{ text: string }>('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sendConversation(input: {
  topic: string;
  expressions: Array<{ english: string; korean: string }>;
  history: Array<{ role: ChatRole; content: string }>;
}): Promise<ConversationResponse> {
  return apiFetch<ConversationResponse>('/api/conversation', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getWritingPrompt(input: {
  topic: string;
  expressions: Array<{ english: string; korean: string }>;
}): Promise<WritingPromptResponse> {
  return apiFetch<WritingPromptResponse>('/api/writing-prompt', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getWritingFeedback(input: {
  topic: string;
  prompt: string;
  userText: string;
}): Promise<WritingFeedbackResponse> {
  return apiFetch<WritingFeedbackResponse>('/api/writing-feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
