export type ExpressionType =
  | 'idiom'
  | 'phrasal_verb'
  | 'collocation'
  | 'sentence'
  | 'vocabulary'
  | string;

export interface SimilarExpression {
  en: string;
  ko: string;
}

export interface MyExample {
  id: string;
  userSentence: string;
  isNatural: boolean;
  corrected: string;
  feedback: string;
  better: string;
  createdAt: string;
}

export interface Expression {
  id: string;
  sessionId: string;
  english: string;
  korean: string;
  type: ExpressionType;
  exampleFromText: string;
  createdAt: string; // ISO 8601
  // Phase 3 — added on demand and cached to avoid repeat API calls.
  similar?: SimilarExpression[];
  extraExamples?: string[];
  myExamples?: MyExample[];
  // Phase 4 — flashcard memorization state.
  memorized?: boolean;
  lastReviewed?: string; // ISO 8601
  // Phase 7 — user-bookmarked for the Saved page.
  bookmarked?: boolean;
}

export interface Session {
  id: string;
  createdAt: string; // ISO 8601
  weekKey: string; // e.g. "2026-W25" (ISO week)
  topic: string;
  imageId: string; // key in IndexedDB images store
  imageMediaType: string;
  expressionIds: string[];
}

// ---------- API response shapes ----------

export interface ExtractResponse {
  topic: string;
  expressions: Array<{
    english: string;
    korean: string;
    type: string;
    exampleFromText: string;
  }>;
}

export interface EnrichResponse {
  similar: SimilarExpression[];
  extraExamples: string[];
}

export interface SentenceFeedbackResponse {
  isNatural: boolean;
  corrected: string;
  feedback: string;
  better: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Natural-language content used for replay AND for Anthropic API context. */
  content: string;
  /** Assistant only — the Korean comment / suggestion portion. */
  reply?: string;
  /** Assistant only — alternative English phrasings for the user's prior turn. */
  paraphrases?: string[];
  /** Assistant only — the next English question portion. */
  nextQuestion?: string;
  createdAt: string;
}

export interface ConversationResponse {
  reply: string;
  paraphrases?: string[];
  nextQuestion: string;
}

export interface WritingCorrection {
  original: string;
  fixed: string;
  why: string;
}

export interface WritingFeedback {
  corrections: WritingCorrection[];
  overall: string;
  modelAnswer: string;
}

export interface WritingPiece {
  id: string;
  sessionId: string;
  topic: string;
  prompt: string;
  userText: string;
  feedback?: WritingFeedback;
  createdAt: string;
}

export interface WritingPromptResponse {
  prompt: string;
}

export type WritingFeedbackResponse = WritingFeedback;
