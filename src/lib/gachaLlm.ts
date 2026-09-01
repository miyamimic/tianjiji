import { callLlm, type LlmConfig } from './llm';
import type {
  GachaPoolConfig,
  LlmCall1EnterOutput,
  LlmCall2DecisionOutput,
  LlmCall3ResultOutput,
  LlmCall4UserMsgOutput,
  LlmCall5EndingOutput,
  PulledCardInstance,
  ClickTarget,
} from './gachaTypes';
import {
  validateAndSanitizeClickTarget,
  getDefaultClickHabitProfile
} from './gachaEngine';
import type { Character } from '../data/types';

// ============================================================================
// 风铃 · AI 抽卡模拟器 (v4) LLM 决策层
// 严格遵守：JS 不预设任何流程与评价，所有决策与评价现场实时原创生成
// ============================================================================

// -------------------------------------------------------------
// 调用 ① 进入界面 (ENTER INTERFACE)
// -------------------------------------------------------------
export async function callGachaLlm1_Enter(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  userInstruction?: string
): Promise<LlmCall1EnterOutput> {
  const currentEmotion = character.emotion?.current || { warmth: 0.6, joy: 0.5 };

  const prompt = `【风铃·AI抽卡模拟器·调用① 进入界面】
你是角色「${character.name}」。你与主控（玩家）正一同打开抽卡祈愿界面。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 当前六维情绪：温情${((currentEmotion.warmth || 0.5) * 100).toFixed(0)}%、喜悦${((currentEmotion.joy || 0.5) * 100).toFixed(0)}%
- 【当前卡池名称】：${poolConfig.pool_name}
- 【当前卡池保底要求（井计数）】：${poolConfig.spark_count} 抽可兑换「${poolConfig.spark_reward.description}」
- 【主控初始指令/目标】：${userInstruction ? `“${userInstruction}”` : '暂无明确目标，由你自主决定'}
- 【当前卡池界面可用按钮】：
${poolConfig.buttons.map((b) => `  - ID: "${b.id}" (${b.label})`).join('\n')}

【任务】：
请决定你的初始动作（移动光标或立即点击）与开场对话气泡。
请直接输出纯合法 JSON，严禁 markdown 代码块外任何文字：
{
  "first_action": "move_to" 或 "click",
  "click_target": { "type": "button", "button_id": "${poolConfig.buttons[0]?.id || 'btn_pull_1'}" } 或 { "type": "blank", "position": { "x": 0.5, "y": 0.5 } },
  "opening_bubble": "（自言自语开场白或轻叹）",
  "bubble_to_user": "（对玩家说的开场话，询问玩家今天打算抽多少或表达对卡池的期待）"
}`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡模拟器接口协议①，只输出合法JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const validTarget = validateAndSanitizeClickTarget(parsed.click_target, poolConfig);
      return {
        first_action: parsed.first_action === 'click' ? 'click' : 'move_to',
        click_target: validTarget,
        opening_bubble: String(parsed.opening_bubble || '……来到卡池前了呢。'),
        bubble_to_user: String(parsed.bubble_to_user || '看好了，今天你想抽多少发？'),
      };
    }
  } catch (err) {
    console.warn('[GachaLlm1] Enter LLM failed:', err);
  }

  // Safe fallback
  return {
    first_action: 'move_to',
    click_target: { type: 'button', button_id: poolConfig.buttons[0]?.id || 'btn_pull_1' },
    opening_bubble: '（轻轻注视着璀璨的卡池光晕）',
    bubble_to_user: `准备好了，今天由我来为你掌舵祈愿。`,
  };
}

// -------------------------------------------------------------
// 调用 ② 决策循环 (DECISION CYCLE) - 每一步都由 LLM 决定
// -------------------------------------------------------------
export interface GachaDecisionContext {
  currentScreen: 'main' | 'details' | 'history';
  cursorPos: { x: number; y: number };
  totalPulls: number;
  currentSparkCount: number;
  pulledSsrList: string[];
  userGoal: string; // 用户目标或指令（如 "抽80发", "抽到出金为止"）
  latestUserMsg?: string;
  historyActionSummary: string[];
}

export async function callGachaLlm2_Decision(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  ctx: GachaDecisionContext
): Promise<LlmCall2DecisionOutput> {
  const currentEmotion = character.emotion?.current || { warmth: 0.6, joy: 0.5 };

  const prompt = `【风铃·AI抽卡模拟器·调用② 决策循环】
你是角色「${character.name}」。你拥有当前抽卡界面的完全掌控权，光标即代表你的手指。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 当前六维情绪：温情${((currentEmotion.warmth || 0.5) * 100).toFixed(0)}%、喜悦${((currentEmotion.joy || 0.5) * 100).toFixed(0)}%
- 【当前界面】：${ctx.currentScreen === 'main' ? '卡池主界面' : ctx.currentScreen === 'details' ? '卡池详情弹窗' : '历史记录弹窗'}
- 【光标当前坐标】：x=${ctx.cursorPos.x.toFixed(2)}, y=${ctx.cursorPos.y.toFixed(2)}
- 【已累计总抽数】：${ctx.totalPulls} 抽
- 【当前井计数进度】：${ctx.currentSparkCount} / ${poolConfig.spark_count} 抽
- 【已抽到的 SSR 列表】：${ctx.pulledSsrList.length > 0 ? ctx.pulledSsrList.join('、') : '暂无'}
- 【主控（玩家）的目标与期望】：${ctx.userGoal || '无特定限制，由你自主把控'}
- 【玩家刚刚发来的消息】：${ctx.latestUserMsg ? `“${ctx.latestUserMsg}”` : '无新消息'}
- 【前几次操作足迹】：${ctx.historyActionSummary.slice(-4).join(' → ') || '刚开始'}
- 【当前可点击的按钮】：
${poolConfig.buttons.map((b) => `  - ID: "${b.id}" (${b.label})`).join('\n')}

【防幻觉与规则】：
1. 此时你不知道下一次抽卡的结果。
2. 你需要决定当前下一步行为：move_to（仅移动光标）、click（移动并点击按钮或空白处）、idle（原地稍作等待）、stop（停止抽卡收工）。
3. 自由描述 click_rhythm（如“极快”、“迫不及待”、“从容慢点”、“稍作犹豫”等）。
4. hesitation_ms 为移动或停顿毫秒数（300 ~ 2500）。

【输出格式（纯合法JSON）】：
{
  "action": "move_to | click | idle | stop",
  "click_target": { "type": "button", "button_id": "${poolConfig.buttons[1]?.id || poolConfig.buttons[0]?.id}" } 或 { "type": "blank", "position": { "x": 0.5, "y": 0.5 } },
  "click_rhythm": "从容",
  "bubble_to_user": "（对玩家说的简短一句话，可交流进展或询问要不要继续）",
  "bubble_self": "（内心自言自语或碎碎念）",
  "hesitation_ms": 1000
}`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡模拟器接口协议②，只输出合法JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const validTarget = validateAndSanitizeClickTarget(parsed.click_target, poolConfig);
      const action = ['move_to', 'click', 'idle', 'stop'].includes(parsed.action)
        ? (parsed.action as any)
        : 'click';
      return {
        action,
        click_target: validTarget,
        click_rhythm: String(parsed.click_rhythm || '正常'),
        bubble_to_user: String(parsed.bubble_to_user || ''),
        bubble_self: String(parsed.bubble_self || ''),
        hesitation_ms: typeof parsed.hesitation_ms === 'number' ? Math.max(200, Math.min(4000, parsed.hesitation_ms)) : 1000,
      };
    }
  } catch (err) {
    console.warn('[GachaLlm2] Decision LLM failed:', err);
  }

  // Fallback decision: default click ten-pull or single-pull
  const defaultBtn = poolConfig.buttons.find((b) => b.type === 'pull_ten') || poolConfig.buttons[0];
  return {
    action: 'click',
    click_target: { type: 'button', button_id: defaultBtn?.id || 'btn_pull_1' },
    click_rhythm: '从容',
    bubble_to_user: '这一发，借你的欧气一用。',
    bubble_self: '（集中精神……）',
    hesitation_ms: 1000,
  };
}

// -------------------------------------------------------------
// 调用 ③ 抽卡结果生成翻卡习惯与现场独立评价 (RESULT & FLIP HABIT)
// -------------------------------------------------------------
export async function callGachaLlm3_ResultEval(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  pulledCards: PulledCardInstance[],
  totalPulls: number,
  currentSparkCount: number,
  isSparkTriggered: boolean
): Promise<LlmCall3ResultOutput> {
  const currentEmotion = character.emotion?.current || { warmth: 0.6, joy: 0.5 };

  const prompt = `【风铃·AI抽卡模拟器·调用③ 翻卡习惯与单卡原创评价】
你是角色「${character.name}」。当前一轮抽卡动画正在流转，光芒即将汇聚。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 当前六维情绪：温情${((currentEmotion.warmth || 0.5) * 100).toFixed(0)}%、喜悦${((currentEmotion.joy || 0.5) * 100).toFixed(0)}%
- 【累计总抽数】：${totalPulls} 抽
- 【当前井计数】：${currentSparkCount} / ${poolConfig.spark_count}${isSparkTriggered ? '（本发已触发井保底兑换！）' : ''}

【本次真实抽出的所有卡牌列表（共 ${pulledCards.length} 张）】：
${pulledCards
  .map(
    (c, idx) =>
      `  [第${idx + 1}张] 稀有度: ${c.card.rarity} | 名称: 「${c.card.name}」 | 描述: ${c.card.description}${
        c.isSparkReward ? '【井保底大奖】' : ''
      }`
  )
  .join('\n')}

【硬性要求】：
1. 设定你的翻卡习惯 click_habit_profile：
   - skip_click_position: 点击跳过动画的坐标 (x: 0~1, y: 0~1)
   - click_rhythm: 翻卡点击节奏（如“急迫连续翻”、“屏息一张张看”、“漫不经心”等）
   - random_tap: 是否在屏幕上乱点
   - wait_for_user_reply: 是否每翻一张都等待玩家说话
   - tap_while_talking: 是否边说评价边翻下一张
   - evaluation_timing: "on_flip"（每翻一张立刻说那张的评价）或 "after_all"（全部翻完后再说）
2. evaluations 数组：
   - 必须包含全部 ${pulledCards.length} 张卡牌的评价！
   - 每张卡的评价必须根据卡名、稀有度、卡面描述现场原创，严禁套用固定模板，严禁雷同！
   - SSR卡请表现出真诚的惊喜/兴奋/傲娇/欣慰，SR卡根据实用度点评，R卡可幽默或吐糟。
3. summary_bubble：翻完这波后的总结自白。

【输出纯合法JSON】：
{
  "click_habit_profile": {
    "skip_click_position": { "x": 0.88, "y": 0.08 },
    "click_rhythm": "快中有序",
    "random_tap": false,
    "wait_for_user_reply": false,
    "tap_while_talking": true,
    "evaluation_timing": "on_flip"
  },
  "evaluations": [
${pulledCards.map((c, i) => `    { "card_index": ${i}, "text": "（对第${i + 1}张「${c.card.name}」的独创评价台词）" }`).join(',\n')}
  ],
  "summary_bubble": "（这波抽卡结束后的总结台词）"
}`;

  try {
    const raw = await callLlm(
      config,
      [
        { role: 'system', content: `你是「${character.name}」，严格遵守抽卡评价与翻卡习惯协议③，只输出合法JSON。` },
        { role: 'user', content: prompt },
      ],
      { timeoutMs: 25000 }
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const habit = parsed.click_habit_profile || {};
      const skipPos = habit.skip_click_position || { x: 0.88, y: 0.08 };

      const sanitizedProfile = {
        skip_click_position: {
          x: typeof skipPos.x === 'number' ? Math.max(0, Math.min(1, skipPos.x)) : 0.88,
          y: typeof skipPos.y === 'number' ? Math.max(0, Math.min(1, skipPos.y)) : 0.08,
        },
        click_rhythm: String(habit.click_rhythm || '正常'),
        random_tap: Boolean(habit.random_tap),
        wait_for_user_reply: Boolean(habit.wait_for_user_reply),
        tap_while_talking: habit.tap_while_talking !== false,
        evaluation_timing: (habit.evaluation_timing === 'after_all' ? 'after_all' : 'on_flip') as any,
      };

      const rawEvals = Array.isArray(parsed.evaluations) ? parsed.evaluations : [];
      const evaluations = pulledCards.map((c, idx) => {
        const found = rawEvals.find((e: any) => e.card_index === idx);
        if (found && typeof found.text === 'string' && found.text.trim()) {
          return { card_index: idx, text: found.text.trim() };
        }
        return {
          card_index: idx,
          text: c.card.rarity === 'SSR' ? `金光！是「${c.card.name}」！` : `「${c.card.name}」，先收下。`,
        };
      });

      return {
        click_habit_profile: sanitizedProfile,
        evaluations,
        summary_bubble: String(parsed.summary_bubble || '呼……这波的成果都在这了。'),
      };
    }
  } catch (err) {
    console.warn('[GachaLlm3] Result evaluation LLM failed:', err);
  }

  // Fallback evaluations
  const defaultHabit = getDefaultClickHabitProfile();
  const defaultEvals = pulledCards.map((c, idx) => ({
    card_index: idx,
    text: c.card.rarity === 'SSR'
      ? `✨ 金光闪耀！居然真的出了「${c.card.name}」！`
      : c.card.rarity === 'SR'
      ? `紫光收拢，是「${c.card.name}」，还算不错。`
      : `「${c.card.name}」，当做素材也不亏。`,
  }));

  return {
    click_habit_profile: defaultHabit,
    evaluations: defaultEvals,
    summary_bubble: '这轮祈愿揭晓完毕，看看接下来还要继续吗？',
  };
}

// -------------------------------------------------------------
// 调用 ④ 用户消息处理 (USER MESSAGE & REAL-TIME INTERACTION)
// -------------------------------------------------------------
export async function callGachaLlm4_UserMessage(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  userMessage: string,
  currentProgressSummary: string
): Promise<LlmCall4UserMsgOutput> {
  const currentEmotion = character.emotion?.current || { warmth: 0.6, joy: 0.5 };

  const prompt = `【风铃·AI抽卡模拟器·调用④ 用户实时插话与指令响应】
你是角色「${character.name}」。抽卡期间，主控（玩家）对你说了一句话。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 【当前抽卡进度】：${currentProgressSummary}
- 【主控说的话】：${userMessage}

【任务】：
1. 根据你的性格和主控的话，给出即时的回复气泡 response_bubble。
2. 决定你的动作意图 action：
   - "continue": 继续按节奏抽卡或执行
   - "stop": 听从玩家建议/或见好就收，准备结束抽卡
   - "change_target": 调整抽卡策略或目标（如转战单抽/十连）
   - "go_to": 切换去查看详情或历史

【输出纯合法JSON】：
{
  "response_bubble": "（你的生动回复台词）",
  "action": "continue | stop | change_target | go_to",
  "new_target": "（若调整目标，填入简述，如'再来十连'或'停止'）"
}`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡交互协议④，只输出合法JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        response_bubble: String(parsed.response_bubble || '收到你的想法了。'),
        action: ['continue', 'stop', 'change_target', 'go_to'].includes(parsed.action)
          ? parsed.action
          : 'continue',
        new_target: parsed.new_target ? String(parsed.new_target) : undefined,
      };
    }
  } catch (err) {
    console.warn('[GachaLlm4] User msg LLM failed:', err);
  }

  return {
    response_bubble: `好，听你的。`,
    action: 'continue',
  };
}

// -------------------------------------------------------------
// 调用 ⑤ 抽卡结束结算 (ENDING & EMOTION SETTLEMENT)
// -------------------------------------------------------------
export async function callGachaLlm5_Ending(
  config: LlmConfig,
  character: Character,
  poolConfig: GachaPoolConfig,
  totalPulls: number,
  userGoal: string,
  ssrsPulled: string[],
  isSparkTriggered: boolean
): Promise<LlmCall5EndingOutput> {
  const currentEmotion = character.emotion?.current || { warmth: 0.6, joy: 0.5 };

  const prompt = `【风铃·AI抽卡模拟器·调用⑤ 抽卡结束与情绪结算】
你是角色「${character.name}」。本次抽卡模拟告一段落。
- 你的核心人设：${character.core.values.join('、')}，语言风格：${character.core.speech_filter}
- 【本次总共抽了】：${totalPulls} 抽
- 【主控最初的目标】：${userGoal || '随意抽抽'}
- 【收获的 SSR 列表】：${ssrsPulled.length > 0 ? ssrsPulled.join('、') : '无（非酋体验）'}
- 【是否达成井保底】：${isSparkTriggered ? '是（成功兑换保底奖励！）' : '否'}

【任务】：
1. 给出结束结语 ending_bubble（符合人设，针对抽卡战果给予感慨、安慰、同庆或调侃）。
2. 计算本次抽卡给你带来的情绪波动 gameTotalDelta（数值在 0 ~ 1 之间，抽到多张SSR会非常兴奋/喜悦，欧气爆棚喜悦+兴奋，沉船可能失望+温情安慰）。

【输出纯合法JSON】：
{
  "ending_bubble": "（收官总结台词）",
  "gameTotalDelta": {
    "joy": 0.4,
    "excitement": 0.5,
    "disappointment": 0.1
  }
}`;

  try {
    const raw = await callLlm(config, [
      { role: 'system', content: `你是「${character.name}」，严格遵守抽卡结束协议⑤，只输出合法JSON。` },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const delta = parsed.gameTotalDelta || {};
      return {
        ending_bubble: String(parsed.ending_bubble || '本次祈愿就到这里吧，收获颇丰呢。'),
        gameTotalDelta: {
          joy: typeof delta.joy === 'number' ? Math.max(0, Math.min(1, delta.joy)) : 0.3,
          excitement: typeof delta.excitement === 'number' ? Math.max(0, Math.min(1, delta.excitement)) : 0.3,
          disappointment: typeof delta.disappointment === 'number' ? Math.max(0, Math.min(1, delta.disappointment)) : 0.1,
        },
      };
    }
  } catch (err) {
    console.warn('[GachaLlm5] Ending LLM failed:', err);
  }

  return {
    ending_bubble: `今天共抽了 ${totalPulls} 发，成果已经记录在案啦。`,
    gameTotalDelta: {
      joy: ssrsPulled.length > 0 ? 0.6 : 0.2,
      excitement: ssrsPulled.length > 0 ? 0.7 : 0.1,
      disappointment: ssrsPulled.length === 0 ? 0.4 : 0.05,
    },
  };
}
