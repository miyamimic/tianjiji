import type { Character, MessageSegment } from '../data/types';

/**
 * Intelligent and robust segment parser for RP dialogue.
 * 
 * Rules:
 * 1. Thought (心理活动 / 潜意识 / 内心独白):
 *    - Wrapped in single asterisks: *...* (excluding **bold**)
 *    - Wrapped in asterisk parentheses: *（...）* or *(...)* or （*...*）
 *    - Examples: *难道我让他不开心了？*, *（心里软了一块）*
 * 
 * 2. Action (动作神态描写 / 空间体态细节):
 *    - Wrapped in fullwidth parentheses: （...）
 *    - Wrapped in halfwidth parentheses: (...)
 *    - Wrapped in brackets: 【...】 or [...]
 *    - Examples: （修长指尖轻扣桌面，居高临下地审视着你）, (拉住手腕)
 * 
 * 3. Speech (说话台词 / 口语对白):
 *    - Wrapped in quotes: “...”, "...", 「...」, 『...』
 *    - Or standard narrative conversational sentences
 */

export function parseSegments(rawText: string): MessageSegment[] {
  if (!rawText) return [];
  const text = rawText.trim();
  if (!text) return [];

  const segments: MessageSegment[] = [];

  // Match token patterns in order of priority:
  // 1. Thought wrapped in *（...）* or *...* (ensuring not markdown bold **)
  // 2. Action wrapped in （...） or (...) or 【...】
  // 3. Speech wrapped in “...” or "..." or 「...」
  const TOKEN_REGEX = /(\*(?:（|\()?([^*]+?)(?:）|\))?\*)|(（([^*）]+?)）|\(([^*)]+?)\)|【([^】]+?)】)|(“([^”]+?)”|"([^"]+?)"|「([^」]+?)」|『([^』]+?)』)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    // 1. Unmatched text before this token
    if (match.index > lastIndex) {
      const priorText = text.slice(lastIndex, match.index).trim();
      if (priorText) {
        // Classify loose text
        classifyLooseText(priorText, segments);
      }
    }

    const fullMatch = match[0];
    
    // Group 1: Thought (*...*)
    if (match[1]) {
      const thoughtContent = (match[2] || fullMatch.replace(/^\*|\*$/g, '')).trim();
      if (thoughtContent) {
        segments.push({ type: 'thought', text: thoughtContent });
      }
    }
    // Group 3: Action (（...） or (...) or 【...】)
    else if (match[3]) {
      const actionContent = (match[4] || match[5] || match[6] || fullMatch.replace(/^[（(【]|[）)】]$/g, '')).trim();
      if (actionContent) {
        // If content inside parentheses begins and ends with *, treat as thought
        if (/^\*.*\*$/.test(actionContent)) {
          segments.push({ type: 'thought', text: actionContent.replace(/^\*+|\*+$/g, '').trim() });
        } else {
          segments.push({ type: 'action', text: actionContent });
        }
      }
    }
    // Group 7: Speech (“...” or "..." or 「...」)
    else if (match[7]) {
      const speechContent = (match[8] || match[9] || match[10] || match[11] || fullMatch).trim();
      if (speechContent) {
        segments.push({ type: 'speech', text: speechContent });
      }
    }

    lastIndex = match.index + fullMatch.length;
  }

  // 2. Remaining tail text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      classifyLooseText(remaining, segments);
    }
  }

  // Fallback: If nothing was matched, treat whole text as speech
  if (segments.length === 0) {
    segments.push({ type: 'speech', text });
  }

  return segments;
}

/**
 * Helper to classify text outside explicit brackets/quotes
 */
function classifyLooseText(text: string, segments: MessageSegment[]) {
  // Check if text is an unclosed thought like *心里一震
  if (text.startsWith('*') && !text.endsWith('*')) {
    segments.push({ type: 'thought', text: text.replace(/^\*+/, '').trim() });
    return;
  }
  // Check if text is an unclosed action like （走上前
  if ((text.startsWith('（') || text.startsWith('(')) && !(text.endsWith('）') || text.endsWith(')'))) {
    segments.push({ type: 'action', text: text.replace(/^[（(]/, '').trim() });
    return;
  }

  // If text is standard dialogue or narrative
  segments.push({ type: 'speech', text });
}

export function segmentsToText(segments: MessageSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'thought') return `*${s.text}*`;
      if (s.type === 'action') return `（${s.text}）`;
      return s.text;
    })
    .join('\n');
}

/**
 * Non-destructive postprocessor:
 * Parses segments cleanly without blindly overriding, corrupting pronouns,
 * or forcibly injecting repetitive template phrases.
 */
export function runPostprocessor(rawText: string, _character?: Character) {
  const segments = parseSegments(rawText);
  const cleaned = segmentsToText(segments);

  return {
    segments,
    cleaned_text: cleaned,
    action_valid: true,
  };
}
