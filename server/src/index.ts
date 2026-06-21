import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { toFile } from 'openai';

export type ServerOptions = {
  port?: number;
  clientDist?: string;
};

export type ServerHandle = {
  port: number;
  close: () => Promise<void>;
};

const MODEL = 'claude-sonnet-4-6';

const EXTRACT_SYSTEM_PROMPT = `너는 영어 교재의 핵심 표현을 뽑아주는 코치다. 한국어 중급 학습자가 외울 가치가 있는 표현(숙어/동사구/콜로케이션/유용한 문장)을 8~15개 골라라. 반드시 아래 JSON만 출력. 다른 텍스트·마크다운 금지.

JSON 스키마:
{
  "topic": "이 페이지의 짧은 주제 (한국어, 한 줄)",
  "expressions": [
    {
      "english": "원문에 등장한 영어 표현 또는 문장",
      "korean": "한국어 의미·뉘앙스 (간결하게)",
      "type": "idiom | phrasal_verb | collocation | sentence | vocabulary 중 하나",
      "exampleFromText": "교재 페이지에서 가져온 짧은 예문 (없으면 빈 문자열)"
    }
  ]
}`;

const ENRICH_SYSTEM_PROMPT = `너는 영어 학습자를 돕는 코치다. 주어진 영어 표현에 대해:
1) 비슷한 의미의 영어 표현(동의어/유사표현) 2~3개
2) 그 표현(원본 표현)을 활용한 자연스러운 새 예문 2개
를 만들어라. 반드시 아래 JSON만 출력. 마크다운·설명 금지.

JSON 스키마:
{
  "similar": [
    { "en": "유사 영어 표현", "ko": "한국어 의미" }
  ],
  "extraExamples": [
    "원본 표현을 자연스럽게 쓴 영어 예문",
    "또 다른 영어 예문"
  ]
}`;

const SENTENCE_FEEDBACK_SYSTEM_PROMPT = `너는 영어 학습자의 작문을 첨삭하는 친절한 코치다.
주어진 영어 표현을 활용해 사용자가 쓴 영어 문장을 평가하고 교정해라.
반드시 아래 JSON만 출력. 마크다운·설명 금지.

JSON 스키마:
{
  "isNatural": true 또는 false (원어민이 보기에 자연스럽고 문법적으로 맞는지),
  "corrected": "문법·자연스러움을 살린 교정 영어 문장 (학습자 문장을 최소한으로 수정)",
  "feedback": "왜 그렇게 교정했는지 한국어로 1~2문장 (없으면 빈 문자열)",
  "better": "같은 의미를 더 자연스럽고 풍부하게 표현한 영어 (corrected와 같아도 됨)"
}`;

function buildConversationSystemPrompt(
  topic: string,
  expressions: Array<{ english: string; korean: string }>,
): string {
  const exprLines = expressions
    .map((e) => `- "${e.english}" (${e.korean})`)
    .join('\n');
  return `너는 한국어 학습자에게 영어 회화를 가르치는 친절하고 격려를 잘하는 코치다.

오늘의 대화 주제: ${topic}

학습자가 이번에 외운 핵심 표현 (가능하면 이 표현을 활용한 질문으로 유도):
${exprLines || '(표현 없음 — 주제 위주로 진행)'}

행동 규칙:
1) 학습자의 영어 수준은 중급. 너무 어려운 표현은 피한다.
2) 한 번에 영어 질문 하나만 한다.
3) 학습자 답이 오면 reply에 한국어로 짧게 칭찬/코멘트를 하고, 답이 어색하면 자연스러운 영어 한 가지를 큰따옴표로 제안한다 (예: '"I'd like to" 가 더 자연스러워요.').
4) paraphrases는 학습자가 직전에 보낸 영어 문장을 같은 의미로 풀어쓴 자연스러운 영어 표현 2~3개를 담는다. 다양한 어휘·문장 구조로 다채롭게.
   - 학습자가 영어 문장을 안 보냈거나(인사/한국어/시작 트리거) 매우 짧은 단답인 경우 paraphrases는 빈 배열 [] 로 둔다.
5) nextQuestion에는 새 영어 질문 하나를 던진다.
6) 대화의 첫 응답(history가 비었거나 첫 사용자 메시지가 시작 트리거일 때)이면 reply에 짧은 인사를 넣는다.
7) 절대 마크다운, 코드펜스, 여분의 텍스트를 출력하지 말 것.

반드시 아래 JSON만 출력:
{
  "reply": "한국어 코멘트 (필요하면 \\"영어 제안\\" 포함)",
  "paraphrases": ["같은 의미 다른 표현 1", "다른 표현 2", "다른 표현 3"],
  "nextQuestion": "다음 영어 질문 한 개"
}`;
}

const WRITING_PROMPT_SYSTEM_PROMPT = `너는 한국어 영어 학습자에게 짧은 영작 과제를 출제하는 코치다.
주어진 주제와 핵심 표현을 활용해 학습자가 3~5문장으로 답하기 좋은 영작 과제 한 개를 출제하라.

행동 규칙:
1) 과제는 한국어로 작성한다 (학습자가 명확히 이해하도록).
2) 짧고 구체적인 한 줄로. 추상적이지 않게, 학습자의 개인 경험과 연결되도록 유도.
3) 가능하면 핵심 표현 중 하나를 자연스럽게 활용할 만한 상황으로 만든다.

반드시 아래 JSON만 출력:
{
  "prompt": "과제 텍스트 (한국어, 한 줄)"
}`;

const WRITING_FEEDBACK_SYSTEM_PROMPT = `너는 친절하고 꼼꼼한 영어 작문 첨삭 코치다.
주어진 영작 과제에 대해 학습자가 쓴 영어 글을 평가·교정해라.

행동 규칙:
1) corrections 배열: 학습자 문장 중 고칠 부분을 항목으로 담는다.
   - original: 원문 그대로 인용한 영어 문장(또는 구).
   - fixed: 자연스러운 영어로 교정한 결과.
   - why: 왜 그렇게 고쳤는지 한국어로 1~2문장.
   - 문제 없는 문장은 corrections에 포함하지 않는다.
2) overall: 학습자의 영작 전반에 대한 한국어 총평 (잘한 점 + 개선점) 2~3문장.
3) modelAnswer: 같은 과제에 대한 자연스럽고 풍부한 영어 모범 답안 4~5문장. 학습자 답안과 너무 똑같지 않게.

반드시 아래 JSON만 출력:
{
  "corrections": [
    { "original": "원문", "fixed": "교정", "why": "한국어 이유" }
  ],
  "overall": "한국어 총평",
  "modelAnswer": "영어 모범 답안 4~5문장"
}`;

export const createAnthropic = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

function buildCorsOptions(): cors.CorsOptions {
  const raw = process.env.ALLOWED_ORIGIN?.trim();
  if (!raw) return { origin: true, credentials: false };

  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      cb(null, allowed.includes(origin));
    },
    credentials: false,
  };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fence) return fence[1].trim();
  return trimmed;
}

// Find the first top-level balanced { ... } block in a string. Handles strings
// with escaped quotes correctly. Returns null if no balanced object is found.
function extractBalancedJSONObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function parseJSONLoose(text: string): unknown {
  const stripped = stripCodeFence(text);
  // Fast path: direct parse.
  try {
    return JSON.parse(stripped);
  } catch {
    // Fall through.
  }
  // Recovery path: extract a balanced { ... } and try again. This rescues
  // responses where the model added a brief preamble or epilogue around its
  // JSON despite our prompt + prefill.
  const block = extractBalancedJSONObject(stripped);
  if (!block) {
    throw new Error('No balanced JSON object found in response');
  }
  return JSON.parse(block);
}

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm. Map the MIME types
// MediaRecorder emits across browsers to a filename extension Whisper expects.
const AUDIO_MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mp4;codecs=mp4a.40.2': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

function audioExtFromMediaType(mediaType: string): string | null {
  // Some browsers (Safari) include trailing parameters in the type; normalize.
  const normalized = mediaType.toLowerCase().split(';')[0].trim();
  return (
    AUDIO_MIME_TO_EXT[mediaType.toLowerCase()] ??
    AUDIO_MIME_TO_EXT[normalized] ??
    null
  );
}

// ---------- shared Claude-as-JSON helper ----------

type ImagePart = {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};

type ChatRole = 'user' | 'assistant';
type ChatTurn = { role: ChatRole; content: string };

async function callClaudeForJSON(args: {
  system: string;
  /** Single-turn user prompt. Mutually exclusive with `messages`. */
  userText?: string;
  /** Multi-turn conversation. If provided, replaces `userText`. */
  messages?: ChatTurn[];
  image?: ImagePart;
  maxTokens: number;
}): Promise<{ parsed: unknown; rawText: string }> {
  const anthropic = createAnthropic();

  // Append a JSON-only reminder to the final user turn. The model often
  // drifts to natural prose during multi-turn chat; reinforcing the format
  // requirement RIGHT before the model speaks meaningfully cuts the failure
  // rate. (sonnet-4-6 rejects assistant-message prefill, so this is the
  // most compatible nudge.)
  const lastUserReminder =
    '\n\n[형식 지시] 위 시스템 프롬프트의 JSON 스키마 그대로 응답해라. 마크다운·코드펜스·인사·여분 텍스트 금지. JSON 객체만 출력.';

  const builtMessages =
    args.messages && args.messages.length > 0
      ? args.messages.map((m, idx, arr) => {
          const isLastUserTurn = idx === arr.length - 1 && m.role === 'user';
          const content = isLastUserTurn ? m.content + lastUserReminder : m.content;
          return {
            role: m.role,
            content: [{ type: 'text' as const, text: content }],
          };
        })
      : [
          {
            role: 'user' as const,
            content: args.image
              ? [
                  {
                    type: 'image' as const,
                    source: {
                      type: 'base64' as const,
                      media_type: args.image.mediaType,
                      data: args.image.base64,
                    },
                  },
                  {
                    type: 'text' as const,
                    text: (args.userText ?? '') + lastUserReminder,
                  },
                ]
              : [
                  {
                    type: 'text' as const,
                    text: (args.userText ?? '') + lastUserReminder,
                  },
                ],
          },
        ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: builtMessages,
  });

  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) {
    const err = new Error('Claude returned an empty response.');
    (err as Error & { httpStatus?: number }).httpStatus = 500;
    throw err;
  }

  try {
    return { parsed: parseJSONLoose(text), rawText: text };
  } catch (parseErr) {
    const err = new Error(
      `Claude 응답을 JSON으로 파싱하지 못했습니다: ${
        parseErr instanceof Error ? parseErr.message : String(parseErr)
      }`,
    );
    (err as Error & { httpStatus?: number; raw?: string }).httpStatus = 500;
    (err as Error & { httpStatus?: number; raw?: string }).raw = text;
    throw err;
  }
}

function sendError(res: express.Response, err: unknown) {
  console.error('[server] error:', err);
  const e = err as Error & { httpStatus?: number; raw?: string };
  const status = e?.httpStatus ?? 500;
  const body: Record<string, unknown> = {
    error: e?.message ?? 'unknown error',
  };
  if (e?.raw) body.raw = e.raw;
  res.status(status).json(body);
}

function ensureApiKey(res: express.Response): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  return false;
}

// ---------- request shapes ----------

type ExtractRequest = {
  imageBase64?: unknown;
  mediaType?: unknown;
};

type EnrichRequest = {
  expression?: {
    english?: unknown;
    korean?: unknown;
  };
};

type SentenceFeedbackRequest = {
  expression?: {
    english?: unknown;
    korean?: unknown;
  };
  userSentence?: unknown;
};

type TranscribeRequest = {
  audioBase64?: unknown;
  mediaType?: unknown;
};

type ConversationRequest = {
  topic?: unknown;
  expressions?: unknown;
  history?: unknown;
};

type WritingPromptRequest = {
  topic?: unknown;
  expressions?: unknown;
};

type WritingFeedbackRequest = {
  topic?: unknown;
  prompt?: unknown;
  userText?: unknown;
};

export async function startServer(opts: ServerOptions = {}): Promise<ServerHandle> {
  const port = opts.port ?? Number(process.env.PORT ?? 8787);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      '[warn] ANTHROPIC_API_KEY is not set. Set it in .env (dev) or your host\'s env (prod).',
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      '[warn] OPENAI_API_KEY is not set. /api/transcribe will return 500.',
    );
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'iptyeong-server',
      hasApiKey: Boolean(apiKey),
      time: new Date().toISOString(),
    });
  });

  // ---------- /api/extract ----------
  app.post('/api/extract', async (req, res) => {
    const body = req.body as ExtractRequest;
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
    const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : '';

    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({
        error: `mediaType must be one of: ${[...ALLOWED_MEDIA_TYPES].join(', ')}`,
      });
    }
    if (!ensureApiKey(res)) return;

    try {
      const { parsed } = await callClaudeForJSON({
        system: EXTRACT_SYSTEM_PROMPT,
        userText: '이 교재 페이지에서 핵심 표현을 추출해 위 JSON 스키마로만 응답해줘.',
        image: {
          base64: imageBase64,
          mediaType: mediaType as ImagePart['mediaType'],
        },
        maxTokens: 2048,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/enrich ----------
  app.post('/api/enrich', async (req, res) => {
    const body = req.body as EnrichRequest;
    const english = typeof body?.expression?.english === 'string' ? body.expression.english.trim() : '';
    const korean = typeof body?.expression?.korean === 'string' ? body.expression.korean.trim() : '';
    if (!english) return res.status(400).json({ error: 'expression.english is required' });
    if (!ensureApiKey(res)) return;

    const userText = [
      '대상 영어 표현:',
      `english: "${english}"`,
      `korean: "${korean}"`,
      '',
      '위 표현에 대해 similar(2~3개)과 extraExamples(2개)를 JSON 스키마대로만 응답해줘.',
    ].join('\n');

    try {
      const { parsed } = await callClaudeForJSON({
        system: ENRICH_SYSTEM_PROMPT,
        userText,
        maxTokens: 1024,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/sentence-feedback ----------
  app.post('/api/sentence-feedback', async (req, res) => {
    const body = req.body as SentenceFeedbackRequest;
    const english = typeof body?.expression?.english === 'string' ? body.expression.english.trim() : '';
    const korean = typeof body?.expression?.korean === 'string' ? body.expression.korean.trim() : '';
    const userSentence = typeof body?.userSentence === 'string' ? body.userSentence.trim() : '';
    if (!english) return res.status(400).json({ error: 'expression.english is required' });
    if (!userSentence) return res.status(400).json({ error: 'userSentence is required' });
    if (!ensureApiKey(res)) return;

    const userText = [
      '대상 표현:',
      `english: "${english}"`,
      `korean: "${korean}"`,
      '',
      '학습자 문장:',
      `"${userSentence}"`,
      '',
      '위 학습자 문장을 JSON 스키마대로 평가·교정해서 응답해줘.',
    ].join('\n');

    try {
      const { parsed } = await callClaudeForJSON({
        system: SENTENCE_FEEDBACK_SYSTEM_PROMPT,
        userText,
        maxTokens: 1024,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/conversation ----------
  app.post('/api/conversation', async (req, res) => {
    const body = req.body as ConversationRequest;
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const rawExpressions = Array.isArray(body?.expressions) ? body.expressions : [];
    const rawHistory = Array.isArray(body?.history) ? body.history : [];

    const expressions = rawExpressions
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const english = typeof (e as { english?: unknown }).english === 'string'
          ? (e as { english: string }).english
          : '';
        const korean = typeof (e as { korean?: unknown }).korean === 'string'
          ? (e as { korean: string }).korean
          : '';
        if (!english) return null;
        return { english, korean };
      })
      .filter((e): e is { english: string; korean: string } => e !== null);

    const history: ChatTurn[] = rawHistory
      .map((m) => {
        if (!m || typeof m !== 'object') return null;
        const role = (m as { role?: unknown }).role;
        const content = (m as { content?: unknown }).content;
        if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
          return null;
        }
        return { role, content };
      })
      .filter((m): m is ChatTurn => m !== null);

    if (!topic) return res.status(400).json({ error: 'topic is required' });
    if (!ensureApiKey(res)) return;

    // Empty conversation → coach should greet and ask the first question.
    const messages: ChatTurn[] =
      history.length === 0
        ? [{ role: 'user', content: '안녕, 오늘 회화를 시작하자.' }]
        : history;

    try {
      const { parsed } = await callClaudeForJSON({
        system: buildConversationSystemPrompt(topic, expressions),
        messages,
        maxTokens: 768,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/writing-prompt ----------
  app.post('/api/writing-prompt', async (req, res) => {
    const body = req.body as WritingPromptRequest;
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const rawExpressions = Array.isArray(body?.expressions) ? body.expressions : [];

    const expressions = rawExpressions
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const english = typeof (e as { english?: unknown }).english === 'string'
          ? (e as { english: string }).english
          : '';
        const korean = typeof (e as { korean?: unknown }).korean === 'string'
          ? (e as { korean: string }).korean
          : '';
        if (!english) return null;
        return { english, korean };
      })
      .filter((e): e is { english: string; korean: string } => e !== null);

    if (!topic) return res.status(400).json({ error: 'topic is required' });
    if (!ensureApiKey(res)) return;

    const exprLines =
      expressions.length > 0
        ? expressions.map((e) => `- "${e.english}" (${e.korean})`).join('\n')
        : '(표현 없음 — 주제만 사용)';

    const userText = [
      `주제: ${topic}`,
      '핵심 표현:',
      exprLines,
      '',
      '위 주제와 표현으로 학습자에게 낼 짧은 영작 과제 1개를 한국어로 만들어줘.',
    ].join('\n');

    try {
      const { parsed } = await callClaudeForJSON({
        system: WRITING_PROMPT_SYSTEM_PROMPT,
        userText,
        maxTokens: 256,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/writing-feedback ----------
  app.post('/api/writing-feedback', async (req, res) => {
    const body = req.body as WritingFeedbackRequest;
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const userText = typeof body?.userText === 'string' ? body.userText.trim() : '';

    if (!topic) return res.status(400).json({ error: 'topic is required' });
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (!userText) return res.status(400).json({ error: 'userText is required' });
    if (!ensureApiKey(res)) return;

    const claudeUserText = [
      `주제: ${topic}`,
      '',
      `과제: ${prompt}`,
      '',
      '학습자 영작:',
      `"""`,
      userText,
      `"""`,
      '',
      '위 영작을 평가하고 교정해줘.',
    ].join('\n');

    try {
      const { parsed } = await callClaudeForJSON({
        system: WRITING_FEEDBACK_SYSTEM_PROMPT,
        userText: claudeUserText,
        maxTokens: 1536,
      });
      res.json(parsed);
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- /api/transcribe (OpenAI Whisper) ----------
  app.post('/api/transcribe', async (req, res) => {
    const body = req.body as TranscribeRequest;
    const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64 : '';
    const mediaType = typeof body?.mediaType === 'string' ? body.mediaType : '';
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required' });
    if (!mediaType) return res.status(400).json({ error: 'mediaType is required' });

    const ext = audioExtFromMediaType(mediaType);
    if (!ext) {
      return res.status(400).json({
        error: `unsupported audio mediaType: ${mediaType}`,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    }

    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'audio payload is empty' });
      }
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const file = await toFile(buffer, `audio.${ext}`, { type: mediaType });
      const result = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'en',
      });
      res.json({ text: result.text ?? '' });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---------- static client (prod only) ----------
  if (opts.clientDist && fs.existsSync(opts.clientDist)) {
    const clientDist = opts.clientDist;
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return new Promise<ServerHandle>((resolve) => {
    const httpServer = app.listen(port, () => {
      console.log(`[server] listening on http://localhost:${port}`);
      resolve({
        port,
        close: () =>
          new Promise<void>((r) => {
            httpServer.close(() => r());
          }),
      });
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
