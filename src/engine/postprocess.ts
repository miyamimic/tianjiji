import type { Character, MessageSegment } from '../data/types';

const FORBIDDEN_ADVERBS = [
  '冷静地', '温柔地', '愤怒地', '冷冷地', '淡淡地', '轻声地', '大声地',
  '不悦地', '开心地', '悲伤地', '默默地', '缓缓地', '慢慢地', '快速地',
  '突然地', '淡淡地说', '冷冷地说', '温柔地说', '愤怒地说',
  '低声', '沉声', '冷声', '柔声',
];

const PRONOUN_PATTERNS: [RegExp, string][] = [
  [/他说/g, '我说'],
  [/她说/g, '我说'],
  [/他想/g, '我想'],
  [/她想/g, '我想'],
  [/他的手/g, '我的手'],
  [/她的手/g, '我的手'],
  [/他的/g, '我的'],
  [/她的/g, '我的'],
  [/^他/m, '我'],
  [/^她/m, '我'],
];

export function cleanPronouns(text: string): string {
  let result = text;
  for (const [pat, rep] of PRONOUN_PATTERNS) {
    result = result.replace(pat, rep);
  }
  return result;
}

export function cleanAdverbs(text: string, touchActions: string[]): string {
  if (touchActions.length === 0) return text;
  let result = text;
  for (const adverb of FORBIDDEN_ADVERBS) {
    if (result.includes(adverb)) {
      const touch = touchActions[Math.floor(Math.random() * touchActions.length)];
      result = result.replace(new RegExp(escapeRegExp(adverb) + '[，,]?', 'g'), `*${touch}*，`);
    }
  }
  result = result.replace(/，，+/g, '，');
  result = result.replace(/\*，/g, '*，');
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEGMENT_REGEX = /(\*[^*]+\*)|(\([^)]+\))|(（[^）]+）)/g;

export function parseSegments(rawText: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const text = rawText.trim();
  if (!text) return segments;

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  SEGMENT_REGEX.lastIndex = 0;
  while ((m = SEGMENT_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const speech = text.slice(lastIndex, m.index).trim();
      if (speech) segments.push({ type: 'speech', text: speech });
    }
    const matched = m[0];
    if (matched.startsWith('*')) {
      const inner = matched.slice(1, -1).trim();
      if (inner) segments.push({ type: 'action', text: inner });
    } else {
      const inner = matched.slice(1, -1).trim();
      if (inner) segments.push({ type: 'thought', text: inner });
    }
    lastIndex = m.index + matched.length;
  }

  if (lastIndex < text.length) {
    const speech = text.slice(lastIndex).trim();
    if (speech) segments.push({ type: 'speech', text: speech });
  }

  if (segments.length === 0) {
    segments.push({ type: 'speech', text });
  }
  return segments;
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function validateActions(segments: MessageSegment[], character: Character) {
  const actionTexts = segments.filter((s) => s.type === 'action').map((s) => s.text);
  const fullText = actionTexts.join(' ');
  const at = character.action_tendency;
  const controlMatched = at.control_actions.filter((a) => containsAny(fullText, [a]));
  const touchMatched = at.touch_actions.filter((a) => containsAny(fullText, [a]));
  return {
    has_control: controlMatched.length > 0,
    has_touch: touchMatched.length > 0,
    control_matched: controlMatched,
    touch_matched: touchMatched,
  };
}

export function appendMissingActions(segments: MessageSegment[], character: Character): MessageSegment[] {
  const result = [...segments];
  const v = validateActions(result, character);
  if (!v.has_control) {
    result.push({ type: 'action', text: '按住你的肩膀' });
  }
  if (!v.has_touch) {
    result.push({ type: 'action', text: '指尖蹭过你的手背' });
  }
  return result;
}

export function segmentsToText(segments: MessageSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === 'action') return `*${s.text}*`;
      if (s.type === 'thought') return `（${s.text}）`;
      return s.text;
    })
    .join('');
}

export function runPostprocessor(rawText: string, character: Character) {
  let text = cleanPronouns(rawText);
  text = cleanAdverbs(text, character.action_tendency.touch_actions);
  let segments = parseSegments(text);

  const v = validateActions(segments, character);
  if (!v.has_control || !v.has_touch) {
    segments = appendMissingActions(segments, character);
  }

  const cleaned = segmentsToText(segments);
  return {
    segments,
    cleaned_text: cleaned,
    action_valid: v.has_control && v.has_touch,
  };
}
