// Plain-text formatters for sharing. The output is intentionally human-readable
// (no Markdown/HTML) so it pastes cleanly into Notion, KakaoTalk, Mail, Notes,
// etc. via the native share sheet or clipboard.

import type { Expression, Session, WritingPiece } from '../types';
import type { DayActivity } from './review';

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

/**
 * 한 날의 모든 학습 내용을 하나의 텍스트 블록으로 묶는다.
 * - 세션(주제)
 * - 추출된 표현 (영어/한국어/유형/교재 예문/유사 표현/갈무리·암기 상태)
 * - 회화 메시지 (코치 응답에 paraphrases 포함)
 * - 영작 (과제·내 글·교정·총평·모범 답안)
 */
export function buildDayShareText(activity: DayActivity): string {
  const lines: string[] = [];

  lines.push(`📅 ${activity.date} 학습 기록`);
  lines.push('');

  // ----- 세션 -----
  if (activity.sessions.length > 0) {
    lines.push(`🎯 세션 (${activity.sessions.length})`);
    for (const s of activity.sessions) {
      const time = new Date(s.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push(`   • ${s.topic} (${time})`);
    }
    lines.push('');
  }

  // ----- 추출된 표현 -----
  if (activity.expressionsAdded.length > 0) {
    lines.push(`📌 추출한 표현 (${activity.expressionsAdded.length})`);
    lines.push('');
    activity.expressionsAdded.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.english}`);
      lines.push(`   ${e.korean}`);
      if (e.type) lines.push(`   [${e.type}]`);
      if (e.exampleFromText) {
        lines.push(`   교재 예문: "${e.exampleFromText}"`);
      }
      if (e.similar && e.similar.length > 0) {
        lines.push(`   💡 유사:`);
        for (const s of e.similar) {
          lines.push(`      • ${s.en} — ${s.ko}`);
        }
      }
      if (e.extraExamples && e.extraExamples.length > 0) {
        lines.push(`   📝 추가 예문:`);
        for (const ex of e.extraExamples) {
          lines.push(`      "${ex}"`);
        }
      }
      if (e.myExamples && e.myExamples.length > 0) {
        lines.push(`   ✍️ 내 문장 ${e.myExamples.length}개`);
      }
      const tags: string[] = [];
      if (e.bookmarked) tags.push('★ 갈무리');
      if (e.memorized === true) tags.push('✓ 암기');
      if (e.memorized === false && e.lastReviewed) tags.push('↻ 다시');
      if (tags.length > 0) lines.push(`   ${tags.join(' · ')}`);
      lines.push('');
    });
  }

  // ----- 회화 (paraphrases 포함) -----
  if (activity.conversationMessages.length > 0) {
    lines.push(`💬 회화 (${activity.conversationMessages.length}개 메시지)`);
    for (const m of activity.conversationMessages) {
      if (m.role === 'user') {
        lines.push(`   [나] ${m.content}`);
      } else {
        if (m.reply) lines.push(`   [코치] ${m.reply}`);
        if (m.paraphrases && m.paraphrases.length > 0) {
          lines.push(`      💡 같은 의미 다른 표현:`);
          for (const p of m.paraphrases) {
            lines.push(`      • ${p}`);
          }
        }
        if (m.nextQuestion) lines.push(`   [코치] ${m.nextQuestion}`);
      }
    }
    lines.push('');
  }

  // ----- 영작 -----
  if (activity.writings.length > 0) {
    lines.push(`📝 영작 (${activity.writings.length})`);
    activity.writings.forEach((w, i) => {
      if (i > 0) lines.push('');
      lines.push(`   ❓ ${w.prompt}`);
      lines.push('');
      lines.push(`   ✏️ 내가 쓴 글:`);
      lines.push(indent(w.userText, '      '));
      if (w.feedback) {
        if (w.feedback.corrections.length > 0) {
          lines.push('');
          lines.push(`   🔧 교정 ${w.feedback.corrections.length}건:`);
          for (const c of w.feedback.corrections) {
            lines.push(`      • "${c.original}"`);
            lines.push(`        → "${c.fixed}"`);
            if (c.why) lines.push(`        ${c.why}`);
          }
        }
        if (w.feedback.overall) {
          lines.push('');
          lines.push(`   💬 총평: ${w.feedback.overall}`);
        }
        if (w.feedback.modelAnswer) {
          lines.push('');
          lines.push(`   ⭐ 모범 답안:`);
          lines.push(indent(w.feedback.modelAnswer, '      '));
        }
      }
    });
    lines.push('');
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
