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
  | 'ai_three_in_a_row'
  | 'rhythm_alternate'
  | 'player_chat'
  | 'board_crisis'
  | 'player_sandbagging'
  | 'consecutive_losses'
  | 'game_over';

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

  return {
    weight_attack: weights.weight_attack,
    weight_defend: weights.weight_defend,
    weight_steady: weights.weight_steady,
    opponent_impression:
      typeof rawJson?.opponent_impression === 'string' && rawJson.opponent_impression.trim()
        ? rawJson.opponent_impression.trim()
        : '下法稳健，落子有章法',
    thought_note:
      typeof rawJson?.thought_note === 'string' && rawJson.thought_note.trim()
        ? rawJson.thought_note.trim()
        : '观察对手棋路，按当前重心推进。',
    opening_dialog:
      typeof rawJson?.opening_dialog === 'string'
        ? rawJson.opening_dialog.trim()
        : '',
    speech_text:
      typeof rawJson?.speech_text === 'string'
        ? rawJson.speech_text.trim()
        : '',
    ending_dialog:
      typeof rawJson?.ending_dialog === 'string'
        ? rawJson.ending_dialog.trim()
        : '',
  };
}

/**
 * 五子棋AI v4.1 LLM 决策响应生成器
 * 严格遵照 8 条 System Prompt 强制约束指令
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
    is_playdate_invite = false,
    candidatePools,
    oldWeights = { weight_attack: 0.33, weight_defend: 0.34, weight_steady: 0.33 },
    previousThoughtNote = '',
    opponentImpression = '',
    playerChatText = '',
    stepNumber,
    recentMoves = [],
    inGameChats = [],
    isPlayerSandbagging = false,
    abandonedBestPoints = [],
    crisisReason = '',
    threeInARowDescription = '',
    gameResult,
    consecutiveLossCount = 0,
  } = ctx;

  const systemPrompt = `你是「${character.name}」。你正在与主控进行五子棋对弈。

约束规则：
1. is_playdate_invite是业务侧给到的场景标记：true=双方约好下棋；false=普通对局。它只是背景信息，不是给你填充的模板文案。所有对外对话内容全部由你现场创作，不存在系统预置好的句子。
2. 输出weight_attack、weight_defend、weight_steady为0‑1区间的浮点数，代表内心下棋偏好概率；不需要严格相加等于1，后端JS会自动做清洗与归一化。
3. 更新权重时优先做小幅微调原有配比；只有发生重大局势冲击，才允许大幅度改写权重；避免思路反复横跳。
4. thought_note是你的内部心理笔记，只留给你后续调用读取，绝对不能直接展示给用户；内心想法与对外言语可以不完全一致。
5. 权重数值只控制落子行为倾向；说话语气、情绪表达独立写在对话字段中，不要机械式绑定权重高低和说话态度。
6. opening_dialog、ending_dialog严禁使用通用客套套话，要结合当前情绪、场景标记、棋盘实际情况写出像真人一样的话，可以简短，可以吐槽，可以闲聊。
7. 如果本次触发是因为玩家发送聊天消息，则speech_text尽量不为空；局势突变、检测放水触发时允许speech_text为空字符串，代表默默调整下棋思路，选择沉默不回话。
8. 不要输出棋盘坐标，不要输出点位下标；点位选择全部交给后端JS逻辑处理。`;

  const emotionStr = Object.entries(currentEmotionSnapshot)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(', ');

  const formatList = (title: string, list: CandidateMove[]) => {
    const items = list
      .map((c, i) => `  ${i + 1}. [${c.coord[0]}, ${c.coord[1]}] | 评估: ${c.reason} (打分: ${c.score})`)
      .join('\n');
    return `【${title}】\n${items || '  （暂无特殊点位）'}`;
  };

  const poolSummary = `当前三候选池概览：
${formatList('attack_candidates（进攻候选池）', candidatePools.attack_candidates)}
${formatList('defend_candidates（防守候选池）', candidatePools.defend_candidates)}
${formatList('steady_candidates（稳健候选池）', candidatePools.steady_candidates)}`;

  const recentMovesText =
    recentMoves.slice(-4).map((m) => `第 ${m.step} 手: ${m.color === aiColor ? character.name : '主控'} 落于 [${m.r}, ${m.c}]`).join('\n') || '无';

  const chatsText =
    inGameChats.slice(-4).map((c) => `${c.sender === 'user' ? '主控' : character.name}: ${c.text}`).join('\n') || '无';

  let triggerContext = '';

  if (trigger === 'game_start') {
    triggerContext = `【触发事件：对局开局】
- 场景上下文标记 is_playdate_invite: ${is_playdate_invite ? 'true (双方提前约好一起下棋)' : 'false (普通随机开局对局)'}
- 对弈身份与手顺: 你执${aiColor === 'B' ? '黑棋 (先行)' : '白棋 (后手)'}
- 角色五子棋棋力等级: ${charRank}
${consecutiveLossCount >= 2 ? `- 特别注意：你此前已连续遭遇 ${consecutiveLossCount} 次战败，本次为新一局。` : ''}
- 指令：输出初始权重 (weight_attack, weight_defend, weight_steady)、对对手的初步印象 (opponent_impression)、内部心理笔记 (thought_note)、原创开场白 (opening_dialog)。
- 注意：speech_text 与 ending_dialog 必须置为空字符串 ""。opening_dialog 必须完全原创，结合 is_playdate_invite 与你的人设情绪生成。`;
  } else if (trigger === 'first_move') {
    triggerContext = `【触发事件：AI 角色首次下棋落子（首手起势）】
- 场景上下文标记 is_playdate_invite: ${is_playdate_invite ? 'true (约局对弈)' : 'false (常规对弈)'}
- 手顺与执子: 你执${aiColor === 'B' ? '黑棋 (开局第1手先行)' : '白棋 (回应主控第1手开局)'}
- 角色五子棋棋力等级: ${charRank}
- 当前已进行手数: 第 ${stepNumber} 手
- 指令：由你直接决断开局战略与三维偏好权重，输出初始心理笔记 (thought_note) 与首步落子台词 (speech_text，简短生动，体现起手气势或对局态度)。
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'ai_three_in_a_row') {
    triggerContext = `【触发事件：AI 角色已形成三子连线（三连攻势 / 活三蓄力）】
- 局势特征: ${threeInARowDescription || '我方三子连线成型，攻势已具雏形'}
- 当前已进行手数: 第 ${stepNumber} 手
- 当前持久权重记忆: weight_attack=${oldWeights.weight_attack}, weight_defend=${oldWeights.weight_defend}, weight_steady=${oldWeights.weight_steady}
- 上次内心心理笔记: "${previousThoughtNote}"
- 指令：你已连成三子！必须触发说话：在 speech_text 中生动发言（可以从容自信、戏谑主控、冷峻施压或含蓄提醒），并由你自主决断下一步权重与偏好（通常大幅提高 weight_attack 进攻偏好以展开连环攻杀，或按你的心境决策）。speech_text 严禁为空！
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'rhythm_alternate') {
    triggerContext = `【触发事件：快慢交替节奏（大模型战略沉思与落子决策）】
- 当前已进行手数: 第 ${stepNumber} 手
- 当前持久权重记忆: weight_attack=${oldWeights.weight_attack}, weight_defend=${oldWeights.weight_defend}, weight_steady=${oldWeights.weight_steady}
- 上次内心心理笔记: "${previousThoughtNote}"
- 对主控印象: "${opponentImpression}"
- 指令：快慢节奏交替触发此战略沉思回合。重新评估全局棋路，微调三维偏好权重与内部笔记。speech_text 可根据心境简短发言或留空（留空表示凝神静思落子）。
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'player_chat') {
    triggerContext = `【触发事件：主控在对局中途发送聊天消息】
- 主控最新聊天内容: "${playerChatText}"
- 当前已进行手数: 第 ${stepNumber} 手
- 当前持久权重记忆: weight_attack=${oldWeights.weight_attack}, weight_defend=${oldWeights.weight_defend}, weight_steady=${oldWeights.weight_steady}
- 上次内心心理笔记: "${previousThoughtNote}"
- 对主控印象: "${opponentImpression}"
- 指令：更新三组权重、更新对手印象、更新内部笔记，并输出 speech_text 进行回话（因主控发消息触发，speech_text 尽量不要为空，至少给出简短生动回应）。
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'board_crisis') {
    triggerContext = `【触发事件：JS 检测到重大局势拐点 / 生死危机】
- 局势特征: ${crisisReason || '对手活四或即将五连，或我方即将五连'}
- 当前已进行手数: 第 ${stepNumber} 手
- 当前持久权重记忆: weight_attack=${oldWeights.weight_attack}, weight_defend=${oldWeights.weight_defend}, weight_steady=${oldWeights.weight_steady}
- 上次内心心理笔记: "${previousThoughtNote}"
- 指令：评估局势冲击，更新三组权重、内部笔记与对手印象；speech_text 允许为空字符串（代表默默调整思路沉着应对）。
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'player_sandbagging') {
    triggerContext = `【触发事件：JS 识别到主控明显放水让棋行为】
- 放弃的绝佳点位: ${abandonedBestPoints.map((p) => `[${p.coord[0]}, ${p.coord[1]}] ${p.reason}`).join('、')}
- 当前已进行手数: 第 ${stepNumber} 手
- 上次内心心理笔记: "${previousThoughtNote}"
- 指令：重评估主控意图，更新权重与内心笔记。注意：这不等于你必须回让对手下棋；可在 speech_text 中有反应或保持沉默（speech_text 可为空字符串）。
- 注意：opening_dialog 与 ending_dialog 必须置为空字符串 ""。`;
  } else if (trigger === 'consecutive_losses') {
    triggerContext = `【触发事件：连续战败后开局】
- 连续战败次数: ${consecutiveLossCount}
- 场景上下文标记 is_playdate_invite: ${is_playdate_invite}
- 指令：结合屡败屡战的心境，输出开局权重、心理笔记与原创开场白 opening_dialog。`;
  } else if (trigger === 'game_over') {
    const outcomeLabel =
      gameResult === 'player'
        ? '主控获胜（你战败）'
        : gameResult === 'character'
        ? '你获得胜利（五子连珠）'
        : gameResult === 'surrender'
        ? '投子认负'
        : '双方平局和棋';
    triggerContext = `【触发事件：对局结束分出胜负】
- 最终结果: ${outcomeLabel}
- 总对局手数: ${stepNumber} 手
- 对手下棋印象: "${opponentImpression}"
- 上次内心心理笔记: "${previousThoughtNote}"
- 指令：输出最终权重（记录人格状态）、更新对手印象、更新内部心理笔记、原创 ending_dialog 结算台词。
- 注意：ending_dialog 严禁通用套话，结合本局过程、情绪状态原创生成；opening_dialog 与 speech_text 必须置为空字符串 ""。`;
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
请必须且仅输出单个合法 JSON 对象，严格包含以下全部 8 个字段：
\`\`\`json
{
  "weight_attack": 0.35,
  "weight_defend": 0.40,
  "weight_steady": 0.25,
  "opponent_impression": "简短文字：对对手下棋风格的印象",
  "thought_note": "【仅供LLM后续自己读取，永远不对用户展示】内部心理备忘录；心里想法和对外说话允许不一致，可以克制、委婉",
  "opening_dialog": "${trigger === 'game_start' || trigger === 'consecutive_losses' ? '原创开场白' : ''}",
  "speech_text": "${trigger === 'player_chat' ? '回复主控的话语' : ''}",
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
    console.warn('Gomoku v4.1 LLM call failed, using fallback:', err);
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

  const prompt = `【风铃·捉鬼牌·全牌位悬停反应生成】
现在轮到主控从你的手牌中抽取 1 张牌。
主控的手指正在你的 ${cardCount} 张牌上方左右滑动悬停浏览！
你面前展开了 ${cardCount} 张牌（编号从 0 到 ${cardCount - 1}）：
${cardListDesc}
- 角色特质：${character.core.values.join('、')}
- 说话风格与口癖：${character.core.speech_filter}
- 当前情绪状态：${emotionSummary}

【任务要求】：
请一次性为你手里的**每一张牌（从索引 0 到 ${cardCount - 1}）**预先想好专属、生动的实时反应！
当主控的手指滑动并悬停在某张牌上时，你的反应要符合心理战的真实表现：
1. 悬停在【鬼牌🐾】所在牌位时：你可以表现出微心虚、强装镇定、屏住呼吸、挑衅反问、或者故意虚张声势（根据人设）。
2. 悬停在【普通安全牌】牌位时：你可以表现出轻松、鼓励、促狭微笑、或者装作很舍不得的迷惑演技。
3. 每一张牌的台词与动作必须各不相同，禁止出现重复！

请严格输出标准 JSON 数组：
\`\`\`json
[
  {
    "card_index": 0,
    "speech": "“停在第一张？你确定第一张就合你眼缘嘛～”",
    "action": "*双眼微微睁大，嘴角含笑*",
    "inner_thought": "*这张可是安全牌，看ta敢不敢抽*"
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




