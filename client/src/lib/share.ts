// Plain-text formatters for sharing. The output is intentionally human-readable
// (no Markdown/HTML) so it pastes cleanly into Notion, KakaoTalk, Mail, Notes,
// etc. via the native share sheet or clipboard.

import type { Expression, Session, WritingPiece } from '../types';

function indent(s: string, prefix = '   '): string {
  return s
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

export function buildExpressionShareText(
  expression: Expression,
  session?: Session | null,
): string {
  const lines: string[] = [];

  lines.push(`📌 ${expression.english}`);
  lines.push(`   ${expression.korean}`);
  if (expression.type) lines.push(`   [${expression.type}]`);
  lines.push('');

  if (expression.exampleFromText) {
    lines.push('📖 교재 예문');
    lines.push(`   "${expression.exampleFromText}"`);
    lines.push('');
  }

  if (expression.similar && expression.similar.length > 0) {
    lines.push('💡 유사 표현');
    for (const s of expression.similar) {
      lines.push(`   • ${s.en} — ${s.ko}`);
    }
    lines.push('');
  }

  if (expression.extraExamples && expression.extraExamples.length > 0) {
    lines.push('📝 추가 예문');
    for (const e of expression.extraExamples) {
      lines.push(`   "${e}"`);
    }
    lines.push('');
  }

  if (expression.myExamples && expression.myExamples.length > 0) {
    lines.push('✍️ 내 문장');
    for (const m of expression.myExamples) {
      lines.push(`   - ${m.userSentence}`);
      if (m.corrected && m.corrected !== m.userSentence) {
        lines.push(`     → ${m.corrected}`);
      }
      if (m.better && m.better !== m.corrected) {
        lines.push(`     ★ ${m.better}`);
      }
      if (m.feedback) {
        lines.push(`     ${m.feedback}`);
      }
    }
    lines.push('');
  }

  if (session) {
    lines.push(
      `— 출처: ${session.topic} (${new Date(session.createdAt).toLocaleDateString()})`,
    );
  }

  return lines.join('\n').trim();
}

export function buildWritingShareText(piece: WritingPiece): string {
  const lines: string[] = [];

  lines.push(`📝 영작 — ${piece.topic}`);
  lines.push('');
  lines.push('❓ 과제');
  lines.push(indent(piece.prompt));
  lines.push('');
  lines.push('✏️ 내가 쓴 글');
  lines.push(indent(piece.userText));
  lines.push('');

  if (piece.feedback) {
    const { corrections, overall, modelAnswer } = piece.feedback;

    if (corrections.length > 0) {
      lines.push(`🔧 교정 (${corrections.length})`);
      for (const c of corrections) {
        lines.push(`   원문: ${c.original}`);
        lines.push(`   교정: ${c.fixed}`);
        if (c.why) lines.push(`   이유: ${c.why}`);
        lines.push('');
      }
    }

    if (overall) {
      lines.push('💬 총평');
      lines.push(indent(overall));
      lines.push('');
    }

    if (modelAnswer) {
      lines.push('⭐ 모범 답안');
      lines.push(indent(modelAnswer));
      lines.push('');
    }
  }

  lines.push(`— ${new Date(piece.createdAt).toLocaleString()}`);
  return lines.join('\n').trim();
}
