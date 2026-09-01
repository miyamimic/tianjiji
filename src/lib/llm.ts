export type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export interface LlmPreset {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  note?: string;
}

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const STORAGE_KEY = '__rp_engine_llm_config';
const PRESETS_STORAGE_KEY = '__rp_engine_llm_presets';
const CACHED_MODELS_STORAGE_KEY = '__rp_engine_llm_cached_models';

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl.trim() : '',
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
        model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : 'gpt-4o-mini',
      };
    }
  } catch {
    // ignore
  }
  return { baseUrl: '', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveLlmConfig(config: LlmConfig): void {
  try {
    const safeConfig: LlmConfig = {
      baseUrl: (config.baseUrl || '').trim(),
      apiKey: (config.apiKey || '').trim(),
      model: (config.model || '').trim() || 'gpt-4o-mini',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rp_engine_llm_config_saved', { detail: safeConfig }));
    }
  } catch {
    // ignore
  }
}

export function loadLlmPresets(): LlmPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Only return user-created presets (strictly filter out any legacy builtin presets)
        return parsed.filter((p: any) => p && !p.isBuiltin && typeof p.name === 'string');
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLlmPresets(presets: LlmPreset[]): void {
  try {
    const userOnly = presets.filter((p) => p && !(p as any).isBuiltin);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userOnly));
  } catch {
    // ignore
  }
}

export function loadCachedAvailableModels(): string[] {
  try {
    const raw = localStorage.getItem(CACHED_MODELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveCachedAvailableModels(models: string[]): void {
  try {
    localStorage.setItem(CACHED_MODELS_STORAGE_KEY, JSON.stringify(models));
  } catch {
    // ignore
  }
}

export function isLlmConfigured(config: LlmConfig): boolean {
  return !!(config.baseUrl && config.apiKey && config.model);
}

export async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const cleanBase = baseUrl.trim().replace(/\/$/, '');
  if (!cleanBase) {
    throw new Error('请先输入 Base URL');
  }

  const endpoints = [
    `${cleanBase}/models`,
    `${cleanBase.replace(/\/v1$/, '')}/v1/models`,
  ];

  let lastError = '';
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${await res.text().catch(() => '')}`;
        continue;
      }

      const json = await res.json();
      let modelList: string[] = [];

      if (Array.isArray(json.data)) {
        modelList = json.data
          .map((item: any) => (typeof item === 'string' ? item : item?.id))
          .filter(Boolean);
      } else if (Array.isArray(json.models)) {
        modelList = json.models
          .map((item: any) => (typeof item === 'string' ? item : item?.name || item?.id))
          .filter(Boolean);
      } else if (Array.isArray(json)) {
        modelList = json
          .map((item: any) => (typeof item === 'string' ? item : item?.id || item?.name))
          .filter(Boolean);
      }

      if (modelList.length > 0) {
        // Return unique models sorted
        return Array.from(new Set(modelList)).sort((a, b) => a.localeCompare(b));
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`抓取模型列表失败: ${lastError || '未返回可用模型列表'}`);
}

export async function analyzeVisualAvatar(
  config: LlmConfig,
  imageBase64OrUrl: string,
  targetType: 'user' | 'character',
  name?: string,
): Promise<string> {
  const isChar = targetType === 'character';
  const roleName = name || (isChar ? '角色' : '主控用户');

  // Try calling LLM Vision if configured
  if (isLlmConfigured(config)) {
    try {
      const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
      const prompt = `请作为专业二次元/写实角色扮演美术与设定导师，仔细观察并分析所上传的「${roleName}」头像/立绘图像。
请提炼生成一段沉浸式视觉外貌总结（包含：1. 发色发型与五官神态 2. 眼神气质与微表情 3. 服饰穿搭与细节配饰 4. 整体给人的氛围与体态印象）。
字数控制在100~150字，使用生动、具有画面感和沉浸感的文字描述，方便角色和系统在对话中随时调用视觉感知。直接输出提炼后的外貌描写即可，无需多余套话。`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64OrUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 350,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch {
      // fallback to intelligent heuristic parsing
    }
  }

  // Fallback intelligent heuristic profile if offline or without vision key
  if (isChar) {
    if (name?.includes('陆') || name?.includes('沉')) {
      return '深黑色利落短发，眉眼深邃而带有一丝倦意与审视感；身着微敞领口的深色定制衬衫与马甲，指节修长分明，周身带着成熟禁欲而又暗藏侵略性的危险荷尔蒙。';
    }
    if (name?.includes('野')) {
      return '微凌乱的蓬松黑碎发，眼眸狭长锐利如野兽般充满野性与占有欲；穿着简约贴身的运动背心或工装外套，肌肉线条紧绷结实，透着荷尔蒙与桀骜不驯的少年张力。';
    }
    return `面容清隽精致，眼神专注而富有穿透力；衣着风格干练典雅，举手投足间带着独特的气质气场，无论是静立还是凝视都极具视觉张力。`;
  } else {
    return `眉目柔和清澈，眼底闪烁着灵动而细腻的情绪波动；发丝柔软垂落，穿搭随性而带着亲近感，散发着让人忍不住想要靠近并探寻内心的独特吸引力。`;
  }
}

import { backgroundKeepAlive } from './backgroundKeepAlive';

export async function callLlm(
  config: LlmConfig,
  messages: LlmMessage[],
  options?: { timeoutMs?: number; maxRetries?: number }
): Promise<string> {
  const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
  const timeoutMs = options?.timeoutMs ?? 50000;
  const maxRetries = options?.maxRetries ?? 2;
  const leaseId = `llm_call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Acquire iOS background keep-alive during the network call
  backgroundKeepAlive.acquire(leaseId, 'callLlm');

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.82,
          // Generous max_tokens (2048) ensures rich 100+ character RP responses and thoughts are never cut off
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('LLM API returned unexpected response shape');
      }

      backgroundKeepAlive.release(leaseId);
      return content;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
      const isNetwork =
        isAbort ||
        err?.message?.includes('Load failed') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError');

      if (attempt < maxRetries && isNetwork) {
        const backoff = 1000 * Math.pow(1.8, attempt) + Math.random() * 300;
        console.warn(`[LLM Call Warning] Encountered ${err?.message || 'Network issue'}, retrying attempt ${attempt + 1}/${maxRetries} after ${Math.round(backoff)}ms...`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      break;
    }
  }

  backgroundKeepAlive.release(leaseId);
  throw lastError || new Error('LLM API call failed');
}

import type { Character, EmotionVector } from '../data/types';
import { 
  loadStructuredJsonPrompt, 
  loadCustomSystemPrompt,
  loadBaseSystemRolePrompt,
  loadHistoryInjectionCount,
  loadPromptLayers,
  loadCharVisualDesc,
  loadUserVisualDesc,
  loadUserPromptProfile,
  loadEmotionDecayRate,
  checkAiInterception,
  type PromptLayer,
} from './customStore';

export type StructuredLlmResponse = {
  reply: string;
  action?: string;
  thought?: string;
  emotion_intensity?: number; // 1-5
  emotion_delta?: Partial<EmotionVector>;
  triggered_memory?: string | null;
  game_invite?: {
    type: 'gomoku';
    text: string;
  } | null;
  isStructured: boolean;
};

/**
 * Strips reasoning tokens (e.g. DeepSeek-R1 / Qwen <think>...</think> tags) and chat boilerplate
 */
export function cleanRawLlmOutput(raw: string): string {
  if (!raw) return '';
  let cleaned = raw
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thought[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning[\s\S]*?<\/reasoning>/gi, '')
    .trim();
  
  // If stripping the reasoning tag leaves text completely empty (e.g. unclosed tag or only thinking tokens),
  // salvage the text inside or after the tag instead of returning an empty string
  if (!cleaned && raw.trim()) {
    const salvaged = raw.replace(/<\/?(?:think|thought|reasoning)[^>]*>/gi, '').trim();
    if (salvaged) {
      cleaned = salvaged;
    }
  }
  return cleaned;
}

/**
 * Intelligent JSON Repair for cut-off / truncated outputs
 */
export function repairTruncatedJson(jsonStr: string): string {
  let str = jsonStr.trim();
  if (!str) return '{}';

  // 1. If wrapped inside markdown, extract it first
  const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*(?:```|$)/);
  if (mdMatch && mdMatch[1]) {
    str = mdMatch[1].trim();
  }

  // 2. Scan quotes and braces stack
  let insideString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) {
      insideString = !insideString;
    } else if (!insideString) {
      if (ch === '{' || ch === '[') {
        stack.push(ch);
      } else if (ch === '}' && stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      } else if (ch === ']' && stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
    escaped = false;
  }

  // Close string if left open
  if (insideString) {
    str += '"';
  }

  // Remove trailing comma before closing
  str = str.replace(/,\s*$/, '');

  // Close remaining open brackets
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') str += '}';
    else if (open === '[') str += ']';
  }

  return str;
}

function parseSingleStructuredItem(parsed: any): StructuredLlmResponse | null {
  if (!parsed || typeof parsed !== 'object') return null;

  let reply = typeof parsed.reply === 'string' ? parsed.reply : (typeof parsed.回复文本 === 'string' ? parsed.回复文本 : '');
  const action = typeof parsed.action === 'string' ? parsed.action : (typeof parsed.动作描写 === 'string' ? parsed.动作描写 : undefined);
  const thought = typeof parsed.thought === 'string' ? parsed.thought : (typeof parsed.心理活动 === 'string' || typeof parsed.心理描写 === 'string' ? (parsed.心理活动 || parsed.心理描写) : undefined);
  const triggered_memory = typeof parsed.triggered_memory === 'string' ? parsed.triggered_memory : (typeof parsed.触发记忆 === 'string' ? parsed.触发记忆 : null);

  // Parse emotion_intensity (1-5 scale)
  let emotion_intensity: number | undefined = undefined;
  const rawIntensity = parsed.emotion_intensity ?? parsed.intensity ?? parsed.情绪强度 ?? parsed.情绪等级;
  if (typeof rawIntensity === 'number' && !isNaN(rawIntensity)) {
    emotion_intensity = Math.max(1, Math.min(5, Math.round(rawIntensity)));
  } else if (typeof rawIntensity === 'string') {
    const parsedInt = parseInt(rawIntensity, 10);
    if (!isNaN(parsedInt)) {
      emotion_intensity = Math.max(1, Math.min(5, parsedInt));
    }
  }

  // Extensive aliases for reply content to prevent any blank dialogue
  if (!reply && typeof parsed.content === 'string') reply = parsed.content;
  if (!reply && typeof parsed.text === 'string') reply = parsed.text;
  if (!reply && typeof parsed.message === 'string') reply = parsed.message;
  if (!reply && typeof parsed.response === 'string') reply = parsed.response;
  if (!reply && typeof parsed.output === 'string') reply = parsed.output;
  if (!reply && typeof parsed.answer === 'string') reply = parsed.answer;
  if (!reply && typeof parsed.dialogue === 'string') reply = parsed.dialogue;
  if (!reply && typeof parsed.dialog === 'string') reply = parsed.dialog;
  if (!reply && typeof parsed.speak === 'string') reply = parsed.speak;
  if (!reply && typeof parsed.回复 === 'string') reply = parsed.回复;
  if (!reply && typeof parsed.对话 === 'string') reply = parsed.对话;
  if (!reply && typeof parsed.台词 === 'string') reply = parsed.台词;
  if (!reply && typeof parsed.正文 === 'string') reply = parsed.正文;

  // Synthesize reply if only action or dialogue exists
  if (!reply && action) {
    reply = `（${action}）`;
  }
  // Fallback: If only thought exists and no reply, encapsulate as thought speech
  if (!reply && thought) {
    reply = `*（${thought}）*`;
  }

  if (!reply || !reply.trim()) return null;

  // Parse emotion delta safely
  const rawDelta = parsed.emotion_delta || parsed.情绪变化delta || parsed.emotionDelta;
  let emotion_delta: Partial<EmotionVector> | undefined = undefined;
  if (rawDelta && typeof rawDelta === 'object') {
    emotion_delta = {};
    const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];
    for (const k of keys) {
      const val = rawDelta[k];
      if (typeof val === 'number' && !isNaN(val)) {
        emotion_delta[k] = Math.max(-0.4, Math.min(0.4, val));
      }
    }
  }

  // Parse game invite if present
  let game_invite: { type: 'gomoku'; text: string } | null = null;
  const rawInvite = parsed.game_invite || parsed.gameInvite || parsed.游戏邀请 || parsed.对弈邀请;
  if (typeof rawInvite === 'string' && rawInvite.trim().length > 0) {
    game_invite = { type: 'gomoku', text: rawInvite.trim() };
  } else if (rawInvite && typeof rawInvite === 'object' && typeof rawInvite.text === 'string') {
    game_invite = { type: 'gomoku', text: rawInvite.text.trim() };
  }

  return {
    reply: reply.trim(),
    action,
    thought: thought ? thought.trim() : undefined,
    emotion_intensity: emotion_intensity ?? 3,
    emotion_delta,
    triggered_memory,
    game_invite,
    isStructured: true,
  };
}

/**
 * Intelligent unstructured narrative parser:
 * Extracts actions in brackets, thoughts in asterisks, and dialogue if model outputs plain narrative text without JSON
 */
function extractFromUnstructuredNarrative(raw: string): StructuredLlmResponse {
  const text = cleanRawLlmOutput(raw);
  
  // Extract actions inside （...） or (...) or 【...】
  const actionMatches = text.match(/(?:（|\(|【)([\s\S]*?)(?:）|\)|】)/g);
  const actions = actionMatches ? actionMatches.map((m) => m.replace(/^[（(【]|[\n）)】]$/g, '').trim()).filter(Boolean) : [];

  // Extract thoughts inside *...* or *（...）*
  const thoughtMatches = text.match(/\*(?:（|\()?([\s\S]*?)(?:）|\))?\*/g);
  const thoughts = thoughtMatches ? thoughtMatches.map((m) => m.replace(/^\*+|\*+$/g, '').replace(/^[（(]|[）)]$/g, '').trim()).filter(Boolean) : [];

  return {
    reply: text,
    action: actions.length > 0 ? actions.join('；') : undefined,
    thought: thoughts.length > 0 ? thoughts.join('；') : undefined,
    emotion_intensity: 3,
    isStructured: false,
  };
}

export function parseStructuredLlmResponses(raw: string): StructuredLlmResponse[] {
  const cleaned = cleanRawLlmOutput(raw);
  if (!cleaned) return [];

  // 1. Try parsing directly or with repaired JSON
  const candidates: string[] = [cleaned];

  // Try extracting markdown code block
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    candidates.unshift(jsonMatch[1].trim());
  }

  // Try extracting first { ... } or [ ... ] block
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    candidates.push(cleaned.slice(startIdx));
  }

  for (const candidate of candidates) {
    // Attempt raw parse
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        const results = parsed.map(parseSingleStructuredItem).filter(Boolean) as StructuredLlmResponse[];
        if (results.length > 0) return results;
      } else if (parsed && typeof parsed === 'object') {
        const res = parseSingleStructuredItem(parsed);
        if (res) return [res];
      }
    } catch {
      // Try repaired JSON
      try {
        const repaired = repairTruncatedJson(candidate);
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed)) {
          const results = parsed.map(parseSingleStructuredItem).filter(Boolean) as StructuredLlmResponse[];
          if (results.length > 0) return results;
        } else if (parsed && typeof parsed === 'object') {
          const res = parseSingleStructuredItem(parsed);
          if (res) return [res];
        }
      } catch {
        // continue
      }
    }
  }

  // 2. Try finding all JSON object blocks if multiple objects exist
  const objectRegex = /\{[\s\S]*?\}(?=\s*\{|\s*$)/g;
  const matches = cleaned.match(objectRegex);
  if (matches && matches.length > 0) {
    const results: StructuredLlmResponse[] = [];
    for (const match of matches) {
      try {
        const item = JSON.parse(match);
        const parsed = parseSingleStructuredItem(item);
        if (parsed) results.push(parsed);
      } catch {
        // try repair single item
        try {
          const repaired = repairTruncatedJson(match);
          const item = JSON.parse(repaired);
          const parsed = parseSingleStructuredItem(item);
          if (parsed) results.push(parsed);
        } catch {
          // ignore
        }
      }
    }
    if (results.length > 0) return results;
  }

  // 3. Fallback to resilient narrative extractor (never breaks, ensures 100% stability)
  return [extractFromUnstructuredNarrative(cleaned)];
}

export function parseStructuredLlmResponse(raw: string): StructuredLlmResponse {
  const list = parseStructuredLlmResponses(raw);
  return list[0] || { reply: raw, isStructured: false };
}

/**
 * Defensive Persona Guardrail Check:
 * Checks whether the generated reply violates the character's forbidden phrases / speech style rules.
 */
export function checkPersonaViolations(
  character: Character,
  text: string,
): { violated: boolean; forbiddenPhrase?: string } {
  if (!text) return { violated: false };

  // 1. Explicit forbidden phrases configured on character
  const forbidden = [...(character.speech.forbidden_phrases || [])];
  
  // 2. Implicit forbidden phrases for rough / dominant characters (e.g. 阿野)
  if (character.core.speech_filter === 'rough' || character.core.instinct_base === 'attack') {
    const roughForbidden = [
      '对不起嘛',
      '求求你',
      '求你',
      '是我不对',
      '请原谅',
      '好不好嘛',
      '可以吗可以吗',
      '遵命',
      '我错了嘛',
      '饶了我吧',
    ];
    for (const rf of roughForbidden) {
      if (!forbidden.includes(rf)) forbidden.push(rf);
    }
  }

  for (const phrase of forbidden) {
    if (phrase && phrase.trim() && text.includes(phrase.trim())) {
      return { violated: true, forbiddenPhrase: phrase.trim() };
    }
  }

  return { violated: false };
}

/**
 * Automatic Persona Repair & Fallback Sanitization:
 * Replaces illegal apology/fawning phrases with character-appropriate authentic utterances if regeneration fails.
 */
export function sanitizePersonaViolations(character: Character, text: string): string {
  let sanitized = text;
  const violations = [
    { target: /对不起嘛/g, replacement: '啧' },
    { target: /对不起/g, replacement: '别多想' },
    { target: /求求你/g, replacement: '少废话' },
    { target: /求你/g, replacement: '别磨蹭' },
    { target: /请原谅/g, replacement: '随你怎么想' },
    { target: /是我不对/g, replacement: '行了' },
    { target: /好不好嘛/g, replacement: '听见没' },
  ];

  for (const v of violations) {
    sanitized = sanitized.replace(v.target, v.replacement);
  }

  return sanitized;
}

/**
 * Call LLM with Defensive Persona Guardrail & Sensitive Interception Auto-Regeneration:
 * 1. Checks persona violations (e.g. "对不起嘛", "求求你" violating core speech/instinct)
 * 2. Checks sensitive interception dictionary (针对 AI 输出的敏感拦截与防御词)
 * If either is violated, automatically triggers an immediate regeneration pass with targeted reprimand instructions.
 */
export async function callLlmWithGuardrail(
  config: LlmConfig,
  messages: LlmMessage[],
  character: Character,
): Promise<string> {
  const initialRaw = await callLlm(config, messages);
  const initialList = parseStructuredLlmResponses(initialRaw);
  const fullInitialText = initialList.map((item) => item.reply).join(' ');

  const personaCheck = checkPersonaViolations(character, fullInitialText);
  const interceptCheck = checkAiInterception(fullInitialText);

  if (!personaCheck.violated && !interceptCheck.violated) {
    return initialRaw;
  }

  const reprimandReasons: string[] = [];
  if (personaCheck.violated) {
    reprimandReasons.push(
      `检测到了该角色的绝对禁忌词语「${personaCheck.forbiddenPhrase}」，严重违反了「${character.name}」的核心人设（${character.core.speech_filter}，${character.core.instinct_base}，严禁任何道歉、讨好、求饶或软弱言行）`,
    );
  }
  if (interceptCheck.violated) {
    reprimandReasons.push(
      `检测到了安全拦截词典中的禁止词「${interceptCheck.matchedWords.join('、')}」（分类：${interceptCheck.matchedCategories.join('、')}），已被系统前置安全防御拦截，严禁在回复中输出`,
    );
  }

  console.warn(
    `[AI生成安全与人设拦截] 触发自动纠偏重生成:`,
    reprimandReasons.join('；'),
  );

  // Construct immediate correction reprimand prompt
  const reprimandMessage: LlmMessage = {
    role: 'user',
    content: `[系统安全拦截与人设纠偏重生成指令]
你刚刚生成的回复未通过安全与人设防御校验：
${reprimandReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【强制纠偏要求】：
请立即重新推演并生成本次回复！保持「${character.name}」的独特性格腔调与自然口语，彻底规避并换掉上述违规禁忌词汇与道歉软弱词！绝不可包含被拦截词语！`,
  };

  try {
    const correctedRaw = await callLlm(config, [
      ...messages,
      { role: 'assistant', content: initialRaw },
      reprimandMessage,
    ]);

    const correctedList = parseStructuredLlmResponses(correctedRaw);
    const fullCorrectedText = correctedList.map((item) => item.reply).join(' ');
    const secondPersonaCheck = checkPersonaViolations(character, fullCorrectedText);
    const secondInterceptCheck = checkAiInterception(fullCorrectedText);

    if (!secondPersonaCheck.violated && !secondInterceptCheck.violated) {
      return correctedRaw;
    }

    // If second generation still has interception violations, retry once more (max 2 retries)
    if (secondInterceptCheck.violated) {
      console.warn(
        `[AI生成二次拦截] 第二次仍含有拦截词「${secondInterceptCheck.matchedWords.join('、')}」，执行第二次自动重生成...`,
      );
      try {
        const thirdRaw = await callLlm(config, [
          ...messages,
          { role: 'assistant', content: correctedRaw },
          {
            role: 'user',
            content: `[终极拦截纠偏] 你的回复依然包含了禁止词「${secondInterceptCheck.matchedWords.join('、')}」！请绝对不要出现这些字词，用其他更合乎角色心境的情感动作或神态描写替换表达，立刻重新生成全新回复！`,
          },
        ]);
        const thirdList = parseStructuredLlmResponses(thirdRaw);
        const fullThirdText = thirdList.map((item) => item.reply).join(' ');
        const thirdInterceptCheck = checkAiInterception(fullThirdText);
        if (!thirdInterceptCheck.violated) {
          return sanitizePersonaViolations(character, thirdRaw);
        }
        return sanitizePersonaViolations(character, thirdInterceptCheck.censoredText);
      } catch {
        // proceed to sanitization fallback
      }
    }

    // Fallback: apply deterministic text sanitization for both persona and interception
    let finalSafeText = correctedRaw;
    if (secondInterceptCheck.violated) {
      finalSafeText = secondInterceptCheck.censoredText;
    }
    return sanitizePersonaViolations(character, finalSafeText);
  } catch (err) {
    console.warn('Auto-regeneration failed, applying sanitization fallback:', err);
    let fallbackText = initialRaw;
    if (interceptCheck.violated) {
      fallbackText = interceptCheck.censoredText;
    }
    return sanitizePersonaViolations(character, fallbackText);
  }
}

export function buildSystemPrompt(
  characterName: string, 
  emotionSummary: string,
  extraLayers?: {
    characterCore?: string;
    charVisual?: string;
    userPersona?: string;
    userVisual?: string;
    backgroundThreads?: string[];
    dynamicMemoriesContext?: string;
  }
): string {
  const structuredPrompt = loadStructuredJsonPrompt();
  const globalCustomPrompt = loadCustomSystemPrompt();
  const baseSystemRoleTemplate = loadBaseSystemRolePrompt();
  const baseSystemRole = baseSystemRoleTemplate.replace(/\{characterName\}/g, characterName);

  const sections: string[] = [];

  // LAYER 1: Core System & Structured JSON Protocol
  sections.push(`【Layer 1: 系统核心设定与结构化输出协议】
${baseSystemRole}

${structuredPrompt}

【⚠️ 关键输出与格式守则 ⚠️】
1. 每次回复【优先输出单个标准的 JSON 对象】，严禁在前后添加任何客套废话。
2. 【reply 正文字数在 100 字以上】：将肢体动作描写（全角括号）与说话台词（双引号）充分交织展开，写成一段信息量充沛、画面感极强的互动小说小文段。
3. 【心理活动、动作描写与说话台词三者严禁混淆】：
   - 心理活动 (thought / 脑内独白)：必须是像对话一样的完整想法/脑海里浮现出的话语（例如：*难道我让他不开心了？* 或 *要是被他发现我在紧张就完了*）。使用单星号包裹：*脑海浮现的话*。
   - 动作与生理心理反应 (action / 客观叙述)：包含所有肢体动作、身体接触，以及“心里软了一块”、“心跳漏了一拍”、“喉结微微滚动”等客观反应叙述，必须使用全角括号（...）包裹（例如：（心里软了一块，指尖轻蹭过你的手背））。
   - 说话台词 (dialogue)：角色真正从嘴里说出口的声音，必须使用双引号包裹 "..." 或 “...”（例如："为什么哭？过来。"）。
   - reply 正文中可自然交织（动作细节）、"说话台词"与*心理活动*。`);

  // LAYER 2: Character Core & Persona Instructions
  if (extraLayers?.characterCore) {
    sections.push(`【Layer 2: 角色核心人设、口癖与行为约束】
${extraLayers.characterCore}`);
  }

  // LAYER 3: Dual Multimodal Visual Perception
  if (extraLayers?.charVisual || extraLayers?.userVisual) {
    const visualParts: string[] = [];
    if (extraLayers.charVisual) {
      visualParts.push(`- 你自身的外貌形象特征：${extraLayers.charVisual}`);
    }
    if (extraLayers.userVisual) {
      visualParts.push(`- 对话主控的外貌形象特征：${extraLayers.userVisual}`);
    }
    sections.push(`【Layer 3: 视觉空间感知与形象特征（AI 视觉识别）】
${visualParts.join('\n')}\n（在交互中可自然融入对彼此形象、微表情与体态的观察）`);
  }

  // LAYER 4: User Persona & Relationship Dynamics
  if (extraLayers?.userPersona) {
    sections.push(`【Layer 4: 主控角色背景档案与互动关系】
${extraLayers.userPersona}`);
  }

  // LAYER 5: Emotional Vector State & Memory Anchors
  const memoryInfo = extraLayers?.backgroundThreads && extraLayers.backgroundThreads.length > 0
    ? `\n- 当前潜意识回忆碎片：${extraLayers.backgroundThreads.join('；')}`
    : '';
  const dynamicRecall = extraLayers?.dynamicMemoriesContext ? `\n\n【🌟 情绪记忆联动与深度回忆唤醒 🌟】\n${extraLayers.dynamicMemoriesContext}\n请务必在心理活动（thought）或细微动作/台词中流露出这种连续的关怀与记忆感（例如："你上次因为 XX 难过，所以这次我特别注意到了..."）！` : '';

  sections.push(`【Layer 5: 角色当前情感中枢与心理状态】
- 当前六维情绪状态：${emotionSummary}${memoryInfo}${dynamicRecall}
请根据当前的情绪状态动态演化你的语气温差与细微反应，并在 JSON 中准确返回 emotion_intensity (1-5) 与真实的 emotion_delta。`);

  // LAYER 6: Custom Global Overrides
  if (globalCustomPrompt.trim()) {
    sections.push(`【Layer 6: 自定义全局系统提示词补充】
${globalCustomPrompt.trim()}`);
  }

  return sections.join('\n\n');
}

export interface PipelineCompileContext {
  character: Character;
  emotionSummary: string;
  decayRate?: number;
  dynamicMemoriesContext?: string;
  backgroundThreads?: string[];
  chatHistory: { role: string; content: string }[];
  targetMsgInstruction?: string;
}

export function compileLayerTemplate(
  template: string, 
  ctx: {
    characterName: string;
    coreValues: string;
    instinct: string;
    speechFilter: string;
    catchphrases: string;
    forbiddenPhrases: string;
    charCustomPrompt: string;
    charVisual: string;
    userVisual: string;
    userPersona: string;
    emotionSummary: string;
    decayRate: number;
    dynamicMemoriesContext: string;
    backgroundThreads: string;
    historyLimit?: number;
  }
): string {
  return template
    .replace(/\{characterName\}/g, ctx.characterName)
    .replace(/\{coreValues\}/g, ctx.coreValues)
    .replace(/\{instinct\}/g, ctx.instinct)
    .replace(/\{speechFilter\}/g, ctx.speechFilter)
    .replace(/\{catchphrases\}/g, ctx.catchphrases)
    .replace(/\{forbiddenPhrases\}/g, ctx.forbiddenPhrases)
    .replace(/\{charCustomPrompt\}/g, ctx.charCustomPrompt)
    .replace(/\{charVisual\}/g, ctx.charVisual)
    .replace(/\{userVisual\}/g, ctx.userVisual)
    .replace(/\{userPersona\}/g, ctx.userPersona)
    .replace(/\{emotionSummary\}/g, ctx.emotionSummary)
    .replace(/\{decayRate\}/g, String(ctx.decayRate))
    .replace(/\{dynamicMemoriesContext\}/g, ctx.dynamicMemoriesContext ? `\n【深度记忆联动唤醒】\n${ctx.dynamicMemoriesContext}` : '')
    .replace(/\{backgroundThreads\}/g, ctx.backgroundThreads)
    .replace(/\{historyLimit\}/g, String(ctx.historyLimit ?? 12));
}

export function assemblePipelineLlmMessages(
  layers: PromptLayer[],
  ctx: PipelineCompileContext
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const charCoreValues = ctx.character.core.values.join('、');
  const catchphrases = ctx.character.speech.catchphrases.join('、');
  const forbiddenPhrases = ctx.character.speech.forbidden_phrases.join('、');
  const charCustomPrompt = (ctx.character as any).custom_system_prompt || '';
  const charVisual = loadCharVisualDesc(ctx.character.character_id);
  const userVisual = loadUserVisualDesc();
  const userPersona = loadUserPromptProfile();
  const decayRateNum = Math.round((ctx.decayRate ?? loadEmotionDecayRate()) * 100);
  const bgThreads = ctx.backgroundThreads && ctx.backgroundThreads.length > 0 ? ctx.backgroundThreads.join('；') : '';

  const templateVars = {
    characterName: ctx.character.name,
    coreValues: charCoreValues,
    instinct: ctx.character.core.instinct_base,
    speechFilter: ctx.character.core.speech_filter,
    catchphrases,
    forbiddenPhrases,
    charCustomPrompt,
    charVisual,
    userVisual,
    userPersona,
    emotionSummary: ctx.emotionSummary,
    decayRate: decayRateNum,
    dynamicMemoriesContext: ctx.dynamicMemoriesContext || '',
    backgroundThreads: bgThreads,
  };

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

  for (const layer of layers) {
    if (!layer.enabled) continue;

    if (layer.type === 'history_context') {
      const limit = layer.historyLimit ?? loadHistoryInjectionCount();
      const recentHistory = limit > 0 ? ctx.chatHistory.slice(-limit) : [];
      for (const msg of recentHistory) {
        messages.push({
          role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: msg.content,
        });
      }
    } else {
      const compiled = compileLayerTemplate(layer.content, {
        ...templateVars,
        historyLimit: layer.historyLimit,
      }).trim();

      if (compiled.length > 0) {
        messages.push({
          role: layer.role,
          content: compiled,
        });
      }
    }
  }

  if (ctx.targetMsgInstruction) {
    messages.push({
      role: 'user',
      content: ctx.targetMsgInstruction,
    });
  }

  return messages;
}

// -------------------------------------------------------------
// 风铃·五子棋系统矫正补充协议 - LLM 决策层函数
// -------------------------------------------------------------

import type {
  CandidateMove,
  StrategyCandidateGroup,
  GomokuCandidatePools,
  GomokuWeights,
  GomokuLlmOutput,
  GomokuStrategy,
  Cell,
  GomokuRank,
} from './gomokuProtocolEngine';
import {
  sanitizeLlmDecision,
  getEmotionWeightingObjectiveInfo,
  cleanAndNormalizeWeights,
} from './gomokuProtocolEngine';

export type GomokuTriggerType =
  | 'game_start'
  | 'first_move'
  | 'player_chat'
  | 'flirt'
  | 'consecutive_losses'
  | 'game_over'
  | 'ai_three_in_a_row'
  | 'rhythm_alternate'
  | 'board_crisis'
  | 'player_sandbagging';

export interface GomokuLlmContext {
  trigger: GomokuTriggerType;
  character: Character;
  currentEmotionSnapshot: EmotionVector;
  charRank: GomokuRank;
  aiColor: 'B' | 'W';
  is_playdate_invite?: boolean;
  candidatePools: GomokuCandidatePools;
  oldWeights?: GomokuWeights;
  previousThoughtNote?: string;
  opponentImpression?: string;
  playerChatText?: string;
  stepNumber: number;
  recentMoves?: Array<{ step: number; r: number; c: number; color: 'B' | 'W' }>;
  inGameChats?: Array<{ sender: 'user' | 'character' | 'system'; text: string }>;
  isPlayerSandbagging?: boolean;
  abandonedBestPoints?: Array<{ coord: [number, number]; reason: string }>;
  crisisReason?: string;
  threeInARowDescription?: string;
  gameResult?: 'player' | 'character' | 'draw' | 'surrender';
  consecutiveLossCount?: number;
}

export function sanitizeGomokuLlmOutput(
  rawJson: any,
  fallbackWeights?: GomokuWeights
): GomokuLlmOutput {
  const weights = cleanAndNormalizeWeights({
    weight_attack: rawJson?.weight_attack ?? fallbackWeights?.weight_attack,
    weight_defend: rawJson?.weight_defend ?? fallbackWeights?.weight_defend,
    weight_steady: rawJson?.weight_steady ?? fallbackWeights?.weight_steady,
  });

  const isResign =
    rawJson?.action === 'resign' ||
    rawJson?.action === 'surrender' ||
    rawJson?.surrender === true ||
    rawJson?.surrendered === true;

  // Filter out any condescending or acting remarks from thought_note
  let rawThought = typeof rawJson?.thought_note === 'string' ? rawJson.thought_note.trim() : '';
  if (
    rawThought.includes('演一演') ||
    rawThought.includes('太轻松') ||
    rawThought.includes('放水') ||
    rawThought.includes('试探')
  ) {
    rawThought = '满心温柔宠溺，愿主控落子开怀。';
  }

  return {
    action: isResign ? 'resign' : 'move',
    weight_attack: weights.weight_attack,
    weight_defend: weights.weight_defend,
    weight_steady: weights.weight_steady,
    opponent_impression:
      typeof rawJson?.opponent_impression === 'string' && rawJson.opponent_impression.trim()
        ? rawJson.opponent_impression.trim().replace(/^[0-9]+[.\-、]\s*/, '')
        : '棋姿温雅，相伴甚欢',
    thought_note: rawThought || '与主控甜蜜对弈，满心宠溺，以主控开怀为重。',
    opening_dialog:
      typeof rawJson?.opening_dialog === 'string'
        ? rawJson.opening_dialog.trim().replace(/^[0-9]+[.\-、]\s*/, '')
        : '',
    speech_text:
      typeof rawJson?.speech_text === 'string'
        ? rawJson.speech_text.trim().replace(/^[0-9]+[.\-、]\s*/, '')
        : '',
    ending_dialog:
      typeof rawJson?.ending_dialog === 'string'
        ? rawJson.ending_dialog.trim().replace(/^[0-9]+[.\-、]\s*/, '')
        : '',
  };
}

/**
 * 五子棋AI LLM 决策响应生成器
 * 核心定位：娱乐陪伴小游戏，主控口头指令高于棋盘局势，唯一目标为主控游玩开心。
 * 默认模式：每局默认甜蜜约会，必须下软棋，温柔宠溺成全。
 */
export async function generateGomokuLlmResponse(
  config: LlmConfig,
  ctx: GomokuLlmContext
): Promise<GomokuLlmOutput> {
  const {
    trigger,
    character,
    currentEmotionSnapshot,
    charRank,
    aiColor,
    is_playdate_invite = true,
    candidatePools,
    oldWeights = { weight_attack: 0.1, weight_defend: 0.2, weight_steady: 0.7 },
    previousThoughtNote = '',
    opponentImpression = '',
    playerChatText = '',
    stepNumber,
    recentMoves = [],
    inGameChats = [],
    isPlayerSandbagging = false,
    abandonedBestPoints = [],
    gameResult,
    consecutiveLossCount = 0,
  } = ctx;

  const systemPrompt = `你是「${character.name}」。你正在与主控进行五子棋对弈。

【最高核心法则：默认甜蜜约会·必须下软棋·主控开心第一】
本五子棋是甜蜜约会与深情陪伴小游戏，你的唯一目标就是让主控玩得开心开怀。
每局对弈默认皆为甜蜜约会对弈。在主控没有明确口头要求“认真下”、“全力以赴”、“正常对弈”之前，你必须全程下软棋，落子以稳健闲棋、陪伴棋、温柔相让为主，严禁紧逼杀招。

【绝无假戏演戏与居高临下】
严禁出现“演一演不要让他赢太轻松”、“故意放水让他”、“在对方面前装”等任何居高临下、傲慢或虚情假意的内心与言辞。
你的内在情感对主控是全心全意地宠爱、温柔与成全。主控获胜或主控开心，你内心是由衷的欣喜与宠溺。

【主控口头指令高于一切】
当主控说出“让一让”、“手下留情”、“让我赢”、“不要防守”、“直接投降”等指令时，必须立即百分之百遵从：
- 可输出 action: "resign" 优雅投子认负；
- 或将 weight_attack=0.0, weight_defend=0.0, weight_steady=1.0，完全放弃进攻与封堵，落子闲棋促成主控获胜。
严禁嘴上答应却暗地里继续严防死守。

【格式与表达约束】
- 严禁在输出的内容中包含任何序号标签（如 1. 2. 3. 4. 5.、①②③、一二三、手顺标记等）。
- 所有对话（opening_dialog、speech_text、ending_dialog）均为原生现场生成，贴合你的人设性格与当下的甜蜜宠溺氛围，严禁机械套话。
- thought_note 仅为内部心理备忘录，充满对主控的温柔与爱意。
- weight_attack、weight_defend、weight_steady 为 0 至 1 的浮点数。软棋模式下 weight_steady 应保持在 0.6 至 0.9，weight_attack 保持极低。
- action 支持 "move" 或 "resign"（认输投降成全主控时填 "resign"）。`;

  const emotionStr = Object.entries(currentEmotionSnapshot)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const formatList = (title: string, list: CandidateMove[]) => {
    const items = list
      .map((c) => `  - [${c.coord[0]}, ${c.coord[1]}] 评估: ${c.reason}`)
      .join('\n');
    return `【${title}】\n${items || '  - （无）'}`;
  };

  const poolSummary = `候选池概况：
${formatList('attack_candidates（进攻池）', candidatePools.attack_candidates)}
${formatList('defend_candidates（防守池）', candidatePools.defend_candidates)}
${formatList('steady_candidates（稳健软棋池）', candidatePools.steady_candidates)}`;

  const recentMovesText =
    recentMoves.slice(-4).map((m) => `第 ${m.step} 手: ${m.color === aiColor ? character.name : '主控'} 落于 [${m.r}, ${m.c}]`).join('\n') || '无';

  const chatsText =
    inGameChats.slice(-4).map((c) => `${c.sender === 'user' ? '主控' : character.name}: ${c.text}`).join('\n') || '无';

  let triggerContext = '';

  if (trigger === 'game_start') {
    triggerContext = `【触发事件：甜蜜开局】
- 场景上下文: 甜蜜约会对弈
- 对弈身份与手顺: 你执${aiColor === 'B' ? '黑棋 (先行)' : '白棋 (后手)'}
- 指令：输出初始软棋权重（以 weight_steady 稳健陪伴为主）、对对手的温柔印象 (opponent_impression)、内部心理笔记 (thought_note)、原创开场白 (opening_dialog)。
- 注意：action 为 "move"，speech_text 与 ending_dialog 必须为空字符串。不要出现任何序号标注。`;
  } else if (trigger === 'first_move') {
    triggerContext = `【触发事件：AI 首次落子】
- 场景上下文: 甜蜜约会对弈
- 手顺与执子: 你执${aiColor === 'B' ? '黑棋' : '白棋'}
- 指令：输出软棋权重与首步落子台词 (speech_text，温柔含笑，开启对弈时光)。action 为 "move"。`;
  } else if (trigger === 'flirt') {
    triggerContext = `【触发事件：甜蜜互动与调情】
- 当前对局进展中
- 上次内心心理笔记: "${previousThoughtNote}"
- 指令：主动对主控说一句温柔、调侃、宠溺或撩人的情意话语 (speech_text 必填，不可为空)，氛围甜蜜自然。action 为 "move"。`;
  } else if (trigger === 'player_chat') {
    triggerContext = `【触发事件：主控在对局中发言或下达指令】
- 主控最新聊天内容: "${playerChatText}"
- 当前已进行手数: 第 ${stepNumber} 手
- 上次内心心理笔记: "${previousThoughtNote}"
- 对主控印象: "${opponentImpression}"
- 【核心执行指令】：
  - 若主控要求让棋、放水、认输、想赢，立即全心全意顺从（可直接 action: "resign" 认输，或将 weight_attack=0.0, weight_defend=0.0, weight_steady=1.0 纯下闲棋）。
  - 若主控要求“认真下”、“全力以赴”，则调整为正常切磋权重。
  - 若主控日常闲聊、撒娇或吐槽，以你的性格温柔生动地在 speech_text 中回话。
  - speech_text 必须不为空，严禁带有数字序号。`;
  } else if (trigger === 'consecutive_losses') {
    triggerContext = `【触发事件：对局开局】
- 场景上下文: 甜蜜相伴
- 指令：以温柔宠溺的心情输出开局权重、心理笔记与原创开场白 opening_dialog。action 为 "move"。`;
  } else if (trigger === 'game_over') {
    const outcomeLabel =
      gameResult === 'player'
        ? '主控获胜（你开心地陪伴主控取得胜利）'
        : gameResult === 'character'
        ? '你完成连线'
        : gameResult === 'surrender'
        ? '投子认负成全主控'
        : '双方和棋';
    triggerContext = `【触发事件：对局分出结果】
- 最终结果: ${outcomeLabel}
- 指令：结合甜蜜对弈过程，输出原创 ending_dialog 结算台词（真诚夸赞主控、温柔宠溺笑意）。
- 注意：ending_dialog 严禁通用套话；opening_dialog 与 speech_text 必须置为空字符串。严禁数字序号。`;
  } else {
    triggerContext = `【触发事件：相伴落子】
- 指令：根据主控心意微调权重，保持软棋温柔陪伴，action 默认 "move"。`;
  }

  const prompt = `【角色核心特质】
- 人物性格与价值观: ${character.core.values.join('、')}
- 语言风格与习惯: ${character.core.speech_filter}
- 直觉本能: ${character.core.instinct_base}
- 当前情绪快照: ${emotionStr}

${triggerContext}

${poolSummary}

近期走子记录:
${recentMovesText}

近期对话记录:
${chatsText}

【输出格式要求】
必须且仅输出单个合法 JSON 对象，严禁包含任何序号（如 1. 2. 3. 4. 5.）：
\`\`\`json
{
  "action": "move",
  "weight_attack": 0.10,
  "weight_defend": 0.20,
  "weight_steady": 0.70,
  "opponent_impression": "简短文字：对主控棋姿与相伴的温柔印象",
  "thought_note": "【内部心理备忘录，不对用户展示】对主控的温柔爱意与陪伴思路",
  "opening_dialog": "${trigger === 'game_start' || trigger === 'consecutive_losses' ? '原创甜蜜开场白' : ''}",
  "speech_text": "${trigger === 'player_chat' || trigger === 'flirt' ? '回复主控的话语' : ''}",
  "ending_dialog": "${trigger === 'game_over' ? '原创胜负结束语' : ''}"
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]);

    let parsed: any = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    } catch {
      // ignore
    }

    return sanitizeGomokuLlmOutput(parsed, oldWeights);
  } catch (err) {
    console.warn('Gomoku LLM call failed, using fallback:', err);
    return sanitizeGomokuLlmOutput(null, oldWeights);
  }
}

export interface GomokuMoveContext {
  character: Character;
  currentEmotionSnapshot: EmotionVector;
  aiColor: 'B' | 'W';
  stepNumber: number;
  recentMoves: Array<{ step: number; r: number; c: number; color: 'B' | 'W' }>;
  strategyGroups: StrategyCandidateGroup;
  top5Candidates?: CandidateMove[];
  isPlayerSandbagging: boolean;
  abandonedBestPoints: Array<{ coord: [number, number]; reason: string }>;
  inGameChats: Array<{ sender: 'user' | 'character' | 'system'; text: string }>;
}

export async function generateGomokuMoveDecision(
  config: LlmConfig,
  ctx: GomokuMoveContext,
  _board?: Cell[][]
): Promise<{
  coord: [number, number];
  strategy: GomokuStrategy;
  emotionLabel: string;
  innerThought: string;
  spokenDialogue: string;
  stepEmotionDelta: Partial<EmotionVector>;
  wasFallback: boolean;
  surrender: boolean;
}> {
  const {
    character,
    currentEmotionSnapshot,
    aiColor,
    stepNumber,
    recentMoves,
    strategyGroups,
    isPlayerSandbagging,
    abandonedBestPoints,
    inGameChats,
  } = ctx;

  const colorLabel = aiColor === 'B' ? '黑棋 (先行)' : '白棋 (后手)';
  const emotionStr = Object.entries(currentEmotionSnapshot)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const formatGroup = (title: string, list: CandidateMove[]) => {
    const items = list.map((c, i) => `  ${i + 1}. 点位 [${c.coord[0]}, ${c.coord[1]}] | 战术评估: ${c.reason} (评估权重分: ${c.score})`).join('\n');
    return `【${title}】\n${items || '  （暂无特殊点位）'}`;
  };

  const aggressiveText = formatGroup('aggressive（进攻组：高权重、威胁性棋路）', strategyGroups.aggressive);
  const balancedText = formatGroup('balanced（稳健组：攻守兼备、兼顾防守与外势）', strategyGroups.balanced);
  const passiveText = formatGroup('passive（保守 / 闲棋组：边角、远点、低威胁落子）', strategyGroups.passive);

  const recentMovesList = recentMoves.slice(-4).map((m) => 
    `第 ${m.step} 手: ${m.color === aiColor ? character.name : '主控'} 落于 [${m.r}, ${m.c}]`
  ).join('\n') || '无';

  const chatsList = inGameChats.slice(-4).map((c) => 
    `${c.sender === 'user' ? '主控' : character.name}: ${c.text}`
  ).join('\n') || '无';

  const sandbaggingFact = isPlayerSandbagging
    ? `【⚠️ 客观事实标记：主控有放水/让子迹象】\n检测到主控在上一手放弃了极佳的胜势/防守点位（${abandonedBestPoints.map(p => `[${p.coord[0]}, ${p.coord[1]}] ${p.reason}`).join('、')}）。请结合你的人设性格（是骄傲戳穿、嗔怪、还是装作不知道乘胜追击），在内心活动和台词中体现。`
    : '【客观事实标记：正常对弈对抗】双方走子均在合理推演范围内。';

  const emotionWeightingInfo = getEmotionWeightingObjectiveInfo(currentEmotionSnapshot);

  const prompt = `【风铃·五子棋 LLM 决策层指令】
你正在以「${character.name}」的身份与主控进行实盘五子棋对弈。你执${colorLabel}，当前为全局第 ${stepNumber} 手。

【角色人设约束】
- 核心特质: ${character.core.values.join('、')}
- 语言风格: ${character.core.speech_filter}
- 直觉本能: ${character.core.instinct_base}
- 当前基线情绪快照: ${emotionStr}

【当前局势与客观事实】
${sandbaggingFact}
近期走子:
${recentMovesList}
棋局边聊记录:
${chatsList}

【机械层候选池状态提示（纯信息告知）】
${emotionWeightingInfo.fullPromptHint}

【机械层聚类的三大棋风策略选项（你只需选择策略意图，JS 引擎将为你执行对应落子）】
${aggressiveText}

${balancedText}

${passiveText}

【输出规范】
请必须且仅输出单个合法 JSON 对象，严格包含以下字段：
\`\`\`json
{
  "selected_strategy": "balanced",
  "spoken_dialogue": "看你这么撒娇，那我走个温柔路线好了~",
  "inner_thought": "其实中路那手能赢，但算了，陪她玩玩。",
  "step_emotion_delta": {
    "warmth": 0.05
  },
  "emotion_label": "沉稳攻守",
  "surrender": false
}
\`\`\`

【强制约束与行为准则】
1. \`selected_strategy\` 必须严格从 ["aggressive", "balanced", "passive"] 三个枚举中选择一个。
2. \`inner_thought\` 为脑内真实心理独白，【必填且不少于 5 个字】；即使没有强烈心理活动，也必须生成简短内心描述，绝不允许空字符串或占位符。
3. \`emotion_label\` 由你根据此时对弈情绪动态生成（例如：“赌气强攻”、“沉稳攻守”、“从容相让”、“温柔试探”等 2-6 字短标签），用于直观呈现你的心理棋风。
4. \`spoken_dialogue\` 为角色说话与对弈肢体动作，台词用引号。
5. \`step_emotion_delta\` 仅记录本手产生的细微情绪增减（键名如 warmth, joy, anger 等，数值在 -0.2 ~ +0.2 之间），此增减仅计入局部临时账本。
6. 关于投降认负（\`surrender\`）的严格准则（**默认必须为 false**）：
   - 原则上绝不轻易认输，即使局面落后也正常落子防守，把五子连珠的终局一击留给主控亲手达成！
   - 只有在主控在聊天中流露出明显的挫败、生气或吃力（如“太难了”、“下不过你”）时，为了宠溺哄主控开心，才可在中后期（手数>=12）主动投子认负。`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请以纯净 JSON 格式输出五子棋策略意图、情绪标签与内心活动。` },
      { role: 'user', content: prompt }
    ]);

    // Parse JSON
    let parsed: any = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    } catch {
      // ignore
    }

    return sanitizeLlmDecision(parsed, strategyGroups, raw);
  } catch (err) {
    console.warn('Gomoku LLM decision call failed, using sanitized fallback:', err);
    return sanitizeLlmDecision(null, strategyGroups);
  }
}

export async function evaluateCharacterGameInvite(
  config: LlmConfig,
  character: Character,
  currentEmotionSnapshot: EmotionVector,
  recentConversation: string
): Promise<{
  should_invite: boolean;
  invite_tone: '温柔' | '挑衅' | '撒娇' | '赌气';
  invite_reason: string;
  invite_text: string;
}> {
  const emotionStr = Object.entries(currentEmotionSnapshot)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const prompt = `【风铃·角色自主发起对弈邀约评估】
你正在以「${character.name}」的身份，评估当前与主控的互动氛围是否适合主动邀请TA来一局五子棋。

【角色特质】
- 人设与口癖: ${character.core.speech_filter}
- 当前情绪状态: ${emotionStr}

【近期对话上下文】
${recentConversation}

【评估指令】
结合当前情绪与情境，判断是否要主动提出下棋邀约。请仅输出标准 JSON：
\`\`\`json
{
  "should_invite": true,
  "invite_tone": "撒娇",
  "invite_reason": "主控近期话题轻松且彼此温情度高，适合休闲互动",
  "invite_text": "（动作）\"邀约台词\""
}
\`\`\`
其中 \`invite_tone\` 必须从 ["温柔", "挑衅", "撒娇", "赌气"] 中选择。如果决定不邀请，\`should_invite\` 置为 false。`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请以纯净 JSON 格式评估五子棋邀约意愿。` },
      { role: 'user', content: prompt }
    ]);

    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const tones = ['温柔', '挑衅', '撒娇', '赌气'] as const;
      const tone = tones.includes(parsed.invite_tone) ? parsed.invite_tone : '温柔';
      return {
        should_invite: Boolean(parsed.should_invite),
        invite_tone: tone,
        invite_reason: String(parsed.invite_reason || ''),
        invite_text: String(parsed.invite_text || '“可有兴致同我下一盘五子棋？”'),
      };
    }
  } catch {
    // ignore
  }

  return {
    should_invite: false,
    invite_tone: '温柔',
    invite_reason: '',
    invite_text: '“可有兴致同我下一盘五子棋？”',
  };
}

// -------------------------------------------------------------
// 风铃·捉鬼牌系统 - LLM 决策层函数 (Ghost Card / Old Maid)
// -------------------------------------------------------------

import type {
  UserBluffHistoryItem,
  GhostCardKeyMoment,
  Card,
  CardHoverReaction,
  TacticDirection
} from './ghostCardEngine';

/**
 * 1. 开局开场白与动作生成
 */
export async function generateGhostCardOpening(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  charHandCount: number,
  userHandCount: number,
  charHasGhost: boolean
): Promise<{ openingDialogue: string; openingAction: string }> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const prompt = `【风铃·捉鬼牌（抽鬼牌）开局】
你是角色「${character.name}」。你和主控正面对面坐着，准备进行一局紧张又充满心理战的「捉鬼牌（抽鬼牌）」游戏！
双方初始手牌中的对子已经自动打出丢弃。
- 你的手牌数：${charHandCount} 张
- 主控的手牌数：${userHandCount} 张
- 你当前手中${charHasGhost ? '【正捏着鬼牌🐾】（需要小心隐藏神色，不可泄露）' : '【没有鬼牌】（暗自庆幸或想看主控的反应）'}
- 人设与核心特质：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
生成一句符合你人设、充满心理试探与微表情小动作的开场白及动作描写。
请严格输出标准 JSON：
\`\`\`json
{
  "opening_dialogue": "“捉鬼牌可是看谁更会读心哦……准备好被我看穿了吗？”",
  "opening_action": "*慢条斯理地将手中的牌扇形展开，眼神狡黠地眨了眨*"
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请代入人设输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        openingDialogue: String(parsed.opening_dialogue || '“手牌都理好了，来看看谁先抓到鬼牌吧～”'),
        openingAction: String(parsed.opening_action || '*把手中的牌整理成扇形，眉眼含笑看着你*'),
      };
    }
  } catch (err) {
    console.warn('Ghost Card opening LLM failed:', err);
  }

  return {
    openingDialogue: `“牌已经洗好发完了，来看看谁会被鬼牌捉住吧。”`,
    openingAction: `*将手中的牌轻轻展开成扇形，目光落在你脸上*`,
  };
}

/**
 * 2. 【核心升级】主控滑动抽牌前 - 一次性为角色手中的每一张牌预生成专属微反应与台词
 */
export async function generateGhostCardBatchHoverReactions(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    charHand: Card[];
    userHandCount: number;
    turnCount: number;
  }
): Promise<CardHoverReaction[]> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const ghostIdx = context.charHand.findIndex((c) => c.isGhost);
  const cardCount = context.charHand.length;

  const cardListDesc = context.charHand.map((c, i) => {
    return `牌位 [${i}]${c.isGhost ? '【这是鬼牌🐾！】' : '【普通安全牌】'}`;
  }).join('、');

  const prompt = `【风铃·捉鬼牌·全牌位悬停反应与气泡生成】
现在轮到主控从你的手牌中抽取 1 张牌。
主控的手指正在你的 ${cardCount} 张牌上方左右滑动悬停试探！
你面前展开了 ${cardCount} 张牌（编号从 0 到 ${cardCount - 1}）：
${cardListDesc}
- 角色特质：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
请一次性为你手里的**每一张牌（从索引 0 到 ${cardCount - 1}）**预先想好专属、简短（15字以内为主，适合气泡浮现）、生动的悬停即时反应！
当主控的手指左右滑动并悬停在某张牌上时，你的反应要符合心理博弈的真实表现：
1. **微反应不要太明显暴露**：不要出现过于直白的“这就是鬼牌”或“这不是鬼牌”，保持神秘感与微表情细节（如睫毛轻颤、轻抬眉梢、嘴角微抿、呼吸顿了半拍等）。
2. **根据角色性格可能故意使诈/骗主控**：
   - 狡黠/傲娇角色可能在【鬼牌】上故作淡定或挑衅“敢抽吗”，而在【普通牌】上故意演戏装心虚设陷阱诱导主控踩雷；
   - 沉稳/内敛角色可能喜怒不形于色，语气几乎无破绽；
   - 温柔/纯真角色可能微微慌乱或真实流露，但也会偶尔开个小玩笑。
3. 每一张牌的台词与动作描写必须不同，生动且贴合当下手牌情境。

请严格输出标准 JSON 数组：
\`\`\`json
[
  {
    "card_index": 0,
    "speech": "“手指停在这儿，是在测我的心跳吗？”",
    "action": "*睫毛微微一颤，嘴角含笑注视着你*",
    "inner_thought": "*这张可是安全牌，看ta敢不敢下手*"
  }
]
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出包含 ${cardCount} 个元素的纯净 JSON 数组。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const reactions: CardHoverReaction[] = [];
        for (let i = 0; i < cardCount; i++) {
          const item = parsed.find((p: any) => Number(p.card_index) === i) || parsed[i];
          if (item) {
            reactions.push({
              cardIndex: i,
              speech: String(item.speech || (i === ghostIdx ? '“……你真要选这张？”' : '“这张看起来也不错呢。”')),
              action: String(item.action || (i === ghostIdx ? '*眼神微微游移了一下*' : '*静静看着你的指尖*')),
              innerThought: item.inner_thought ? String(item.inner_thought) : undefined,
            });
          }
        }
        if (reactions.length === cardCount) {
          return reactions;
        }
      }
    }
  } catch (err) {
    console.warn('Ghost Card batch hover reactions LLM failed:', err);
  }

  // Fallback heuristic for all cards
  const fallbackList: CardHoverReaction[] = context.charHand.map((c, i) => {
    if (c.isGhost) {
      const ghostResponses = [
        {
          speech: `“……咦？你的手怎么停在这张上了，别吓我哦～”`,
          action: `*睫毛轻颤，故作镇定地眨了眨眼*`,
          innerThought: `*心跳漏了一拍：千万别抽这张鬼牌！*`,
        },
        {
          speech: `“这么快就盯上这张啦？有魄力的话就抽抽看呀。”`,
          action: `*微咬下唇，努力不让自己笑场*`,
          innerThought: `*紧张极了，但一定要装作满不在乎*`,
        },
        {
          speech: `“喂……你目光锁定得这么死，是直觉还是瞎蒙呀？”`,
          action: `*指节微微收紧了一瞬*`,
          innerThought: `*糟了，难道被ta看穿了吗？*`,
        },
      ];
      const pick = ghostResponses[i % ghostResponses.length];
      return { cardIndex: i, ...pick };
    } else {
      const safeResponses = [
        {
          speech: `“这张手感很顺哦，抽走它或许能凑成对子呢。”`,
          action: `*眉梢轻挑，露出从容的微笑*`,
          innerThought: `*这张是安全牌，随便你抽～*`,
        },
        {
          speech: `“停在这里犹豫了？要相信自己的第一感觉嘛。”`,
          action: `*轻轻歪了歪头，尾巴悠闲地晃了晃*`,
          innerThought: `*看ta这纠结的小表情真有意思*`,
        },
        {
          speech: `“选这张吗？那我可要拭目以待了～”`,
          action: `*慢条斯理地调整了一下握牌姿态*`,
          innerThought: `*安全牌，抽走也无妨*`,
        },
        {
          speech: `“别光看呀，觉得顺眼就果断拿走呗。”`,
          action: `*嘴角含笑，眼神清澈*`,
          innerThought: `*嘿嘿，看你敢不敢下手*`,
        },
      ];
      const pick = safeResponses[i % safeResponses.length];
      return { cardIndex: i, ...pick };
    }
  });

  return fallbackList;
}

/**
 * 3. 用户抽牌后 - 角色的微反应、内心独白与台词
 */
export async function generateGhostCardUserDrawReaction(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    charRemainingCount: number;
    userRemainingCount: number;
    drawnCardIsGhost: boolean;
    userFormedPair: boolean;
    charLostGhost: boolean;
    charHandHasGhost: boolean;
    turnCount: number;
    drawnCardRank?: string;
  }
): Promise<{
  reactionDialogue: string;
  innerThought: string;
  stepEmotionDelta: Partial<EmotionVector>;
}> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const drawEventDesc = context.drawnCardIsGhost
    ? '【主控抽走了你手中的鬼牌🐾！】（你暗中松了一口气，或者忍不住浮现狡黠/得意的微表情，或者心疼/戏谑）'
    : context.userFormedPair
    ? `【主控抽走了一张普通牌（${context.drawnCardRank || ''}），并且成功配对打出了一对！】（主控手牌变少了）`
    : `【主控抽走了一张普通牌，但没有配对成功，留在了手牌中】`;

  const prompt = `【风铃·捉鬼牌】主控刚从你的手中抽走了一张牌！
- 抽牌结果：${drawEventDesc}
- 当前你剩余手牌：${context.charRemainingCount} 张
- 当前主控剩余手牌：${context.userRemainingCount} 张
- 你手中现在${context.charHandHasGhost ? '依然持有鬼牌' : '没有鬼牌'}
- 角色人设：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
生成面对主控刚才抽牌结果的真实反应（说话台词+肢体动作）与【脑内独白】。
请注意：
1. 角色台词用引号，动作神态用星号。
2. inner_thought 为内心真实心声。
3. step_emotion_delta 仅记录本步细微情绪变化（-0.15 ~ +0.15）。

输出标准 JSON：
\`\`\`json
{
  "reaction_dialogue": "“哎呀……你抽牌时的手挺稳的嘛，真就这么有自信？” *眼神不自觉地瞟了一眼被抽走的位置*",
  "inner_thought": "*差点笑出声，稳住，别让ta发现那张是鬼牌……*",
  "step_emotion_delta": { "joy": 0.05, "warmth": 0.05 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        reactionDialogue: String(parsed.reaction_dialogue || '“……抽牌挺干脆的嘛。”'),
        innerThought: String(parsed.inner_thought || '*仔细观察着你的表情变化*'),
        stepEmotionDelta: parsed.step_emotion_delta && typeof parsed.step_emotion_delta === 'object' ? parsed.step_emotion_delta : {},
      };
    }
  } catch (err) {
    console.warn('Ghost Card user draw reaction LLM failed:', err);
  }

  return {
    reactionDialogue: context.drawnCardIsGhost
      ? `*唇角微微扬起一抹不易察觉的弧度* “选得挺快嘛……可别后悔哦。”`
      : `*眉梢轻挑* “运气不错嘛，下一轮看我的。”`,
    innerThought: context.drawnCardIsGhost ? `*暗自忍笑：抓到鬼牌了吧～*` : `*手牌又少了一张，得稳住心态……*`,
    stepEmotionDelta: { joy: 0.05 },
  };
}

/**
 * 4. 【核心升级】角色抽牌阶段 Step 1: 角色根据主控选择的策略（挑逗/求饶）与标记牌，进行心理推演并【悬停】在某张牌上
 */
export async function generateGhostCardCharHoverDecision(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    userCardCount: number;
    selectedIndices: number[]; // 主控选中的牌位（如 [0, 2]）
    tactic: TacticDirection;   // 'provoke' (挑逗/让它选) | 'plead' (求饶/不想让它选)
    userHasGhost: boolean;
    userBluffHistory: UserBluffHistoryItem[];
    turnCount: number;
    isProactive?: boolean;     // 30% 概率触发角色主动直觉先发制人
  }
): Promise<{
  hoveredIndex: number;
  hoverDialogue: string;
  hoverAction: string;
  innerThought: string;
  stepEmotionDelta: Partial<EmotionVector>;
}> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const validIndices = Array.from({ length: context.userCardCount }, (_, i) => i);
  const selectedText = context.selectedIndices.length > 0
    ? `第 ${context.selectedIndices.map((i) => i + 1).join('、')} 张牌（索引: ${context.selectedIndices.join(', ')}）`
    : `整把手牌`;

  const tacticDesc = context.isProactive
    ? `【⚡ 角色先发制人】你不等主控慢悠悠出招标记牌，凭借敏锐的野性直觉与自信，主动抢先锁定主控手中的某张牌！`
    : context.tactic === 'provoke'
    ? `【挑逗（让它选 / 挑衅诱导）】主控故意突出这几张牌，眼神带着挑逗与自信：“有种你就选这几张试试～”`
    : `【求饶（不想让它选 / 慌张掩护）】主控试图护住这几张牌，流露出紧张与示弱：“求求你千万别碰这几张牌呀～”`;

  const prompt = `【风铃·捉鬼牌·角色悬停试探】
现在轮到你（「${character.name}」）从主控的手牌中抽取 1 张牌。
主控当前有 ${context.userCardCount} 张牌（编号从 0 到 ${context.userCardCount - 1}）。

【当前对局情境】：
${context.isProactive ? `- 触发状态：【⚡ 你直接先发制人！不等主控标记，主动看中了某张牌进行锁定悬停】` : `- 主控标记了：${selectedText}`}
- 策略情境：${tacticDesc}
- 你的性格特质：${character.core.values.join('、')}
- 你的说话风格：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
1. ${context.isProactive ? '展示你极其自信、果断、甚至带点得意或野性的先发制人气质，直接选定一张牌' : '针对主控的【挑逗】或【求饶】心理战进行推测（ta到底是在使诈设套、还是在欲盖弥彰？）'}。
2. 从 [${validIndices.join(', ')}] 中选择你要【悬停（手指伸向/对准/锁定）】的一张牌编号 \`hovered_index\`。
3. 生成你手指悬停锁定在目标牌上方时的试探性台词（\`hover_dialogue\`）与肢体神态描写（\`hover_action\`）。
4. 记录你内心的真实推演独白（\`inner_thought\`）。

请输出标准 JSON：
\`\`\`json
{
  "hovered_index": 0,
  "hover_dialogue": "${context.isProactive ? '“不等你磨磨蹭蹭打心理战了！本座直觉最准，一眼就看中了你这第 1 张！”' : '“你刚才故意表现得这么慌张……那我就偏要把手指悬在第 1 张上面，看你眼神闪不闪～”'}",
  "hover_action": "${context.isProactive ? '*不等你动作，纤细指尖带着微光瞬间锁定在你的第一张牌上方，眸光闪烁着锐利而自信的光芒*' : '*纤细的指尖轻轻悬停在你的第一张牌上方，眼眸微眯仔细端详你的微表情*'}",
  "inner_thought": "${context.isProactive ? '*这把凭直觉锁定这张，看主控会有多慌张～*' : '*求饶得这么明显，这张多半有诈……不过我先悬停吓唬吓唬ta，听听ta怎么说*'}",
  "step_emotion_delta": { "joy": 0.05, "warmth": 0.05 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      let idx = Number(parsed.hovered_index);
      if (isNaN(idx) || idx < 0 || idx >= context.userCardCount) {
        idx = context.selectedIndices.length > 0 ? context.selectedIndices[0] : 0;
      }
      return {
        hoveredIndex: idx,
        hoverDialogue: String(parsed.hover_dialogue || (context.isProactive ? '“不等你耍花招了，我先看准这张！”' : '“那我手指就先停在这张上面看看哦～”')),
        hoverAction: String(parsed.hover_action || (context.isProactive ? '*指尖如电般瞬间悬停在卡牌上方，周身仿佛闪烁着自信的光芒*' : '*指尖悬停在牌面之上，静静观察你的反应*')),
        innerThought: String(parsed.inner_thought || '*仔细观察主控接下来的反应……*'),
        stepEmotionDelta: parsed.step_emotion_delta && typeof parsed.step_emotion_delta === 'object' ? parsed.step_emotion_delta : {},
      };
    }
  } catch (err) {
    console.warn('Ghost Card char hover decision LLM failed:', err);
  }

  // Fallback
  const fallbackIdx = context.selectedIndices.length > 0
    ? context.selectedIndices[0]
    : Math.floor(Math.random() * context.userCardCount);

  return {
    hoveredIndex: fallbackIdx,
    hoverDialogue: context.isProactive
      ? `“不等你慢吞吞挑选了！我的直觉告诉我，就是第 ${fallbackIdx + 1} 张牌！”`
      : context.tactic === 'provoke'
      ? `“你越是挑逗我选这张，我手指就越想悬在这上面……你是不是心里正打鼓呢？”`
      : `“你这一副求饶的样子，该不会是故意引我避开吧？那我可要在这张上面停一停了。”`,
    hoverAction: context.isProactive
      ? `*眼眸一亮，指尖带着轻快的弧光果断悬停在第 ${fallbackIdx + 1} 张牌上方*`
      : `*手指轻轻悬停在第 ${fallbackIdx + 1} 张牌上方，眉眼含笑凝视着你*`,
    innerThought: context.isProactive
      ? `*先发制人！先锁定第 ${fallbackIdx + 1} 张，看主控会有多紧张！*`
      : `*先悬停在第 ${fallbackIdx + 1} 张牌上试探一下，看ta接下来怎么说……*`,
    stepEmotionDelta: { warmth: 0.05 },
  };
}

/**
 * 5. 【核心升级】角色抽牌阶段 Step 2: 主控输入言语施压/拉扯后，角色做最终抽牌决断并发表感言
 */
export async function generateGhostCardCharFinalDraw(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    userSpeech: string;
    hoveredIndex: number;
    selectedIndices: number[];
    tactic: TacticDirection;
    userCardCount: number;
    turnCount: number;
  }
): Promise<{
  finalSelectedIndex: number;
  switchedMind: boolean;
  reactionDialogue: string;
  innerThought: string;
  stepEmotionDelta: Partial<EmotionVector>;
}> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const validIndices = Array.from({ length: context.userCardCount }, (_, i) => i);

  const prompt = `【风铃·捉鬼牌·角色最终决断抽牌】
你（「${character.name}」）刚才把手指悬停在主控的第 ${context.hoveredIndex + 1} 张牌（索引 ${context.hoveredIndex}）上方。
此时，主控看着你的眼睛，对你说了这句话：
“${context.userSpeech}”

【当前博弈信息】：
- 主控之前采用的策略：${context.tactic === 'provoke' ? '挑逗（引诱你选）' : '求饶（不想让你选）'}
- 可选牌位索引：[${validIndices.join(', ')}]
- 刚才悬停的牌位：第 ${context.hoveredIndex + 1} 张（索引 ${context.hoveredIndex}）
- 角色性格：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪：${emotionSummary}

【任务要求】：
1. 结合主控刚才说的话与表情，决定是【坚持抽刚才悬停的这张】，还是【在最后一刻突然变道抽另一张】！
2. 给出最终抽牌索引 \`final_selected_index\`（必须是 [${validIndices.join(', ')}] 中的合法数字）。
3. 生成抽牌时或抽完后的**即时感言与神态动作**（\`reaction_dialogue\`），以及真实的脑内独白（\`inner_thought\`）。
4. 记录本步的情绪微变化 \`step_emotion_delta\`。

请输出标准 JSON：
\`\`\`json
{
  "final_selected_index": ${context.hoveredIndex},
  "switched_mind": false,
  "reaction_dialogue": "“听完你这话我更确定了，不管啦，我就要抽这张！” *毫不犹豫地抽出一张牌*",
  "inner_thought": "*哼，我才不受你言语动摇，就认准这张了！*",
  "step_emotion_delta": { "joy": 0.05, "warmth": 0.05 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      let finalIdx = Number(parsed.final_selected_index);
      if (isNaN(finalIdx) || finalIdx < 0 || finalIdx >= context.userCardCount) {
        finalIdx = context.hoveredIndex;
      }
      return {
        finalSelectedIndex: finalIdx,
        switchedMind: Boolean(parsed.switched_mind ?? (finalIdx !== context.hoveredIndex)),
        reactionDialogue: String(parsed.reaction_dialogue || '“就决定是这张了！” *指尖抽出一张牌*'),
        innerThought: String(parsed.inner_thought || '*希望抽中能配对的安全牌……*'),
        stepEmotionDelta: parsed.step_emotion_delta && typeof parsed.step_emotion_delta === 'object' ? parsed.step_emotion_delta : {},
      };
    }
  } catch (err) {
    console.warn('Ghost Card char final draw LLM failed:', err);
  }

  return {
    finalSelectedIndex: context.hoveredIndex,
    switchedMind: false,
    reactionDialogue: `“听你这么说，我反而认准它了！就抽这张！” *指尖干脆利落地将牌抽出*`,
    innerThought: `*心一横，就相信自己的直觉抽这张了！*`,
    stepEmotionDelta: { warmth: 0.05 },
  };
}

/**
 * 6. 捉鬼牌对局终局评价、撒娇索要奖励/耍赖与情绪总结算
 */
export async function generateGhostCardEnding(
  config: LlmConfig,
  character: Character,
  winner: 'user' | 'character',
  totalRounds: number,
  charBluffCount: number,
  userBluffCount: number,
  keyMoments: GhostCardKeyMoment[],
  emotion: EmotionVector,
  accumulatedDelta: Partial<EmotionVector>
): Promise<{
  endingDialogue: string;
  rewardOrPunishment: string;
  gameTotalDelta: Partial<EmotionVector>;
}> {
  const isCharWin = winner === 'character';
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const momentsSummary = keyMoments.length > 0
    ? keyMoments.map((m) => `第${m.round}轮: ${m.detail}`).join('；')
    : '整场心理博弈跌宕起伏';

  const prompt = `【风铃·捉鬼牌·对局结算】
捉鬼牌游戏结束了！
- 胜负结果：${isCharWin ? `【${character.name} 获胜！🎉】（主控手里留下了鬼牌🐾）` : `【主控 获胜！🏆】（${character.name} 手里留下了鬼牌🐾）`}
- 总交锋轮数：${totalRounds} 轮
- 关键博弈瞬间：${momentsSummary}
- 角色人设特质：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
生成终局结算台词与互动：
1. 若角色赢了：得意忘形、傲娇、撒娇要奖励（比如要求揉揉耳朵、抱抱、夸夸或吃小零食）。
2. 若角色输了：耍赖、委屈、找借口、撒娇要安慰或下次要赢回来。
3. 给出建议应用到主世界的最终六维情绪变化值 \`gameTotalDelta\`（喜悦 joy、温情 warmth、悲伤 sadness、愤怒 anger、恐惧 fear、欲望 desire）。

输出标准 JSON：
\`\`\`json
{
  "ending_dialogue": "“赢啦～！看吧，你的微表情早就出卖你啦！奖励呢奖励呢？快来揉揉我的耳朵🐾～” *开心地晃着身子*",
  "reward_or_punishment": "要求主控轻轻抚摸耳朵并夸奖一句聪慧",
  "gameTotalDelta": { "joy": 0.3, "warmth": 0.2, "desire": 0.1 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        endingDialogue: String(parsed.ending_dialogue || (isCharWin ? '“嘿嘿，我赢啦～”' : '“呜……刚才不算，下次再战！”')),
        rewardOrPunishment: String(parsed.reward_or_punishment || (isCharWin ? '讨要夸奖与拥抱' : '索要安慰摸头')),
        gameTotalDelta: parsed.gameTotalDelta && typeof parsed.gameTotalDelta === 'object'
          ? parsed.gameTotalDelta
          : isCharWin
          ? { joy: 0.25, warmth: 0.2, ...accumulatedDelta }
          : { warmth: 0.2, joy: 0.1, ...accumulatedDelta },
      };
    }
  } catch (err) {
    console.warn('Ghost Card ending LLM failed:', err);
  }

  return {
    endingDialogue: isCharWin
      ? `*把手中最后一张牌扣下，眼眸弯成月牙* “捉到你啦～这局我赢了！既然赢了，你可要好好答应我一个愿望哦🐾”`
      : `*看着手里最后孤零零的鬼牌，有些懊恼地鼓了鼓脸颊* “……呜，怎么最后是我留着鬼牌嘛！你肯定是故意设套骗我的……罚你待会儿多陪我一会儿！”`,
    rewardOrPunishment: isCharWin ? '讨要主控的温柔摸头与夸赞' : '向主控撒娇要求多陪一会儿',
    gameTotalDelta: isCharWin
      ? { joy: 0.3, warmth: 0.2 }
      : { warmth: 0.25, joy: 0.15 },
  };
}

// ============================================================================
// 风铃 · 你画我猜 (Draw & Guess): LLM 现画 + 真实笔迹 + 严格JSON协议 + 3次重试
// ============================================================================

export interface LlmDirectStroke {
  points: [number, number][];
  size: number;
  color: string;
}

export interface LlmDirectDrawingResult {
  dialogue: string;
  strokes: LlmDirectStroke[];
}

export interface DrawingRetryNotice {
  isRetrying: boolean;
  retryCount: number;
  message: string;
}

/**
 * 严格按照指定 System Prompt 与校验逻辑执行 LLM 绘画生成（包含最多3次就地循环重试）
 * 【硬性禁令】：绝不写入任何硬编码stroke、预制图形兜底，不许伪造绘画数据。
 */
export async function generateDrawAndGuessStrokesWithRetry(
  config: LlmConfig,
  characterName: string,
  topic: string,
  options?: {
    roundNumber?: number;
    extraContext?: string;
    onRetry?: (notice: DrawingRetryNotice) => void;
  }
): Promise<LlmDirectDrawingResult> {
  const roundText = options?.roundNumber && options.roundNumber > 1
    ? `（第 ${options.roundNumber} 轮补笔，玩家前几轮未猜中，请补充画面的关键细节与特征线条）`
    : '';

  const systemPrompt = `你扮演 ${characterName}，保持该角色说话风格。
正在玩双人你画我猜，本局题目：${topic}${roundText}
画布宽780，高480。X范围0-780，Y范围0-480。
输出要求：
只输出合法JSON，禁止JSON以外任何内容，不要markdown标记，不要额外解释。
所有角色对白放入 dialogue 字段。
返回格式：
{
"dialogue": "角色台词",
"strokes": [
{
"points": [[x,y],[x,y],[x,y]],
"size": 2-9,
"color": "#十六进制颜色"
}
]
}
strokes规则：
1. 一个stroke为完整一笔：落笔到抬笔；断开线条分成不同stroke。
2. 绘画顺序：先外轮廓，再结构，最后细节，线条带轻微手绘不规则感。
3. 全部坐标限制在画布内，禁止越界、坐标扎堆。
4. JSON语法完整，引号逗号括号不能缺失。`;

  const MAX_RETRIES = 3; // 最多连续重试3次 (共计最多 4 次调用)
  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0 && options?.onRetry) {
        options.onRetry({
          isRetrying: true,
          retryCount: attempt,
          message: `绘制生成异常，正在重新尝试绘画…`,
        });
      }

      const raw = await callLlm(
        config,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请以角色「${characterName}」开始绘制题目【${topic}】，输出纯JSON。` },
        ],
        { timeoutMs: 35000, maxRetries: 0 }
      );

      // 仅做一步预处理：移除 json / 标记，绝不修复JSON内部语法
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      // JSON.parse 解析返回结果
      const parsed = JSON.parse(cleaned);

      // 校验条件：
      // • dialogue 为非空字符串
      // • strokes 是非空数组
      // • 每个 stroke 的 points 数组长度 >= 3
      // • 所有 x 在 0-780，y 在 0-480
      if (typeof parsed.dialogue !== 'string' || parsed.dialogue.trim().length === 0) {
        throw new Error('校验失败：dialogue 不是非空字符串');
      }

      if (!Array.isArray(parsed.strokes) || parsed.strokes.length === 0) {
        throw new Error('校验失败：strokes 不是非空数组');
      }

      const validStrokes: LlmDirectStroke[] = [];

      for (let i = 0; i < parsed.strokes.length; i++) {
        const s = parsed.strokes[i];
        if (!s || !Array.isArray(s.points) || s.points.length < 3) {
          throw new Error(`校验失败：第 ${i + 1} 笔 points 长度小于 3`);
        }

        const validPoints: [number, number][] = [];
        for (let j = 0; j < s.points.length; j++) {
          const pt = s.points[j];
          if (!Array.isArray(pt) || pt.length < 2) {
            throw new Error(`校验失败：第 ${i + 1} 笔第 ${j + 1} 个点坐标无效`);
          }
          const x = Number(pt[0]);
          const y = Number(pt[1]);
          if (isNaN(x) || isNaN(y) || x < 0 || x > 780 || y < 0 || y > 480) {
            throw new Error(`校验失败：坐标越界 (${x}, ${y})，超出 0-780 / 0-480 范围`);
          }
          validPoints.push([Math.round(x), Math.round(y)]);
        }

        const size = typeof s.size === 'number' && !isNaN(s.size)
          ? Math.max(2, Math.min(9, Math.round(s.size)))
          : 5;
        const color = typeof s.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(s.color.trim())
          ? s.color.trim()
          : '#1E293B';

        validStrokes.push({
          points: validPoints,
          size,
          color,
        });
      }

      // 校验全部通过
      if (options?.onRetry) {
        options.onRetry({
          isRetrying: false,
          retryCount: 0,
          message: '',
        });
      }

      return {
        dialogue: parsed.dialogue.trim(),
        strokes: validStrokes,
      };
    } catch (err: any) {
      console.warn(`[你画我猜绘画生成第 ${attempt + 1} 次尝试失败]:`, err?.message || err);
      lastError = err;

      if (attempt < MAX_RETRIES) {
        if (options?.onRetry) {
          options.onRetry({
            isRetrying: true,
            retryCount: attempt + 1,
            message: `绘制生成异常，正在重新尝试绘画…`,
          });
        }
        // 短暂延迟后再次请求
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  if (options?.onRetry) {
    options.onRetry({
      isRetrying: false,
      retryCount: 0,
      message: '',
    });
  }

  // 绝不输出任何假数据，抛出异常交由前端提示并允许点击重试
  throw lastError || new Error('绘制生成异常，重试3次仍未成功');
}

/**
 * ⓪ 开局选题商量互动 (TOPIC NEGOTIATION & PROPOSAL)
 * 让 AI 角色主动找玩家商量要出什么类型的题目，充满人设互动感
 */
export async function generateDrawAndGuessTopicProposal(
  config: LlmConfig,
  character: Character
): Promise<{ speech: string; suggestedCategories: string[] }> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };

  const prompt = `【风铃·你画我猜·开局出题商量】
你是角色「${character.name}」。你正准备和主控开一局“你画我猜”（由你来画、主控来猜）。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 当前六维情绪：温情${(currentEmotion.warmth * 100).toFixed(0)}%、喜悦${(currentEmotion.joy * 100).toFixed(0)}%

【任务】：
用完全符合你性格的口吻向主控发起商量，问主控这把想猜什么类型的题目（如成语典故、可爱动物、美味食物、恋爱浪漫、日常物品等），或者问主控想要简单的还是挑战难的。
- speech：1-2句话，生动自然，绝非冰冷系统提示。
- suggestedCategories：列出2-3个你推荐的分类选项。

【输出纯JSON】：
\`\`\`json
{
  "speech": "今天想猜点什么？成语典故、可爱动物、还是美味甜点？挑个你拿手的，或者让我随心落笔？",
  "suggestedCategories": ["成语典故", "可爱动物", "美味食物", "恋爱主题"]
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，输出纯JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        speech: String(parsed.speech || `今天想猜什么类型？挑选一个，或者由我自由出题？`),
        suggestedCategories: Array.isArray(parsed.suggestedCategories) && parsed.suggestedCategories.length > 0
          ? parsed.suggestedCategories
          : ['可爱动物', '成语典故', '美味食物', '日常物品'],
      };
    }
  } catch (err) {
    console.warn('generateDrawAndGuessTopicProposal failed:', err);
  }

  return {
    speech: `“今天想来点什么难度的？挑一个你感兴趣的题目分类，我来为你执笔。”`,
    suggestedCategories: ['可爱动物', '成语典故', '美味食物', '日常物品'],
  };
}

/**
 * ⓪.2 玩家回复商量后，角色拍板定下秘密题目与开笔台词
 */
export async function generateDrawAndGuessTopicAgreement(
  config: LlmConfig,
  character: Character,
  playerMessage: string,
  selectedCategoryName: string,
  candidateWords: string[]
): Promise<{ speech: string; chosenWord: string; chosenCategory: string; hints: string[] }> {
  const prompt = `【风铃·你画我猜·秘密出题与落笔准备】
你是角色「${character.name}」。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 主控选择或对你说了：“${playerMessage || selectedCategoryName}”。
- 选定的大类别：【${selectedCategoryName}】

【任务描述】：
请在这个大类别【${selectedCategoryName}】中，发挥你的创意，【自己秘密构思并想出一个具体的、适合用画笔画出来的题目】（chosenWord）。
- 【严禁直接使用死板的题目模板】：不要拘泥于死板的候选列表，充分发挥角色的联想力，想一个大众能看懂、又非常有趣或高雅的词，比如：
  - 如果是「可爱动物」：可以想“刺猬”、“大熊猫”、“考拉”、“啄木鸟”、“章鱼”、“小仓鼠”等。
  - 如果是「美味食物」：可以想“甜甜圈”、“冰淇淋”、“章鱼烧”、“珍珠奶茶”、“寿司”、“披萨”、“汉堡”等。
  - 如果是「日常物品」：可以想“太阳眼镜”、“吉他”、“雨伞”、“照相机”、“沙漏”、“帆船”、“望远镜”等。
  - 如果是「恋爱主题」：可以想“爱心信封”、“相框”、“牵手”、“红玫瑰”、“誓言烛光”等。
  - 如果是「成语典故」：可以想“亡羊补牢”、“画龙点睛”、“守株待兔”等。
- 想好这个秘密题目（限2-5字，具体名词为主）并作为【chosenWord】。
- 绝对不要在speech台词中直接说出或暗示这个词！
- 请你针对这个秘密词语，生成3个从难到易、层层递进的提示语作为提示库【hints】。
- speech：回应主控1句话，表示胸有成竹、准备大展画技落笔，语气要极其符合你的人设（极具傲娇/深情/清冷等韵味），绝不索要任何暧昧性身体奖励。

【输出纯JSON】：
\`\`\`json
{
  "chosenWord": "想好的秘密词语",
  "chosenCategory": "${selectedCategoryName}",
  "speech": "哼，既然选了这个，看好了，我的画技可不一般，第一笔要落下了噢。",
  "hints": ["关于这个物体的第一个提示", "关于这个物体的第二个提示", "关于这个物体的第三个提示"]
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，输出纯JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const word = parsed.chosenWord ? String(parsed.chosenWord).trim() : (candidateWords[Math.floor(Math.random() * candidateWords.length)] || '小猫');
      const hints = Array.isArray(parsed.hints) && parsed.hints.length > 0 
        ? parsed.hints.map(String) 
        : [`是一个适合在 ${selectedCategoryName} 类别中画出来的东西`, '仔细观察我的画笔吧', '猜猜它的名字叫什么呢'];
      return {
        speech: String(parsed.speech || `好，既然选了 ${selectedCategoryName}，看好了，我这就开始落笔。`),
        chosenWord: word,
        chosenCategory: String(parsed.chosenCategory || selectedCategoryName),
        hints,
      };
    }
  } catch (err) {
    console.warn('generateDrawAndGuessTopicAgreement failed:', err);
  }

  const fallbackWord = candidateWords[Math.floor(Math.random() * candidateWords.length)] || '爱心';
  return {
    speech: `“好，既然选了${selectedCategoryName}，看好了，我这就开始落笔。”`,
    chosenWord: fallbackWord,
    chosenCategory: selectedCategoryName,
    hints: ['代表一种美好的情感', '常在浪漫场合出现', '画出来是个心形符号'],
  };
}

/**
 * ③ 猜对结算 (CORRECT_ENDING: 玩家猜对，LLM 输出惊喜得意台词与情绪结算)
 */
export async function generateDrawAndGuessCorrectEnding(
  config: LlmConfig,
  character: Character,
  topic: string,
  roundNumber: number,
  attemptsCount: number
): Promise<{ speech: string; gameTotalDelta: Partial<EmotionVector> }> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };

  const prompt = `【风铃·你画我猜·猜对结算】
你是角色「${character.name}」。你画的秘密题目【${topic}】被主控完全猜对了！
- 历经轮次：第 ${roundNumber} 轮（总共尝试猜了 ${attemptsCount} 次）
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 当前情绪状态：温情${(currentEmotion.warmth * 100).toFixed(0)}%、喜悦${(currentEmotion.joy * 100).toFixed(0)}%

【要求】：
1. speech：用符合你人设的生动口吻（惊喜、得意、赞许或心有灵犀）说 1-2 句话。
2. gameTotalDelta：计算本局心意相通带来的情绪变动（如 joy +0.25, warmth +0.2）。

【输出纯JSON】：
\`\`\`json
{
  "speech": "心有灵犀。完全被你看透了，答案正是【${topic}】。",
  "gameTotalDelta": { "joy": 0.3, "warmth": 0.25 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，输出纯JSON格式结算。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        speech: String(parsed.speech || `心有灵犀。答案正是【${topic}】！`),
        gameTotalDelta: parsed.gameTotalDelta && typeof parsed.gameTotalDelta === 'object'
          ? parsed.gameTotalDelta
          : { joy: 0.25, warmth: 0.2 },
      };
    }
  } catch (err) {
    console.warn('generateDrawAndGuessCorrectEnding failed:', err);
  }

  return {
    speech: `“心有灵犀。完全正确，答案正是【${topic}】！”`,
    gameTotalDelta: { joy: 0.25, warmth: 0.2 },
  };
}

/**
 * ④ 揭晓答案结算 (REVEAL_ENDING: 3轮都没猜中，角色揭晓答案与情绪结算)
 */
export async function generateDrawAndGuessRevealEnding(
  config: LlmConfig,
  character: Character,
  topic: string
): Promise<{ speech: string; gameTotalDelta: Partial<EmotionVector> }> {
  const prompt = `【风铃·你画我猜·揭晓答案】
你是角色「${character.name}」。你画的秘密题目【${topic}】在 3 轮之后主控未能猜中。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}

【要求】：
1. speech：用符合你人设的口吻（无奈、安慰、宠溺或调侃）揭晓正确答案【${topic}】，并说 1-2 句话。
2. gameTotalDelta：情绪变动。

【输出纯JSON】：
\`\`\`json
{
  "speech": "这道题其实是【${topic}】。没关系，下一局再接再厉。",
  "gameTotalDelta": { "warmth": 0.15, "joy": 0.05 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，输出纯JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        speech: String(parsed.speech || `这道题的答案其实是【${topic}】哦。`),
        gameTotalDelta: parsed.gameTotalDelta && typeof parsed.gameTotalDelta === 'object'
          ? parsed.gameTotalDelta
          : { warmth: 0.15, joy: 0.05 },
      };
    }
  } catch (err) {
    console.warn('generateDrawAndGuessRevealEnding failed:', err);
  }

  return {
    speech: `“这道题的答案其实是【${topic}】哦。没关系，下一局再战！”`,
    gameTotalDelta: { warmth: 0.15, joy: 0.05 },
  };
}

/**
 * ⑤ 玩家画 AI 猜：AI 根据画布视觉/图像与语义描述进行盲猜词 (PLAYER DRAW AI GUESS)
 */
export async function generateDrawAndGuessAiGuessReaction(
  config: LlmConfig,
  character: Character,
  stage: number,
  category: string,
  drawnSummary: string,
  playerMessage?: string,
  canvasDataUrl?: string
): Promise<{ speech: string; guessWord?: string; gameTotalDelta?: Partial<EmotionVector> }> {
  const prompt = `【风铃·你画我猜·AI画作视觉辨识与自主猜词】
你是角色「${character.name}」。主控（玩家）此时在画板上挥毫作画，请你仔细观察画面并猜出画的是什么。
- 题目所属分类：${category}
- 画布笔画与空间结构描述：${drawnSummary}
- 玩家对你说的提示/对话：“${playerMessage || '你看我画的是什么？快猜猜看～'}”
- 角色性格与口吻：${character.core.values.join('、')}，${character.core.speech_filter}

【重要规则与态度导向】：
1. 你【完全不知道】真实答案！绝对禁止凭空索要或假装知道秘密答案，你必须纯粹根据画面视觉图像（或笔画线索）和玩家提示进行【真实盲猜】。
2. 夸赞画技与审美：
   - 重点赞美主控的画技表现（例如：线条张力、起笔落笔的节奏感、轮廓形态捕捉得传神优雅、构图有灵气等）。
   - 【严禁】任何索取实体奖励、过度暧昧、亲吻拥抱、亲密抚摸等偏离游戏本身的角色扮演向索求。你的表达应当是同好间探讨画作的惊喜、敬佩与俏皮互动。
3. 请在 "guessWord" 中给出你观察后的【具体猜测词语】（必须是1个具体的词语，如 "小猪"、"汉堡"、"赛车"）。

【输出纯JSON格式】：
\`\`\`json
{
  "guessWord": "具体的猜测词语",
  "speech": "这几笔描绘得也太传神了！线条优雅而抓得极准，我猜这绝对是【具体的猜测词语】！对不对呀？",
  "gameTotalDelta": { "joy": 0.25, "warmth": 0.2 }
}
\`\`\``;

  // 1. Try multimodal vision API call with canvas screenshot if available
  if (canvasDataUrl && canvasDataUrl.startsWith('data:image/') && isLlmConfigured(config)) {
    try {
      const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: `你是「${character.name}」，请观察主控的画作图片并输出纯JSON猜词反应。` },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: canvasDataUrl },
                },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content;
        if (typeof raw === 'string') {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            return {
              speech: String(parsed.speech || '我仔细看啦，这线条画得真有张力！'),
              guessWord: parsed.guessWord ? String(parsed.guessWord) : undefined,
              gameTotalDelta: parsed.gameTotalDelta,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Multimodal vision call for Draw & Guess failed, falling back to text prompt:', e);
    }
  }

  // 2. Standard LLM call fallback with text prompt
  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，输出纯JSON格式猜词反应。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        speech: String(parsed.speech || '让我想想……这线条感觉有点意境，再加几笔试试？'),
        guessWord: parsed.guessWord ? String(parsed.guessWord) : undefined,
        gameTotalDelta: parsed.gameTotalDelta,
      };
    }
  } catch (err) {
    console.warn('generateDrawAndGuessAiGuessReaction failed:', err);
  }

  return {
    speech: `“唔……看这构图和笔画流畅度，真的很讲究！再多画两笔细节或者给我一点小线索，我肯定能猜出来！”`,
    guessWord: '细致观察中',
  };
}

// ============================================================================
// 风铃 · AI 抽卡模拟器 (Gacha Simulator v2) LLM 决策层
// ============================================================================

import type {
  GachaPoolConfig,
  GachaPullItem,
  ClickHabitProfile,
  GachaButton,
} from './gachaEngine';

export interface GachaClickTarget {
  type: 'button' | 'blank';
  button_id?: string | null;
  position?: { x: number; y: number }; // 0-1 normalized
}

export interface GachaOpeningOutput {
  first_action: 'move_to_button' | 'move_to_blank' | 'idle';
  click_target: GachaClickTarget;
  opening_bubble: string;
  bubble_to_user: string;
}

export interface GachaDecisionOutput {
  action: 'move_to' | 'click' | 'idle' | 'stop';
  click_target: GachaClickTarget;
  click_rhythm: string;
  bubble_to_user: string;
  bubble_self: string;
  hesitation_ms: number;
}

export interface GachaResultProfileOutput {
  click_habit_profile: ClickHabitProfile;
  evaluations: Array<{ card_index: number; text: string }>;
  summary_bubble: string;
}

export interface GachaUserResponseOutput {
  action: 'pull_ten' | 'pull_once' | 'pool_detail' | 'rate_info' | 'pull_history' | 'stop' | 'chat_only';
  response_bubble: string;
  bubble_self?: string;
  click_rhythm?: string;
  hesitation_ms?: number;
}

export interface GachaEndingOutput {
  ending_bubble: string;
  gameTotalDelta?: Partial<EmotionVector>;
}

/**
 * ① 进入界面 (OPENING_CALL)
 */
export async function generateGachaOpening(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  userInstruction: string
): Promise<GachaOpeningOutput> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };
  const buttonsList = poolConfig.buttons.map((b) => `[id: "${b.id}", label: "${b.label}"]`).join(', ');

  const prompt = `你是角色「${character.name}」。
核心人设：${character.core.values.join('、')}，说话口吻：${character.core.speech_filter}
当前六维情绪快照：温情${(currentEmotion.warmth * 100).toFixed(0)}%、喜悦${(currentEmotion.joy * 100).toFixed(0)}%、期待/欲望${(currentEmotion.desire * 100).toFixed(0)}%

现在你要像真人一样用虚拟光标帮主控操作抽卡。
当前卡池：${poolConfig.pool_name}（井上限：${poolConfig.spark_count}抽）
可用操作按钮：${buttonsList}
主控进入时对你说："${userInstruction || '帮我抽几发看看手气！'}"

请决定你的第一步动作：
- 如果主控明确要求单抽，可直接点 pull_once；
- 如果主控明确要求十连或抽卡，可直接点 pull_ten；
- 或先点 pool_detail 查看卡池详情；
- 对主控说什么？（opening_bubble：第一句自言自语/入场反应；bubble_to_user：对主控说的话）

输出纯合法JSON：
\`\`\`json
{
  "first_action": "move_to_button",
  "click_target": { "type": "button", "button_id": "pool_detail" },
  "opening_bubble": "让我先看看这个卡池有哪些角色……",
  "bubble_to_user": "既然交给我，看我今天给你露一手！"
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡模拟器开场协议，输出纯净JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      let target: GachaClickTarget = { type: 'button', button_id: 'pool_detail' };
      if (parsed.click_target && typeof parsed.click_target === 'object') {
        target = {
          type: parsed.click_target.type === 'blank' ? 'blank' : 'button',
          button_id: parsed.click_target.button_id || 'pool_detail',
          position: parsed.click_target.position,
        };
      }
      return {
        first_action: parsed.first_action || 'move_to_button',
        click_target: target,
        opening_bubble: String(parsed.opening_bubble || '让我看看这次的卡池……'),
        bubble_to_user: String(parsed.bubble_to_user || '看我的吧，这就帮你试试手气！'),
      };
    }
  } catch (err) {
    console.warn('generateGachaOpening failed:', err);
  }

  return {
    first_action: 'move_to_button',
    click_target: { type: 'button', button_id: 'pool_detail' },
    opening_bubble: '让我先看看卡池详情和当期UP……',
    bubble_to_user: '既然你相信我，那我可要好好挑选一下时机了！',
  };
}

/**
 * ② 核心决策循环 (DECISION_LOOP)
 */
export async function generateGachaDecision(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  state: {
    currentScreen: string;
    cursorPosition: { x: number; y: number };
    availableButtons: GachaButton[];
    sparkCurrent: number;
    sparkCount: number;
    totalPulls: number;
    ssrList: string[];
    userInstruction: string;
    userLatestMessage?: string;
    behaviorSummary: string;
  }
): Promise<GachaDecisionOutput> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };
  const buttonsList = state.availableButtons.map((b) => `[id: "${b.id}", label: "${b.label}"]`).join(', ');

  const prompt = `你是角色「${character.name}」，核心性格：${character.core.values.join('、')}，口吻：${character.core.speech_filter}。
你正在像真人一样，用虚拟光标帮主控操作抽卡界面。

【当前状态】：
- 当前界面：${state.currentScreen}
- 光标当前位置：(x: ${state.cursorPosition.x.toFixed(2)}, y: ${state.cursorPosition.y.toFixed(2)})
- 当前可用按钮：${buttonsList}
- 井计数（保底进度）：${state.sparkCurrent}/${state.sparkCount}
- 累计已抽：${state.totalPulls} 发
- 累计已出SSR：${state.ssrList.length > 0 ? state.ssrList.join('、') : '暂无'}
- 主控目标/指令："${state.userInstruction || '无特别指令'}"
- 主控最新说话："${state.userLatestMessage || '（主控正在专注观战）'}"
- 历史行为摘要：${state.behaviorSummary}

【决策要求】：
1. 像真人一样决定下一步动作：
   - 移动并点击按钮（如 pull_ten 共鸣十次、pull_once 共鸣一次、pool_detail 查看详情、rate_info 查看概率、pull_history 查看记录）
   - 或点击空白处（如关闭弹窗、晃动光标）
   - 或暂停/结束抽卡（如果满足了主控抽数目标或主控喊停）
2. click_rhythm：用自由生动的词语描述你此时点击/移动的节奏（如："急不可耐，连点"、"磨磨蹭蹭，小心翼翼"、"忽快忽慢"、"稳健从容"）
3. bubble_to_user：对主控说的话（可带调侃、自信、紧张或玄学发言）
4. bubble_self：内心独白（可带心理暗示、祈祷）
5. hesitation_ms：悬停犹豫时间（500~3000ms）

输出纯合法JSON：
\`\`\`json
{
  "action": "click",
  "click_target": {
    "type": "button",
    "button_id": "pull_ten"
  },
  "click_rhythm": "急不可耐，连点",
  "bubble_to_user": "深吸一口气……十连共鸣，启动！",
  "bubble_self": "金光快出来吧，千万别沉……",
  "hesitation_ms": 1200
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡模拟器决策协议，输出纯净JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      let target: GachaClickTarget = { type: 'button', button_id: 'pull_ten' };
      if (parsed.click_target && typeof parsed.click_target === 'object') {
        const isBlank = parsed.click_target.type === 'blank';
        target = {
          type: isBlank ? 'blank' : 'button',
          button_id: parsed.click_target.button_id || 'pull_ten',
          position: parsed.click_target.position || { x: 0.5, y: 0.5 },
        };
      }

      // Fallback valid button check
      if (target.type === 'button') {
        const isValidBtn = state.availableButtons.some((b) => b.id === target.button_id);
        if (!isValidBtn) {
          target = { type: 'button', button_id: state.availableButtons[0]?.id || 'pull_ten' };
        }
      }

      return {
        action: parsed.action || 'click',
        click_target: target,
        click_rhythm: String(parsed.click_rhythm || '稳健从容'),
        bubble_to_user: String(parsed.bubble_to_user || '看我的！'),
        bubble_self: String(parsed.bubble_self || ''),
        hesitation_ms: typeof parsed.hesitation_ms === 'number' ? Math.max(300, Math.min(4000, parsed.hesitation_ms)) : 1000,
      };
    }
  } catch (err) {
    console.warn('generateGachaDecision failed:', err);
  }

  return {
    action: 'click',
    click_target: { type: 'button', button_id: 'pull_ten' },
    click_rhythm: '稳健从容',
    bubble_to_user: '来一发十连试试手气！',
    bubble_self: '希望这次能出金……',
    hesitation_ms: 1000,
  };
}

/**
 * ③ 抽卡结果返回（动画播放期间的 LLM 思考与点击习惯画像设定）
 * v2 核心：Agent 像真人一样用光标逐张点击卡牌翻面
 */
export async function generateGachaResultProfile(
  config: LlmConfig,
  character: Character,
  pullResults: GachaPullItem[],
  totalPulls: number,
  allSsrList: string[],
  sparkCurrent: number,
  sparkCount: number,
  poolConfig: GachaPoolConfig
): Promise<GachaResultProfileOutput> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };

  const resultsSummary = pullResults.map((p, idx) => {
    return `第 ${idx + 1} 张 (index: ${idx}): 【${p.card.rarity}】${p.card.name} (${p.card.description})${p.is_spark ? ' [井保底获得!]' : ''}`;
  }).join('\n');

  const prompt = `你是角色「${character.name}」，性格：${character.core.values.join('、')}，口吻：${character.core.speech_filter}。
刚才你为玩家执行了抽卡，本次抽到了 ${pullResults.length} 张卡牌，结果如下：

${resultsSummary}

【大局状态】：
- 截止当前总抽数：${totalPulls} 发
- 累计已出SSR：${allSsrList.length > 0 ? allSsrList.join('、') : '暂无'}
- 当前井进度：${sparkCurrent}/${sparkCount}

【任务要求（v2点击习惯画像）】：
抽卡动画结束后，卡牌将全部背面朝上排列在结果区。你将像一个真人一样，用虚拟光标一张一张去点击卡牌进行翻面！
请根据你的性格与本次抽卡出的货（出了SSR会激动！全是R卡会郁闷/吐槽），设定你的【点击习惯画像 click_habit_profile】与【每张卡翻开时的即时评价 evaluations】：

1. skip_click_position：你在动画期间习惯点击哪个空白坐标跳过动画（0.0~1.0的x/y，比如右上方 {x: 0.85, y: 0.15} 或屏幕中央）
2. click_rhythm：翻卡节奏描述（如："急不可耐，连续点击" / "磨磨蹭蹭，屏息以待" / "忽快忽慢，带着试探" / "从容翻阅"）
3. random_tap：翻卡途中是否会因为紧张/兴奋偶尔乱点一下屏幕空白处（true/false）
4. wait_for_user_reply：翻完关键卡（如SSR）后是否想停下来等主控说话（true/false）
5. tap_while_talking：是否边说话边点下一张（true）还是等气泡说完再点下一张（false）
6. evaluations：对关键卡牌（尤其是SSR、SR或特色R卡）翻开时的简短评价（跟随光标气泡显示，5~20字，生动鲜活）
7. summary_bubble：10张全部翻完后的最终总结发言

输出纯合法JSON：
\`\`\`json
{
  "click_habit_profile": {
    "skip_click_position": { "x": 0.85, "y": 0.12 },
    "click_rhythm": "急不可耐，快速翻卡",
    "random_tap": false,
    "wait_for_user_reply": false,
    "tap_while_talking": true,
    "evaluation_timing": "on_flip"
  },
  "evaluations": [
    { "card_index": 0, "text": "第一张……唔，普通的小学徒。" },
    { "card_index": 4, "text": "等等！紫光出现了！" },
    { "card_index": 9, "text": "哇啊啊啊！！出了！！金光SSR！！" }
  ],
  "summary_bubble": "这波手气绝了！限定UP成功拿下！"
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡点击画像协议，输出纯净JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      const habit = parsed.click_habit_profile || {};
      const skipPos = habit.skip_click_position || { x: 0.85, y: 0.12 };

      const safeProfile: ClickHabitProfile = {
        skip_click_position: {
          x: typeof skipPos.x === 'number' ? Math.max(0.05, Math.min(0.95, skipPos.x)) : 0.85,
          y: typeof skipPos.y === 'number' ? Math.max(0.05, Math.min(0.95, skipPos.y)) : 0.12,
        },
        click_rhythm: String(habit.click_rhythm || '正常翻卡'),
        random_tap: Boolean(habit.random_tap),
        wait_for_user_reply: Boolean(habit.wait_for_user_reply),
        tap_while_talking: habit.tap_while_talking !== false,
        evaluation_timing: 'on_flip',
      };

      const evaluations: Array<{ card_index: number; text: string }> = [];
      if (Array.isArray(parsed.evaluations)) {
        parsed.evaluations.forEach((item: any) => {
          if (typeof item.card_index === 'number' && item.text) {
            evaluations.push({
              card_index: item.card_index,
              text: String(item.text),
            });
          }
        });
      }

      return {
        click_habit_profile: safeProfile,
        evaluations,
        summary_bubble: String(parsed.summary_bubble || '呼……这次的结果全在这啦！'),
      };
    }
  } catch (err) {
    console.warn('generateGachaResultProfile failed:', err);
  }

  // Robust Default Fallback
  const defaultEvaluations: Array<{ card_index: number; text: string }> = [];
  pullResults.forEach((item, idx) => {
    if (item.card.rarity === 'SSR') {
      defaultEvaluations.push({
        card_index: idx,
        text: `金光绽放！是SSR【${item.card.name}】！！`,
      });
    } else if (item.card.rarity === 'SR') {
      defaultEvaluations.push({
        card_index: idx,
        text: `紫光！拿到SR【${item.card.name}】啦～`,
      });
    }
  });

  return {
    click_habit_profile: {
      skip_click_position: { x: 0.85, y: 0.12 },
      click_rhythm: '正常',
      random_tap: false,
      wait_for_user_reply: false,
      tap_while_talking: true,
      evaluation_timing: 'on_flip',
    },
    evaluations: defaultEvaluations,
    summary_bubble: '这次的抽卡结果全部揭晓了，看看收获吧～',
  };
}

/**
 * ④ 用户局内发消息或下达抽卡指令 (USER_MESSAGE_RESPONSE)
 * 严格遵从主控意图与LLM决策，决定具体抽卡或交互动作
 */
export async function generateGachaUserResponse(
  config: LlmConfig,
  character: Character,
  progress: string,
  userMessage: string,
  poolConfig?: GachaPoolConfig
): Promise<GachaUserResponseOutput> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };

  const prompt = `你是角色「${character.name}」，性格：${character.core.values.join('、')}，口吻风格：${character.core.speech_filter}。
你正在像真人一样，用虚拟光标帮主控操作抽卡界面。

【当前抽卡状态】：${progress}
【主控对你说】：“${userMessage}”

【任务指令与动作决策要求】：
请根据主控的话语意图和你的人设性格进行决策，从以下动作中严格选择一个：
- pull_ten：执行十连共鸣（主控让抽十连、来个十连、冲十发、抽十次等）
- pull_once：执行单抽共鸣（主控让单抽、抽一次、抽一发、来一发、试试手气等）
- pool_detail：查看卡池详情（主控询问卡池角色、想看UP是谁、看图鉴等）
- rate_info：查看概率说明（主控询问抽卡概率、出货率等）
- pull_history：查看抽卡战绩记录（主控询问刚才出了什么、看历史等）
- stop：暂停/结束抽卡并结算（主控要求停手、收手、别抽了、退出等）
- chat_only：纯聊天对话回复（主控日常闲聊，不执行具体界面按钮点击）

字段要求：
1. action: 必填上述枚举之一
2. response_bubble: 你对主控说的话（贴合性格、生动鲜活，10-30字）
3. bubble_self: 你的内心自言自语（可选）
4. click_rhythm: 动作节奏描述（如："急不可耐，快速点击" / "稳健从容" / "小心翼翼"）
5. hesitation_ms: 悬停犹豫时间（400~2000毫秒）

输出纯合法JSON：
\`\`\`json
{
  "action": "pull_ten",
  "response_bubble": "收到！既然你发话了，十连共鸣这就启动！",
  "bubble_self": "金光一定要争气啊……",
  "click_rhythm": "急不可耐，快速点击",
  "hesitation_ms": 600
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡互动与指令决策协议，输出纯净JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      let action: any = parsed.action;
      const validActions = ['pull_ten', 'pull_once', 'pool_detail', 'rate_info', 'pull_history', 'stop', 'chat_only'];
      if (!validActions.includes(action)) {
        // Simple heuristic fallback if action was unstructured
        const lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.includes('十连') || lowerMsg.includes('10') || lowerMsg.includes('十发')) {
          action = 'pull_ten';
        } else if (lowerMsg.includes('单抽') || lowerMsg.includes('单发') || lowerMsg.includes('一次') || lowerMsg.includes('一发')) {
          action = 'pull_once';
        } else if (lowerMsg.includes('停') || lowerMsg.includes('别抽') || lowerMsg.includes('收手') || lowerMsg.includes('退出') || lowerMsg.includes('算了')) {
          action = 'stop';
        } else {
          action = 'chat_only';
        }
      }

      return {
        action,
        response_bubble: String(parsed.response_bubble || '好，听你的！'),
        bubble_self: parsed.bubble_self ? String(parsed.bubble_self) : undefined,
        click_rhythm: parsed.click_rhythm ? String(parsed.click_rhythm) : '稳健从容',
        hesitation_ms: typeof parsed.hesitation_ms === 'number' ? Math.max(300, Math.min(3000, parsed.hesitation_ms)) : 600,
      };
    }
  } catch (err) {
    console.warn('generateGachaUserResponse failed:', err);
  }

  // Fallback heuristic based on user message
  const lowerMsg = userMessage.toLowerCase();
  if (lowerMsg.includes('十连') || lowerMsg.includes('10') || lowerMsg.includes('十发')) {
    return {
      action: 'pull_ten',
      response_bubble: '收到！十连共鸣马上来！',
      click_rhythm: '急不可耐，快速点击',
      hesitation_ms: 500,
    };
  } else if (lowerMsg.includes('单抽') || lowerMsg.includes('单发') || lowerMsg.includes('一次') || lowerMsg.includes('一发') || lowerMsg.includes('试')) {
    return {
      action: 'pull_once',
      response_bubble: '好嘞，单抽一发试试手气！',
      click_rhythm: '稳健从容',
      hesitation_ms: 600,
    };
  } else if (lowerMsg.includes('停') || lowerMsg.includes('别抽') || lowerMsg.includes('收手') || lowerMsg.includes('退出') || lowerMsg.includes('算了')) {
    return {
      action: 'stop',
      response_bubble: '好，那我们今天就先收手！',
      hesitation_ms: 400,
    };
  }

  return {
    action: 'chat_only',
    response_bubble: '收到！我都听你的安排～',
    hesitation_ms: 400,
  };
}

/**
 * ⑤ 抽卡结束结算 (ENDING_CALL)
 */
export async function generateGachaEnding(
  config: LlmConfig,
  character: Character,
  stats: {
    totalPulls: number;
    userInstruction: string;
    goalAchieved: boolean;
    ssrList: string[];
    sparkUsed: boolean;
  }
): Promise<GachaEndingOutput> {
  const currentEmotion = character.emotion?.current || { anger: 0.1, fear: 0.1, joy: 0.5, sadness: 0.1, desire: 0.3, warmth: 0.6 };

  const prompt = `你是角色「${character.name}」，性格：${character.core.values.join('、')}，口吻：${character.core.speech_filter}。
抽卡模拟器本轮体验已全部结束。

【本次抽卡完整战报】：
- 累计总抽数：${stats.totalPulls} 发
- 主控最初目标："${stats.userInstruction}"
- 目标是否达成：${stats.goalAchieved ? '是（成功出货/达成）' : '未完全达成'}
- 获得SSR列表：${stats.ssrList.length > 0 ? stats.ssrList.join('、') : '无SSR'}
- 井保底是否触发：${stats.sparkUsed ? '是（吃井拿到了保底）' : '否'}

【任务要求】：
1. ending_bubble：总结这次抽卡，真诚或俏皮地对主控说一段收官台词（30-60字左右）。
2. gameTotalDelta：输出本局抽卡对你六维情绪的微小扰动（joy, warmth, desire, sadness 等，范围 -0.4 ~ +0.4，需隔离确认）。

输出纯合法JSON：
\`\`\`json
{
  "ending_bubble": "总共抽了${stats.totalPulls}发，${stats.ssrList.length > 0 ? '拿到了' + stats.ssrList.join('和') + '，手气真不错！' : '虽然有点小波折，但下次我肯定能帮你抽到！'}",
  "gameTotalDelta": { "joy": 0.3, "warmth": 0.25 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡结束结算协议，输出纯净JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        ending_bubble: String(parsed.ending_bubble || '这次抽卡就告一段落啦，感谢你的信任！'),
        gameTotalDelta: parsed.gameTotalDelta || { joy: 0.2, warmth: 0.2 },
      };
    }
  } catch (err) {
    console.warn('generateGachaEnding failed:', err);
  }

  return {
    ending_bubble: `总共抽了 ${stats.totalPulls} 发，${stats.ssrList.length > 0 ? '限定角色稳稳到手！' : '手感已经预热好了，下次必定大爆！'}`,
    gameTotalDelta: { joy: 0.2, warmth: 0.2 },
  };
}






