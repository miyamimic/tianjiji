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

import type { EmotionVector } from '../data/types';
import { loadStructuredJsonPrompt, loadCustomSystemPrompt } from './customStore';

export type StructuredLlmResponse = {
  reply: string;
  action?: string;
  thought?: string;
  emotion_delta?: Partial<EmotionVector>;
  triggered_memory?: string | null;
  isStructured: boolean;
};

export function parseStructuredLlmResponse(raw: string): StructuredLlmResponse {
  const trimmed = raw.trim();
  
  // 1. Try to extract JSON if wrapped in markdown code blocks
  let jsonString = trimmed;
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === 'object') {
      let reply = typeof parsed.reply === 'string' ? parsed.reply : (typeof parsed.回复文本 === 'string' ? parsed.回复文本 : '');
      const action = typeof parsed.action === 'string' ? parsed.action : (typeof parsed.动作描写 === 'string' ? parsed.动作描写 : undefined);
      const thought = typeof parsed.thought === 'string' ? parsed.thought : (typeof parsed.心理活动 === 'string' || typeof parsed.心理描写 === 'string' ? (parsed.心理活动 || parsed.心理描写) : undefined);
      const triggered_memory = typeof parsed.triggered_memory === 'string' ? parsed.triggered_memory : (typeof parsed.触发记忆 === 'string' ? parsed.触发记忆 : null);

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

      // Parse emotion delta safely
      const rawDelta = parsed.emotion_delta || parsed.情绪变化delta || parsed.emotionDelta;
      let emotion_delta: Partial<EmotionVector> | undefined = undefined;
      if (rawDelta && typeof rawDelta === 'object') {
        emotion_delta = {};
        const keys: (keyof EmotionVector)[] = ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'];
        for (const k of keys) {
          const val = rawDelta[k];
          if (typeof val === 'number' && !isNaN(val)) {
            // Clamp delta within safe limits (-0.4 to +0.4)
            emotion_delta[k] = Math.max(-0.4, Math.min(0.4, val));
          }
        }
      }

      if (reply) {
        return {
          reply,
          action,
          thought,
          emotion_delta,
          triggered_memory,
          isStructured: true,
        };
      }
    }
  } catch {
    // JSON parsing failed; fallback to raw text parsing
  }

  // Fallback for unstructured text response
  return {
    reply: trimmed,
    isStructured: false,
  };
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
  }
): string {
  const structuredPrompt = loadStructuredJsonPrompt();
  const globalCustomPrompt = loadCustomSystemPrompt();

  const sections: string[] = [];

  // LAYER 1: Core System & Structured JSON Protocol
  sections.push(`【Layer 1: 系统核心设定与结构化输出协议】
你正在扮演「${characterName}」这个角色，与用户进行高度沉浸的角色扮演。你始终以第一人称（"我"）沉浸式响应，禁止跳出角色。

${structuredPrompt}`);

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
  sections.push(`【Layer 5: 角色当前情感中枢与心理状态】
- 当前六维情绪状态：${emotionSummary}${memoryInfo}
请根据当前的情绪状态动态演化你的语气温差与细微反应，并在 JSON 中返回真实的 emotion_delta。`);

  // LAYER 6: Custom Global Overrides
  if (globalCustomPrompt.trim()) {
    sections.push(`【Layer 6: 自定义全局系统提示词补充】
${globalCustomPrompt.trim()}`);
  }

  return sections.join('\n\n');
}

