// ============================================================================
// 风铃 · AI 抽卡模拟器 (v4) 数据结构与类型定义
// 遵循纯机械层 + LLM 决策层架构
// ============================================================================

export type CardRarity = 'SSR' | 'SR' | 'R';

export interface GachaCard {
  id: string;
  name: string;
  rarity: CardRarity;
  card_image: string;
  description: string;
  featured?: boolean;
}

export interface GachaButton {
  id: string;
  label: string;
  type?: 'pull_single' | 'pull_ten' | 'details' | 'history' | 'custom';
  pullCount?: number; // 1 for single, 10 for ten pull
  position: {
    x: number; // 0 ~ 1 percentage
    y: number; // 0 ~ 1 percentage
  };
  styleVariant?: 'primary' | 'secondary' | 'gold' | 'ghost';
}

export interface GachaSparkReward {
  card_id: string;
  description: string;
}

export interface GachaPoolConfig {
  pool_id: string;
  pool_name: string;
  banner_image: string;
  frame_overlay?: string;
  spark_count: number; // 井计数上限，由配置提供，JS不得硬编码
  spark_reward: GachaSparkReward;
  rates: {
    SSR: number;
    SR: number;
    R: number;
  };
  cards: GachaCard[];
  buttons: GachaButton[];
  cursor_style?: {
    type: 'arrow' | 'feather' | 'wand' | 'paw' | 'star';
    color: string;
    size: number;
  };
}

export type ClickTarget =
  | { type: 'button'; button_id: string }
  | { type: 'blank'; position: { x: number; y: number } };

export type LlmActionType = 'move_to' | 'click' | 'idle' | 'stop';

export interface ClickHabitProfile {
  skip_click_position: { x: number; y: number }; // 0 ~ 1
  click_rhythm: string; // 自由文本
  random_tap: boolean;
  wait_for_user_reply: boolean;
  tap_while_talking: boolean;
  evaluation_timing: 'on_flip' | 'after_all';
}

export interface CardEvaluation {
  card_index: number;
  text: string;
}

// LLM 调用 ① 进入界面输出
export interface LlmCall1EnterOutput {
  first_action: 'move_to' | 'click';
  click_target: ClickTarget;
  opening_bubble: string;
  bubble_to_user: string;
}

// LLM 调用 ② 决策循环输出
export interface LlmCall2DecisionOutput {
  action: LlmActionType;
  click_target: ClickTarget;
  click_rhythm: string;
  bubble_to_user: string;
  bubble_self: string;
  hesitation_ms: number;
}

// LLM 调用 ③ 抽卡结果输出
export interface LlmCall3ResultOutput {
  click_habit_profile: ClickHabitProfile;
  evaluations: CardEvaluation[];
  summary_bubble: string;
}

// LLM 调用 ④ 用户消息输出
export interface LlmCall4UserMsgOutput {
  response_bubble: string;
  action: 'continue' | 'stop' | 'change_target' | 'go_to';
  new_target?: string;
}

// LLM 调用 ⑤ 抽卡结束输出
export interface LlmCall5EndingOutput {
  ending_bubble: string;
  gameTotalDelta: {
    joy: number; // 0 ~ 1
    excitement: number; // 0 ~ 1
    disappointment: number; // 0 ~ 1
  };
}

// 单次抽出的卡牌实例
export interface PulledCardInstance {
  instanceId: string;
  card: GachaCard;
  pullIndex: number;
  isSparkReward?: boolean;
  isFlipped: boolean;
  evaluationText?: string;
}

// 抽卡历史记录项
export interface GachaHistoryRecord {
  id: string;
  timestamp: number;
  pullCount: number;
  cards: GachaCard[];
  sparkCountAtPull: number;
}

// 气泡状态
export interface GachaBubbleState {
  id: string;
  type: 'bubble_to_user' | 'bubble_self' | 'bubble_evaluation';
  text: string;
  createdAt: number;
  durationMs: number;
}

// 虚拟光标状态
export interface VirtualCursorState {
  x: number; // 0 ~ 1 (percent)
  y: number; // 0 ~ 1 (percent)
  isHovering: boolean;
  isClicking: boolean;
  activeBubble: GachaBubbleState | null;
}
