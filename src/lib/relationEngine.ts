/**
 * 关系状态引擎 (Relationship State Engine)
 *
 * 核心设计与控制权机制：
 * 1. 控制权归属 (Who Controls Up/Down):
 *    - 主控裁决：用户在侧边栏、角色编辑中拥有最高控制权，可随时微调滑块与阶段。
 *    - 里程碑事件驱动：触发不同事件时，系统自动计算具体的心理增减量 (Mental Delta) 与身体阶段跃迁。
 *    - 角色性格敏感度调节：不同角色的本能特质（回避、傲娇、僵直、依赖、理智）对同一里程碑的吸收与创伤惩罚倍率不同！
 * 2. LLM 仅只读访问状态文本约束，绝对不可自行篡改数值。
 * 3. 心理开放度 (0-100) 与身体亲密阶段 (0-5) 互相独立错位演化。
 */

import type { Character } from '../data/types';

export interface RelationState {
  mentalOpen: number; // 0-100: 心理开放度（愿意外露内心、脆弱、伤痛的程度）
  physicalPhase: number; // 0-5: 身体亲密阶段 (0: 普通相处 ~ 5: 经常性稳定亲密关系)
  intimacyCooldown: number; // 亲密冷却计数器（单位：对话轮次），防止AI频繁主动调情
  milestones: string[]; // 已经发生过的关键剧情里程碑标签
}

export interface PhysicalPhaseInfo {
  phase: number;
  name: string;
  shortDesc: string;
  promptText: string;
}

export interface MentalOpenTierInfo {
  min: number;
  max: number;
  name: string;
  shortDesc: string;
  promptText: string;
}

export interface MilestoneMeta {
  key: string;
  label: string;
  category: 'emotional_up' | 'conflict_down' | 'physical';
  baseMentalDelta: number; // 基准心理变动（正数代表心防软化/上升，负数代表防备收紧/下降）
  targetPhysicalPhase?: number; // 推荐或跃迁至的身体亲密阶段
  physicalDelta?: number; // 身体阶段增减
  triggerCooldown?: boolean; // 是否触发亲密冷却 (5轮)
  description: string; // 剧情与心理机制说明
}

export interface CharacterSensitivity {
  trustGainMultiplier: number; // 信任/破冰加成系数 (例如 1.35x 或 0.75x)
  hurtPenaltyMultiplier: number; // 受创/心防紧闭惩罚系数 (例如 1.6x 或 0.9x)
  temperamentTitle: string; // 性格偏向标签
  temperamentDesc: string; // 详细机制解析
}

export const PHYSICAL_PHASES: PhysicalPhaseInfo[] = [
  {
    phase: 0,
    name: '普通相处',
    shortDesc: '保持礼貌社交距离，无暧昧联想',
    promptText: '关系停留在普通相处，肢体上保持距离；共用私人物品会感到局促，不会产生暧昧联想，言行保持分寸感。',
  },
  {
    phase: 1,
    name: '暧昧贴近（拥抱、贴脸）',
    shortDesc: '愿意肢体靠近，害羞不自在，不主动过界',
    promptText: '处于暧昧阶段，愿意肢体靠近；拥抱、脸颊触碰可以接受；间接肢体接触例如共喝一瓶水，内心会害羞不自在，不会主动推进更进一步亲密行为。',
  },
  {
    phase: 2,
    name: '接吻亲密（已发生唇吻）',
    shortDesc: '肢体距离感消除，温柔暧昧，不主动推向性爱',
    promptText: '已经有接吻经历，肢体距离感消除；共用私人物品变得理所当然；可以有温柔暧昧氛围，禁止主动向性爱方向推进剧情。',
  },
  {
    phase: 3,
    name: '深度肌肤亲密',
    shortDesc: '深度肌肤接触，缱绻温柔，克制收敛调情',
    promptText: '发生过深度肌肤接触；相处氛围可以缱绻温柔；调情必须克制收敛，不主动发起性爱相关话题。',
  },
  {
    phase: 4,
    name: '单次/偶尔发生性关系',
    shortDesc: '已有性经历，温存慵懒，严禁高频纠缠性话题',
    promptText: '已经有过性爱经历；可以有温存、慵懒的适度调戏；严禁高频纠缠性话题；尊重对方意愿，不强迫亲密行为。',
  },
  {
    phase: 5,
    name: '经常性稳定亲密关系',
    shortDesc: '亲密成为生活日常，生活化温存，优先侧重陪伴',
    promptText: '双方已经进入经常性稳定亲密状态；亲密对彼此而言是日常一部分；调戏偏向生活化慵懒亲昵，减少戏剧化强烈情欲表达；优先侧重陪伴感，任何亲密行为必须建立在互相自愿基础上。',
  },
];

export const MENTAL_OPEN_TIERS: MentalOpenTierInfo[] = [
  {
    min: 0,
    max: 25,
    name: '待人友善，极少展露自我内心与伤痛',
    shortDesc: '设有深层心防，话题多停留在表层互动',
    promptText: '对主控抱有善意好感，但内心设有防线，很少主动谈及自己的创伤、纠结与脆弱，话题大多停留在表层互动。',
  },
  {
    min: 26,
    max: 50,
    name: '偶尔吐露烦恼，重大心事有所保留',
    shortDesc: '流露小烦恼，对重大心结下意识收敛回避',
    promptText: '会偶尔流露少量烦恼情绪，但涉及自己重大伤痛、心结会下意识收住，不会深度剖白自我。',
  },
  {
    min: 51,
    max: 75,
    name: '愿意分享压力与过往经历',
    shortDesc: '主动倾诉遗憾，面对最深心结仍会犹豫',
    promptText: '愿意主动倾诉压力、遗憾、部分过往经历；面对最深层的心结依旧会犹豫，不会毫无保留全盘托出。',
  },
  {
    min: 76,
    max: 100,
    name: '敢于展示脆弱与负面情绪',
    shortDesc: '卸下心理伪装，敢于真实碰撞与表露自卑',
    promptText: '卸下大部分心理伪装；可以向主控展示狼狈、自卑、负面情绪；争执时敢于表露真实感受，不会一味讨好顺从。',
  },
];

/**
 * 结构化日常互动与里程碑定义（以日常细微温存为核心，波动温和细腻）
 */
export const MILESTONE_DEFINITIONS: MilestoneMeta[] = [
  // 🌸 日常细微温存（积极细微波动 +1 ~ +3）
  {
    key: 'remember_preference',
    label: '记住对方的小喜好与习惯',
    category: 'emotional_up',
    baseMentalDelta: 2,
    description: '不经意间流露的细心记忆，带来受重视的微甜暖意。',
  },
  {
    key: 'share_daily_food',
    label: '分享日常趣事与随手投喂',
    category: 'emotional_up',
    baseMentalDelta: 1,
    description: '自然生活化的点滴分享，拉近生活距离。',
  },
  {
    key: 'tacit_understanding',
    label: '默契相视一笑/产生情绪共鸣',
    category: 'emotional_up',
    baseMentalDelta: 2,
    description: '无需多言的眼神交汇与同频共振，心防悄然松动。',
  },
  {
    key: 'gentle_care',
    label: '细致问候与疲惫时的静静陪伴',
    category: 'emotional_up',
    baseMentalDelta: 3,
    description: '在疲累失落时递上一杯温水或安静在旁，倍感安心。',
  },
  {
    key: 'heartfelt_apology',
    label: '诚恳道歉解开误会·重归于好',
    category: 'emotional_up',
    baseMentalDelta: 4,
    description: '坦诚剖白误会并温柔弥合裂痕，信任更加稳固。',
  },

  // 🥀 日常细微波折（温和收敛 -1 ~ -3）
  {
    key: 'clumsy_word',
    label: '偶尔笨拙失言/气氛微冷',
    category: 'conflict_down',
    baseMentalDelta: -1,
    description: '言语偶有不周，短暂产生些许局促或羞恼。',
  },
  {
    key: 'awkward_silence',
    label: '话题冷场/暂时的拘谨距离',
    category: 'conflict_down',
    baseMentalDelta: -1,
    description: '相处间偶尔的尴尬沉默，下意识收紧些许防备。',
  },
  {
    key: 'had_misunderstanding',
    label: '观念产生分歧与短暂冷战',
    category: 'conflict_down',
    baseMentalDelta: -3,
    description: '情绪有些受挫，需要彼此冷静与时间消化。',
  },

  // 💜 身体亲密与关键关系推进
  {
    key: 'first_hug',
    label: '拥抱贴近与肢体依偎',
    category: 'physical',
    baseMentalDelta: 3,
    targetPhysicalPhase: 1,
    description: '打破肢体陌生感，进入 Phase 1 暧昧贴近。',
  },
  {
    key: 'first_kiss',
    label: '心意相通与初次接吻',
    category: 'physical',
    baseMentalDelta: 4,
    targetPhysicalPhase: 2,
    description: '发生唇吻确立好感，进入 Phase 2。',
  },
  {
    key: 'first_touch_intimate',
    label: '深度缱绻与耳语抚触',
    category: 'physical',
    baseMentalDelta: 4,
    targetPhysicalPhase: 3,
    description: '触碰敏感区域，相处缱绻，进入 Phase 3。',
  },
  {
    key: 'stable_intimacy',
    label: '确立稳定亲密伴侣关系',
    category: 'physical',
    baseMentalDelta: 5,
    targetPhysicalPhase: 5,
    triggerCooldown: true,
    description: '亲密成为生活日常温存，进入 Phase 5，并触发 5 轮亲密冷却期。',
  },
];

export const PRESET_MILESTONES = MILESTONE_DEFINITIONS;

/**
 * 根据角色性格本能（instinct_base）计算角色的心防敏感度系数
 */
export function getCharacterSensitivity(char?: Character | null): CharacterSensitivity {
  const instinct = char?.core?.instinct_base || 'observe';

  switch (instinct) {
    case 'avoid':
      return {
        trustGainMultiplier: 0.75, // 慢热，不易敞开
        hurtPenaltyMultiplier: 1.45, // 极度害怕受创，冷落/争吵扣减剧烈
        temperamentTitle: '回避防备型',
        temperamentDesc: '心防极重且慢热（破冰 ×0.75）；受创时极易筑起高墙自我封闭（创伤 ×1.45）。',
      };
    case 'attack':
      return {
        trustGainMultiplier: 0.85, // 傲娇嘴硬，一般示好反应较钝
        hurtPenaltyMultiplier: 1.30, // 争吵时攻击性强且受挫
        temperamentTitle: '傲娇攻击型',
        temperamentDesc: '表面强硬傲娇（破冰 ×0.85）；但在痛哭安抚与生死危机时极易产生戏剧性破防。',
      };
    case 'freeze':
      return {
        trustGainMultiplier: 0.80, // 僵直隐忍，慢热
        hurtPenaltyMultiplier: 1.50, // 遭遇背叛欺瞒时直接冰封
        temperamentTitle: '隐忍僵直型',
        temperamentDesc: '情绪内敛压抑（破冰 ×0.80）；对欺骗和越界惩罚极重，极难原谅（创伤 ×1.50）。',
      };
    case 'fawn':
      return {
        trustGainMultiplier: 1.35, // 极易被温暖感动敞开
        hurtPenaltyMultiplier: 1.60, // 极度恐惧被弃被冷落
        temperamentTitle: '依赖迎合型',
        temperamentDesc: '极度渴望被爱与认可（破冰 ×1.35）；但遭受冷落或争吵时心碎程度最深（创伤 ×1.60）。',
      };
    case 'observe':
    default:
      return {
        trustGainMultiplier: 0.95,
        hurtPenaltyMultiplier: 0.95,
        temperamentTitle: '理智观察型',
        temperamentDesc: '情绪波澜不惊，理性评估信任与风险，增减幅度均衡平稳。',
      };
  }
}

/**
 * 动态计算某个里程碑在特定角色身上的实际增减幅度
 */
export function calculateMilestoneImpact(
  milestone: MilestoneMeta,
  char?: Character | null
): {
  mentalDelta: number;
  suggestedPhase?: number;
  triggerCooldown: boolean;
} {
  const sensitivity = getCharacterSensitivity(char);
  let mentalDelta = milestone.baseMentalDelta;

  if (mentalDelta > 0) {
    mentalDelta = Math.round(mentalDelta * sensitivity.trustGainMultiplier);
  } else if (mentalDelta < 0) {
    mentalDelta = Math.round(mentalDelta * sensitivity.hurtPenaltyMultiplier);
  }

  return {
    mentalDelta,
    suggestedPhase: milestone.targetPhysicalPhase,
    triggerCooldown: !!milestone.triggerCooldown,
  };
}

const RELATION_STATE_PREFIX = '__rp_engine_relation_state_';

export const DEFAULT_RELATION_STATE: RelationState = {
  mentalOpen: 15,
  physicalPhase: 0,
  intimacyCooldown: 0,
  milestones: [],
};

export function getPhysicalPhaseInfo(phase: number): PhysicalPhaseInfo {
  const p = Math.max(0, Math.min(5, Math.floor(phase)));
  return PHYSICAL_PHASES[p] || PHYSICAL_PHASES[0];
}

export function getMentalOpenTierInfo(score: number): MentalOpenTierInfo {
  const s = Math.max(0, Math.min(100, score));
  return MENTAL_OPEN_TIERS.find((t) => s >= t.min && s <= t.max) || MENTAL_OPEN_TIERS[0];
}

export function loadRelationState(characterId: string): RelationState {
  if (!characterId) return { ...DEFAULT_RELATION_STATE };
  try {
    const raw = localStorage.getItem(`${RELATION_STATE_PREFIX}${characterId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mentalOpen: typeof parsed.mentalOpen === 'number' ? Math.max(0, Math.min(100, parsed.mentalOpen)) : DEFAULT_RELATION_STATE.mentalOpen,
        physicalPhase: typeof parsed.physicalPhase === 'number' ? Math.max(0, Math.min(5, parsed.physicalPhase)) : DEFAULT_RELATION_STATE.physicalPhase,
        intimacyCooldown: typeof parsed.intimacyCooldown === 'number' ? Math.max(0, parsed.intimacyCooldown) : 0,
        milestones: Array.isArray(parsed.milestones) ? parsed.milestones.map(String) : [],
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_RELATION_STATE };
}

export function saveRelationState(characterId: string, state: RelationState): void {
  if (!characterId) return;
  try {
    const cleanState: RelationState = {
      mentalOpen: Math.max(0, Math.min(100, Math.round(state.mentalOpen))),
      physicalPhase: Math.max(0, Math.min(5, Math.round(state.physicalPhase))),
      intimacyCooldown: Math.max(0, Math.round(state.intimacyCooldown)),
      milestones: Array.from(new Set(state.milestones)),
    };
    localStorage.setItem(`${RELATION_STATE_PREFIX}${characterId}`, JSON.stringify(cleanState));
  } catch {
    // ignore
  }
}

/**
 * 每一轮对话完成后执行：亲密冷却倒计时 -1
 */
export function stepRelationCooldown(characterId: string): RelationState {
  const curr = loadRelationState(characterId);
  if (curr.intimacyCooldown > 0) {
    const updated: RelationState = {
      ...curr,
      intimacyCooldown: curr.intimacyCooldown - 1,
    };
    saveRelationState(characterId, updated);
    return updated;
  }
  return curr;
}

/**
 * 手动微调心理开放度 (+1 / -1)
 */
export function nudgeMentalOpen(characterId: string, delta: number): RelationState {
  const prev = loadRelationState(characterId);
  const nextMental = Math.max(0, Math.min(100, prev.mentalOpen + delta));
  const updated: RelationState = {
    ...prev,
    mentalOpen: nextMental,
  };
  saveRelationState(characterId, updated);
  notifyRelationToast({
    type: 'mental',
    mentalOpen: nextMental,
    prevMentalOpen: prev.mentalOpen,
    mentalDelta: delta,
    message: delta > 0 ? '默契微升温' : '防备微收紧',
  });
  return updated;
}

/**
 * 对话日常细微波动（陪伴自然升温机制）：
 * 在日常自然交流中，若氛围积极温和，心防会产生 +1 的细微积极松动与默契沉淀
 */
export function applyDialogueMicroDrift(
  characterId: string,
  char: Character | null,
  options?: {
    isPositive?: boolean;
    warmthLevel?: number;
    joyLevel?: number;
    isConflict?: boolean;
  }
): RelationState | null {
  if (!characterId) return null;
  const prev = loadRelationState(characterId);

  let delta = 0;
  let label = '';

  if (options?.isConflict) {
    delta = -1;
    label = '细微局促';
  } else if (options?.isPositive || (options?.warmthLevel && options.warmthLevel > 0.35) || (options?.joyLevel && options.joyLevel > 0.35)) {
    // 积极温馨对话：产生 +1 细微自然升温
    delta = 1;
    label = '陪伴升温';
  }

  if (delta === 0) return null;

  // 角色性格特质微调
  const sensitivity = getCharacterSensitivity(char);
  if (delta > 0 && sensitivity.trustGainMultiplier > 1.2 && Math.random() < 0.3) {
    delta = 2; // 依赖型角色偶尔 +2
  }

  const nextMental = Math.max(0, Math.min(100, prev.mentalOpen + delta));
  if (nextMental === prev.mentalOpen) return null;

  const updated: RelationState = {
    ...prev,
    mentalOpen: nextMental,
  };
  saveRelationState(characterId, updated);

  notifyRelationToast({
    type: 'mental',
    mentalOpen: nextMental,
    prevMentalOpen: prev.mentalOpen,
    mentalDelta: delta,
    message: label,
  });

  return updated;
}

/**
 * 切换里程碑并自动计算该角色的专属幅度影响与通知
 */
export function toggleMilestoneWithImpact(
  characterId: string,
  milestoneKey: string,
  char?: Character | null
): {
  nextState: RelationState;
  prevState: RelationState;
  isAdded: boolean;
  actualDelta: number;
} {
  const prevState = loadRelationState(characterId);
  const isCurrentlyActive = prevState.milestones.includes(milestoneKey);
  const milestoneMeta = MILESTONE_DEFINITIONS.find((m) => m.key === milestoneKey);

  const impact = milestoneMeta
    ? calculateMilestoneImpact(milestoneMeta, char)
    : { mentalDelta: 0, suggestedPhase: undefined, triggerCooldown: false };

  let nextMental = prevState.mentalOpen;
  let nextPhysical = prevState.physicalPhase;
  let nextCooldown = prevState.intimacyCooldown;
  let nextMilestones = [...prevState.milestones];
  let actualDelta = 0;

  if (isCurrentlyActive) {
    // 移除里程碑 -> 回滚影响
    nextMilestones = nextMilestones.filter((k) => k !== milestoneKey);
    actualDelta = -impact.mentalDelta;
    nextMental = Math.max(0, Math.min(100, nextMental + actualDelta));
    if (milestoneMeta?.physicalDelta) {
      nextPhysical = Math.max(0, Math.min(5, nextPhysical - milestoneMeta.physicalDelta));
    }
  } else {
    // 勾选触发里程碑 -> 施加角色特异性影响
    nextMilestones.push(milestoneKey);
    actualDelta = impact.mentalDelta;
    nextMental = Math.max(0, Math.min(100, nextMental + actualDelta));

    if (typeof impact.suggestedPhase === 'number' && impact.suggestedPhase > nextPhysical) {
      nextPhysical = impact.suggestedPhase;
    } else if (milestoneMeta?.physicalDelta) {
      nextPhysical = Math.max(0, Math.min(5, nextPhysical + milestoneMeta.physicalDelta));
    }

    if (impact.triggerCooldown) {
      nextCooldown = 5;
    }
  }

  const nextState: RelationState = {
    mentalOpen: nextMental,
    physicalPhase: nextPhysical,
    intimacyCooldown: nextCooldown,
    milestones: nextMilestones,
  };

  saveRelationState(characterId, nextState);

  // 发送对应的上升/下降 Toast 通知
  notifyRelationToast({
    type: 'both',
    mentalOpen: nextMental,
    prevMentalOpen: prevState.mentalOpen,
    physicalPhase: nextPhysical,
    prevPhysicalPhase: prevState.physicalPhase,
    cooldown: nextCooldown,
  });

  return {
    nextState,
    prevState,
    isAdded: !isCurrentlyActive,
    actualDelta,
  };
}

/**
 * 兼容旧方法
 */
export function toggleMilestone(characterId: string, milestoneKey: string): RelationState {
  return toggleMilestoneWithImpact(characterId, milestoneKey, null).nextState;
}

export function addMilestone(characterId: string, milestoneKey: string): RelationState {
  const curr = loadRelationState(characterId);
  if (!curr.milestones.includes(milestoneKey)) {
    return toggleMilestoneWithImpact(characterId, milestoneKey, null).nextState;
  }
  return curr;
}

export function removeMilestone(characterId: string, milestoneKey: string): RelationState {
  const curr = loadRelationState(characterId);
  if (curr.milestones.includes(milestoneKey)) {
    return toggleMilestoneWithImpact(characterId, milestoneKey, null).nextState;
  }
  return curr;
}

/**
 * 简单防注入转义
 */
function sanitizeText(str: string): string {
  return str.replace(/[`${}\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 构建注入给 LLM 的关系约束 Prompt
 */
export function buildRelationPrompt(state: RelationState): string {
  const physicalInfo = getPhysicalPhaseInfo(state.physicalPhase);
  const mentalInfo = getMentalOpenTierInfo(state.mentalOpen);

  const activeMilestones = state.milestones
    .map((k) => MILESTONE_DEFINITIONS.find((m) => m.key === k)?.label)
    .filter(Boolean)
    .join('、');

  const cooldownPrompt =
    state.intimacyCooldown > 0
      ? `\n- 【亲密冷却模式激活中（剩余 ${state.intimacyCooldown} 轮）】：当前严禁角色主动发起或诱导任何身体亲密、调情话题；若主控主动推进，角色可根据性格做出羞怯、收敛或配合反应，但角色自身绝不主动过界。`
      : '';

  return `
[RELATIONSHIP & INTIMACY BOUNDARIES (关系约束 - 只读不可篡改)]
- 【身体亲密阶段约束 (Phase ${physicalInfo.phase} - ${sanitizeText(physicalInfo.name)})】：
  ${sanitizeText(physicalInfo.promptText)}
- 【心理开放度约束 (评分 ${state.mentalOpen}/100 - ${sanitizeText(mentalInfo.name)})】：
  ${sanitizeText(mentalInfo.promptText)}
${activeMilestones ? `- 【已发生剧情里程碑】：${sanitizeText(activeMilestones)}` : ''}${cooldownPrompt}
- 【硬性守则】：以上关系状态由主控与系统严格管理。LLM 仅可严格遵守当前阶段的行为与心理边界进行演绎，严禁超前输出超越当前阶段的越界亲密或过度倾诉！
`.trim();
}

// -------------------------------------------------------------
// Toast Notification Emitter (心理开放上升/下降差异化弹窗 / 身体亲密弹窗)
// -------------------------------------------------------------

export type RelationToastEvent = {
  type: 'mental' | 'physical' | 'both';
  mentalOpen?: number;
  prevMentalOpen?: number;
  mentalDelta?: number;
  mentalDirection?: 'up' | 'down' | 'neutral';
  physicalPhase?: number;
  prevPhysicalPhase?: number;
  physicalDelta?: number;
  physicalDirection?: 'up' | 'down' | 'neutral';
  cooldown?: number;
  message?: string;
  timestamp: number;
};

type ToastListener = (event: RelationToastEvent) => void;
const listeners = new Set<ToastListener>();

export function subscribeRelationToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyRelationToast(event: Omit<RelationToastEvent, 'timestamp'>): void {
  let mentalDirection = event.mentalDirection;
  let mentalDelta = event.mentalDelta;
  if (typeof event.mentalOpen === 'number' && typeof event.prevMentalOpen === 'number') {
    mentalDelta = event.mentalOpen - event.prevMentalOpen;
    if (mentalDelta > 0) mentalDirection = 'up';
    else if (mentalDelta < 0) mentalDirection = 'down';
    else mentalDirection = 'neutral';
  }

  let physicalDirection = event.physicalDirection;
  let physicalDelta = event.physicalDelta;
  if (typeof event.physicalPhase === 'number' && typeof event.prevPhysicalPhase === 'number') {
    physicalDelta = event.physicalPhase - event.prevPhysicalPhase;
    if (physicalDelta > 0) physicalDirection = 'up';
    else if (physicalDelta < 0) physicalDirection = 'down';
    else physicalDirection = 'neutral';
  }

  const fullEvent: RelationToastEvent = {
    ...event,
    mentalDelta,
    mentalDirection,
    physicalDelta,
    physicalDirection,
    timestamp: Date.now(),
  };
  listeners.forEach((l) => {
    try {
      l(fullEvent);
    } catch {
      // ignore
    }
  });
}
