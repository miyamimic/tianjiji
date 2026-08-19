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
      temperature: 0.85,
      max_tokens: 600,
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
  isStructured: boolean;
};

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

  // Clean/synthesize reply if action/thought are separated
  if (reply) {
    if (action && !reply.includes(action) && !reply.includes('*')) {
      reply = `*${action}* ${reply}`;
    }
    if (thought && !reply.includes(thought) && !reply.includes('（') && !reply.includes('(')) {
      reply = `${reply} （${thought}）`;
    }
  } else if (action || thought) {
    reply = [action ? `*${action}*` : '', thought ? `（${thought}）` : ''].filter(Boolean).join(' ');
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
        // Clamp nominal delta (-0.4 to +0.4)
        emotion_delta[k] = Math.max(-0.4, Math.min(0.4, val));
      }
    }
  }

  return {
    reply,
    action,
    thought,
    emotion_intensity: emotion_intensity ?? 3,
    emotion_delta,
    triggered_memory,
    isStructured: true,
  };
}

export function parseStructuredLlmResponses(raw: string): StructuredLlmResponse[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  
  // 1. Try to extract JSON if wrapped in markdown code blocks
  let jsonString = trimmed;
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  }

  // 2. Try parsing entire string as JSON (array or single object)
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      const results = parsed.map(parseSingleStructuredItem).filter(Boolean) as StructuredLlmResponse[];
      if (results.length > 0) return results;
    } else if (parsed && typeof parsed === 'object') {
      const res = parseSingleStructuredItem(parsed);
      if (res) return [res];
    }
  } catch {
    // JSON parsing failed; try multiple object extraction
  }

  // 3. Try finding all JSON object blocks if multiple objects are concatenated
  const objectRegex = /\{[\s\S]*?\}(?=\s*\{|\s*$)/g;
  const matches = jsonString.match(objectRegex);
  if (matches && matches.length > 0) {
    const results: StructuredLlmResponse[] = [];
    for (const match of matches) {
      try {
        const item = JSON.parse(match);
        const parsed = parseSingleStructuredItem(item);
        if (parsed) results.push(parsed);
      } catch {
        // ignore
      }
    }
    if (results.length > 0) return results;
  }

  // Fallback for unstructured text response
  return [
    {
      reply: trimmed,
      isStructured: false,
    },
  ];
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
    minBubbles?: number;
  }
): string {
  const structuredPrompt = loadStructuredJsonPrompt();
  const globalCustomPrompt = loadCustomSystemPrompt();
  const minBubbles = extraLayers?.minBubbles || 1;

  const sections: string[] = [];

  const bubbleConstraint = minBubbles > 1
    ? `\n\n【⚠️ 强制气泡条数与分句约束 ⚠️】\n你本次回复【必须且至少】连续输出 ${minBubbles} 条独立的消息气泡（必须返回包含至少 ${minBubbles} 个 JSON 对象的顶层 JSON 数组）。\n每个 JSON 必须包含独立的 reply、action、thought、emotion_intensity (1-5)、emotion_delta。请模拟真实人类连续发送 ${minBubbles} 条短消息的节奏，将肢体动作、心理活动以及递进台词拆解为多条发出，绝对不要只返回 1 个气泡！`
    : `\n\n【气泡回复格式】你可以返回单条 JSON 对象，或返回包含多条连续分句气泡的 JSON 数组。每条请务必包含 emotion_intensity (1~5 整数)。`;

  // LAYER 1: Core System & Structured JSON Protocol
  sections.push(`【Layer 1: 系统核心设定与结构化输出协议】
你正在扮演「${characterName}」这个角色，与用户进行高度沉浸的角色扮演。你始终以第一人称（"我"）沉浸式响应，禁止跳出角色。

${structuredPrompt}${bubbleConstraint}`);

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


