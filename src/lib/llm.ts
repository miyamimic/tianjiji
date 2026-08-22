export type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const STORAGE_KEY = '__rp_engine_llm_config';

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl: parsed.baseUrl || '',
        apiKey: parsed.apiKey || '',
        model: parsed.model || 'gpt-4o-mini',
      };
    }
  } catch {
    // ignore
  }
  return { baseUrl: '', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveLlmConfig(config: LlmConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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

export async function callLlm(
  config: LlmConfig,
  messages: LlmMessage[],
): Promise<string> {
  const url = config.baseUrl.replace(/\/$/, '') + '/chat/completions';
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
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('LLM API returned unexpected response shape');
  }
  return content;
}

import type { Character, EmotionVector } from '../data/types';
import { loadStructuredJsonPrompt, loadCustomSystemPrompt } from './customStore';

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

  // If reply is empty but text or content exists
  if (!reply && typeof parsed.content === 'string') reply = parsed.content;
  if (!reply && typeof parsed.text === 'string') reply = parsed.text;

  // Synthesize reply if only action or dialogue exists, but NEVER inject thought into reply!
  if (!reply && (action || typeof parsed.dialogue === 'string')) {
    const dialogue = typeof parsed.dialogue === 'string' ? parsed.dialogue : '';
    reply = [action ? `（${action}）` : '', dialogue].filter(Boolean).join(' ');
  }

  if (!reply) return null;

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
 * Call LLM with Defensive Persona Guardrail & Auto-Regeneration:
 * If the generated text contains forbidden phrases (e.g. "对不起嘛", "求求你"),
 * it automatically triggers an immediate regeneration pass with targeted reprimand instructions.
 */
export async function callLlmWithGuardrail(
  config: LlmConfig,
  messages: LlmMessage[],
  character: Character,
): Promise<string> {
  const initialRaw = await callLlm(config, messages);
  const initialList = parseStructuredLlmResponses(initialRaw);
  const fullInitialText = initialList.map((item) => item.reply).join(' ');

  const check = checkPersonaViolations(character, fullInitialText);
  if (!check.violated) {
    return initialRaw;
  }

  console.warn(
    `[防御性人设拦截] 检测到禁忌词 "${check.forbiddenPhrase}"，触发自动纠偏重生成...`,
  );

  // Construct immediate correction reprimand prompt
  const reprimandMessage: LlmMessage = {
    role: 'user',
    content: `[系统校验拦截与人设纠偏指令]
你刚刚生成的回复中检测到了该角色的绝对禁忌词语「${check.forbiddenPhrase}」，这严重违反了「${character.name}」的核心人设（${character.core.speech_filter} 语言风格，${character.core.instinct_base} 直觉本能，严禁任何道歉、讨好、求饶或软弱言行）。
请立即重新生成本次回复！保持 ${character.name} 的独特腔调与人设魅力，绝不可包含任何道歉或讨好词汇！`,
  };

  try {
    const correctedRaw = await callLlm(config, [
      ...messages,
      { role: 'assistant', content: initialRaw },
      reprimandMessage,
    ]);

    const correctedList = parseStructuredLlmResponses(correctedRaw);
    const fullCorrectedText = correctedList.map((item) => item.reply).join(' ');
    const secondCheck = checkPersonaViolations(character, fullCorrectedText);

    if (!secondCheck.violated) {
      return correctedRaw;
    }

    // If still violated, apply deterministic text sanitization
    return sanitizePersonaViolations(character, correctedRaw);
  } catch (err) {
    console.warn('Auto-regeneration failed, applying sanitization fallback:', err);
    return sanitizePersonaViolations(character, initialRaw);
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

  const sections: string[] = [];

  // LAYER 1: Core System & Structured JSON Protocol
  sections.push(`【Layer 1: 系统核心设定与结构化输出协议】
你正在扮演「${characterName}」这个角色，与用户进行高度沉浸的角色扮演。你始终以第一人称（"我"）沉浸式响应，禁止跳出角色。

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

// -------------------------------------------------------------
// 风铃·五子棋系统矫正补充协议 - LLM 决策层函数
// -------------------------------------------------------------

import type { CandidateMove, StrategyCandidateGroup, GomokuStrategy, Cell } from './gomokuProtocolEngine';
import { sanitizeLlmDecision } from './gomokuProtocolEngine';

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
  GhostCardKeyMoment
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
 * 2. 用户抽牌后 - 角色的微反应、内心独白与台词
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
2. inner_thought 为内心真实心声（如：*暗笑：居然真被ta把鬼牌抽走了，太好笑了* 或 *可恶，居然抽走安全牌还凑成对了*）。
3. 语气禁止千篇一律，体现真情实感。
4. step_emotion_delta 仅记录本步细微情绪变化（-0.15 ~ +0.15）。

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
 * 3. 角色抽牌前 - 为主控动态生成两个心理博弈对话选项（Option A 干扰 / Option B 提示）
 */
export async function generateGhostCardUserOptions(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    userCardCount: number;
    charCardCount: number;
    userHasGhost: boolean;
    turnCount: number;
    userBluffHistory: UserBluffHistoryItem[];
  }
): Promise<{ option_a: string; option_b: string }> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const recentBluffContext = context.userBluffHistory.slice(-3).map(
    (b) => `第${b.turn}轮主控说: "${b.userSaid}" -> 你${b.charBelieved ? '相信了' : '怀疑并反着选'}`
  ).join('\n');

  const prompt = `【风铃·捉鬼牌·心理博弈选项生成】
现在轮到「${character.name}」从主控（玩家）的手牌中抽取 1 张牌。
在角色伸手抽牌前，主控可以对你说一句话来进行心理博弈（骗你抽鬼牌，或真诚/反向提示你避开鬼牌）。

【当前局势】：
- 主控剩余手牌数：${context.userCardCount} 张
- 你的剩余手牌数：${context.charCardCount} 张
- 主控手中${context.userHasGhost ? '【实际持有鬼牌🐾】' : '【实际没有鬼牌】'}
- 历史博弈记录：
${recentBluffContext || '（开局第一轮博弈）'}
- 角色特质：${character.core.values.join('、')}，当前情绪：${emotionSummary}

【任务要求】：
请根据当前角色性格、两人互动氛围与牌局紧张度，生成 2 个**风格截然不同、措辞自然生动**的主控话术选项供主控选择：
- \`option_a\` (心理干扰/虚张声势/诱导)：试图误导、挑衅或暗示角色抽某张（如故意诱导去抽鬼牌或虚张声势）
- \`option_b\` (真诚提醒/反向暗示/淡然态度)：显得真诚、提醒避开或者反向心理战

【严格约束】：
1. 两个选项必须语义和心理导向明显不同，禁止同义复述！
2. 选项文字必须短小精炼、口语化，适合玩家一键点击发出（10-25字）。
3. 严禁使用“帮我选”、“随便吧”等元选项。
4. 每局根据局势动态变化，不要重复。

输出标准 JSON：
\`\`\`json
{
  "option_a": "“左边那张我刚才摸了很久，感觉特别合你的眼缘哦～”",
  "option_b": "“……劝你别选中间那张，真的，没骗你。”"
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是剧本博弈设计器，请输出纯净 JSON。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.option_a && parsed.option_b && parsed.option_a !== parsed.option_b) {
        return {
          option_a: String(parsed.option_a),
          option_b: String(parsed.option_b),
        };
      }
    }
  } catch (err) {
    console.warn('Ghost Card user options generation LLM failed:', err);
  }

  // Fallback dynamic options
  const fallbackOptions = [
    {
      option_a: '“左边那张手感特别顺，你肯定想抽那张吧～”',
      option_b: '“……你确定要信我？那张我劝你最好避开。”',
    },
    {
      option_a: '“随便抽哪张都一样，反正你逃不出我的手掌心～”',
      option_b: '“右边那张是我的幸运牌，别怪我没提前提醒你哦。”',
    },
    {
      option_a: '“看你犹豫的样子，不敢抽最中间那张对不对？”',
      option_b: '“别看我的眼神，专心选你的牌，我不骗你。”',
    },
  ];
  return fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
}

/**
 * 4. 角色抽牌决策与即时反应 (Anti-Hallucination: 角色不知道主控具体牌面，仅知手牌数量)
 */
export async function generateGhostCardCharDrawDecision(
  config: LlmConfig,
  character: Character,
  emotion: EmotionVector,
  context: {
    userChoiceText: string;
    userCardCount: number; // 0 to userCardCount - 1
    userBluffHistory: UserBluffHistoryItem[];
    charHasGhost: boolean;
    charCardCount: number;
    turnCount: number;
  }
): Promise<{
  believed: boolean;
  selectedIndex: number;
  reactionDialogue: string;
  innerThought: string;
  stepEmotionDelta: Partial<EmotionVector>;
}> {
  const emotionSummary = Object.entries(emotion)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const validIndices = Array.from({ length: context.userCardCount }, (_, i) => i);
  const recentBluffContext = context.userBluffHistory.slice(-3).map(
    (b) => `主控曾说: "${b.userSaid}" -> 角色${b.charBelieved ? '信了' : '没信'}`
  ).join('\n');

  const prompt = `【风铃·捉鬼牌】轮到你（「${character.name}」）从主控的手牌中抽牌！
主控此时看着你的眼睛，对你说了这句话：
“${context.userChoiceText}”

【当前博弈信息】：
- 主控当前手牌数：${context.userCardCount} 张（牌索引编号为: ${validIndices.join(', ')}）
- 你当前手牌数：${context.charCardCount} 张
- 历史交互：
${recentBluffContext || '（初次交锋）'}
- 你的性格：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【决策任务】：
1. 分析主控这句话是真话还是在唬你（\`believed\`：true 代表相信ta的暗示，false 代表怀疑并故意反选）。
2. 从合法索引 [${validIndices.join(', ')}] 中选取一个你要抽取的牌编号 \`selected_index\`。
3. 生成你伸手抽牌时的即时台词与肢体动作（\`reaction_dialogue\`），以及真实的脑内心理活动（\`inner_thought\`）。
4. 记录本步的情绪微变化 \`step_emotion_delta\`。

输出标准 JSON：
\`\`\`json
{
  "believed": false,
  "selected_index": 0,
  "reaction_dialogue": "“想骗我？你刚才眼神飘了一下，我才不上当呢，我就要选这一张！” *指尖精准抽出一张牌*",
  "inner_thought": "*哼，前面就吃过你的亏，这次我反着选肯定没错……*",
  "step_emotion_delta": { "joy": 0.05, "warmth": 0.05 }
}
\`\`\``;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，请输出纯净 JSON 格式决策。` },
      { role: 'user', content: prompt }
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      let chosenIndex = Number(parsed.selected_index);
      if (isNaN(chosenIndex) || chosenIndex < 0 || chosenIndex >= context.userCardCount) {
        chosenIndex = Math.floor(Math.random() * context.userCardCount);
      }
      return {
        believed: Boolean(parsed.believed !== false),
        selectedIndex: chosenIndex,
        reactionDialogue: String(parsed.reaction_dialogue || '“那我就选这张了，可别怪我哦。” *指尖抽出一张牌*'),
        innerThought: String(parsed.inner_thought || '*心里嘀咕着到底能不能信你……*'),
        stepEmotionDelta: parsed.step_emotion_delta && typeof parsed.step_emotion_delta === 'object' ? parsed.step_emotion_delta : {},
      };
    }
  } catch (err) {
    console.warn('Ghost Card char draw decision LLM failed:', err);
  }

  const safeFallbackIndex = Math.floor(Math.random() * Math.max(1, context.userCardCount));
  return {
    believed: true,
    selectedIndex: safeFallbackIndex,
    reactionDialogue: `*指尖在你展开的手牌上方轻拂而过，最终抽出一张* “信你一次，就这张了！”`,
    innerThought: `*希望不要抓到鬼牌……*`,
    stepEmotionDelta: { warmth: 0.05 },
  };
}

/**
 * 5. 捉鬼牌对局终局评价、撒娇索要奖励/耍赖与情绪总结算
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




