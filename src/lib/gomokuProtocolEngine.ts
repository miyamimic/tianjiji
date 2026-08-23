// ============================================================================
// 风铃·五子棋系统矫正补充协议 - JS 机械层核心引擎
// ----------------------------------------------------------------------------
// 顶层红线：等级与情绪加权属于机械层的“能力与偏好微调”，永远不能替代 LLM 的策略意图决策。
// JS 侧一切加权、封顶，不能变成硬编码人格行为脚本。
// 核心原则：
// 情绪、等级只调整 JS 侧候选池内部分数与能力上限；不会删减三组集合；不会强制限定 LLM 的 selected_strategy 策略选择；主观策略意图完全交由 LLM 决策。
// 
// 职责：
// 1. 规则校验、落子合法性检查、胜负判定
// 2. 计算全部合法落子并打分，按棋风聚类为三组 (aggressive / balanced / passive)，每组提供 2-3 条候选项
// 3. 执行角色棋力等级上限裁切（仅限 aggressive 原始分）及主世界情绪组内软加权（乘法偏移+封顶）
// 4. 统计历史步数，产出客观事实标记：isPlayerSandbagging (放水检测) 及 放弃优质点位记录（仅做文本客观信息传递，严禁改动算法打分）
// 5. 防幻觉与容错校验：根据 LLM 策略意图反选落子，校验失败自动降级到 balanced
// ============================================================================

import type { EmotionVector } from '../data/types';
import type { GomokuRank } from './customStore';

export const BOARD_SIZE = 15;
export type Cell = 'B' | 'W' | null;
export type GomokuStrategy = 'aggressive' | 'balanced' | 'passive';
export type { GomokuRank } from './customStore';

export interface CandidateMove {
  coord: [number, number]; // [r, c]
  score: number;
  reason: string;
  threatLevel: 'win' | 'block_win' | 'four' | 'block_four' | 'three' | 'block_three' | 'position' | 'neutral';
}

export interface StrategyCandidateGroup {
  aggressive: CandidateMove[];
  balanced: CandidateMove[];
  passive: CandidateMove[];
}

export interface GomokuCandidatePools {
  attack_candidates: CandidateMove[];
  defend_candidates: CandidateMove[];
  steady_candidates: CandidateMove[];
}

export interface GomokuWeights {
  weight_attack: number;
  weight_defend: number;
  weight_steady: number;
}

export interface GomokuLlmOutput {
  action?: 'move' | 'resign';
  weight_attack: number;
  weight_defend: number;
  weight_steady: number;
  opponent_impression: string;
  thought_note: string;
  opening_dialog: string;
  speech_text: string;
  ending_dialog: string;
}

export interface SandbaggingReport {
  isPlayerSandbagging: boolean;
  abandonedBestPoints: Array<{
    coord: [number, number];
    reason: string;
    missedAdvantage: number;
  }>;
  playerMistakeCount: number;
}

export interface StepLogItem {
  step: number;
  coord: [number, number];
  color: 'B' | 'W';
  strategy?: GomokuStrategy;
  weights?: GomokuWeights;
  chosenPool?: 'attack' | 'defend' | 'steady';
  isEmergencyOverride?: boolean;
  emotionLabel?: string;
  innerThought?: string;
  spokenDialogue?: string;
  emotionDelta?: Partial<EmotionVector>;
  timestamp: number;
}

export interface LlmMoveDecision {
  selected_strategy: GomokuStrategy;
  inner_thought: string;
  spoken_dialogue: string;
  step_emotion_delta: Partial<EmotionVector>;
  emotion_label?: string;
  surrender?: boolean;
}

// -------------------------------------------------------------
// 1. Check Win Condition
// -------------------------------------------------------------

export function checkWinner(board: Cell[][]): { winner: Cell; line?: [number, number][] } {
  const directions = [
    [0, 1],  // Horizontal
    [1, 0],  // Vertical
    [1, 1],  // Diagonal \
    [1, -1], // Diagonal /
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell) continue;

      for (const [dr, dc] of directions) {
        let count = 1;
        const line: [number, number][] = [[r, c]];

        for (let step = 1; step < 5; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === cell) {
            count++;
            line.push([nr, nc]);
          } else {
            break;
          }
        }

        if (count >= 5) {
          return { winner: cell, line };
        }
      }
    }
  }

  return { winner: null };
}

// -------------------------------------------------------------
// 2. Line Evaluator for Scoring & Intent Description
// -------------------------------------------------------------

interface LineEval {
  count: number;
  openEnds: number;
  score: number;
  description: string;
  threat: CandidateMove['threatLevel'];
}

function evaluateDirection(
  board: Cell[][],
  r: number,
  c: number,
  dr: number,
  dc: number,
  color: 'B' | 'W'
): LineEval {
  let count = 0;
  let openEnds = 0;

  // Forward direction
  let step = 1;
  while (step <= 4) {
    const nr = r + dr * step;
    const nc = c + dc * step;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
    if (board[nr][nc] === color) {
      count++;
      step++;
    } else if (board[nr][nc] === null) {
      openEnds++;
      break;
    } else {
      break;
    }
  }

  // Backward direction
  step = 1;
  while (step <= 4) {
    const nr = r - dr * step;
    const nc = c - dc * step;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
    if (board[nr][nc] === color) {
      count++;
      step++;
    } else if (board[nr][nc] === null) {
      openEnds++;
      break;
    } else {
      break;
    }
  }

  if (count >= 4) {
    return { count, openEnds, score: 500000, description: '连五绝杀', threat: 'win' };
  }
  if (count === 3) {
    if (openEnds === 2) {
      return { count, openEnds, score: 50000, description: '活四成局', threat: 'four' };
    }
    if (openEnds === 1) {
      return { count, openEnds, score: 8000, description: '冲四施压', threat: 'four' };
    }
  }
  if (count === 2) {
    if (openEnds === 2) {
      return { count, openEnds, score: 6000, description: '成活三', threat: 'three' };
    }
    if (openEnds === 1) {
      return { count, openEnds, score: 800, description: '眠三蓄势', threat: 'three' };
    }
  }
  if (count === 1) {
    if (openEnds === 2) {
      return { count, openEnds, score: 400, description: '活二拓路', threat: 'position' };
    }
    if (openEnds === 1) {
      return { count, openEnds, score: 50, description: '眠二布子', threat: 'position' };
    }
  }

  return { count: 0, openEnds: 0, score: 0, description: '占位', threat: 'neutral' };
}

// -------------------------------------------------------------
// 3. Strategy Candidate Groups Generator (JS Mechanical Layer)
// -------------------------------------------------------------

/**
 * Computes all legal moves, scores them, and clusters them into 3 distinct tactical groups:
 * - aggressive: threatening moves (forms AI threat >= live three / rush four / win)
 * - balanced: blocks opponent live three / rush four while establishing AI presence (>= live two)
 * - passive: far points (Manhattan dist >= 8 from center) or quiet low-threat positions
 *
 * Execution Pipeline (Strictly Preserves LLM Choice & Groups):
 * 1. Base clustering & candidate extraction (each group maintains 2-3 candidates).
 * 2. Character Rank Cap on aggressive original scores (bronze/silver/gold/master).
 * 3. Emotion intra-group soft-weighting (multipliers capped at 1.5x) reading main world snapshot.
 *
 * Each group maintains at least 2 candidates; passive is never empty.
 */
export function generateStrategyCandidateGroups(
  board: Cell[][],
  aiColor: 'B' | 'W',
  charRank: GomokuRank = 'gold',
  emotionSnapshot?: Partial<EmotionVector>
): StrategyCandidateGroup {
  const humanColor: 'B' | 'W' = aiColor === 'B' ? 'W' : 'B';
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal \
    [1, -1], // diagonal /
  ];

  // Check if board is completely empty -> Center & near-center layout
  const isBoardEmpty = board.every((row) => row.every((c) => c === null));
  if (isBoardEmpty) {
    const rawAggressive: CandidateMove[] = [
      { coord: [7, 7], score: 1000, reason: '占据天元全局中心', threatLevel: 'position' },
      { coord: [7, 8], score: 850, reason: '紧邻天元开局', threatLevel: 'position' },
      { coord: [8, 7], score: 850, reason: '紧邻天元开局', threatLevel: 'position' },
    ];
    const rawBalanced: CandidateMove[] = [
      { coord: [6, 7], score: 800, reason: '中腹均衡占位', threatLevel: 'position' },
      { coord: [7, 6], score: 800, reason: '中腹均衡占位', threatLevel: 'position' },
      { coord: [8, 8], score: 750, reason: '斜向星位占角', threatLevel: 'position' },
    ];
    const rawPassive: CandidateMove[] = [
      { coord: [3, 3], score: 300, reason: '边角星位起手（保守开局）', threatLevel: 'position' },
      { coord: [11, 11], score: 300, reason: '外围边角开局', threatLevel: 'position' },
      { coord: [3, 11], score: 280, reason: '远端外势开局', threatLevel: 'position' },
    ];

    return applyRankAndEmotionWeighting(rawAggressive, rawBalanced, rawPassive, charRank, emotionSnapshot);
  }

  const aggressiveList: CandidateMove[] = [];
  const balancedList: CandidateMove[] = [];
  const passiveList: CandidateMove[] = [];
  const allScoredMoves: CandidateMove[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;

      const manhattanDist = Math.abs(r - 7) + Math.abs(c - 7);
      const positionalBonus = (14 - manhattanDist) * 2;

      // Neighbor check (within 2 cells)
      let hasNeighbor = false;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] !== null) {
            hasNeighbor = true;
            break;
          }
        }
        if (hasNeighbor) break;
      }

      // If far without neighbors, it qualifies naturally for passive if distance >= 8
      if (!hasNeighbor && manhattanDist < 8) {
        continue;
      }

      let totalAiScore = 0;
      let totalHumanScore = 0;
      let aiMaxThreat: CandidateMove['threatLevel'] = 'neutral';
      let humanMaxThreat: CandidateMove['threatLevel'] = 'neutral';
      let aiReasons: string[] = [];
      let humanDefendReasons: string[] = [];

      for (const [dr, dc] of directions) {
        const aiEval = evaluateDirection(board, r, c, dr, dc, aiColor);
        const humanEval = evaluateDirection(board, r, c, dr, dc, humanColor);

        totalAiScore += aiEval.score;
        totalHumanScore += humanEval.score;

        if (aiEval.score >= 500000) {
          aiMaxThreat = 'win';
          aiReasons.push('己方连五绝杀');
        } else if (aiEval.score >= 50000) {
          if (aiMaxThreat !== 'win') aiMaxThreat = 'four';
          aiReasons.push('成活四');
        } else if (aiEval.score >= 6000) {
          if (aiMaxThreat === 'neutral') aiMaxThreat = 'three';
          aiReasons.push('成活三');
        }

        if (humanEval.score >= 500000) {
          humanMaxThreat = 'block_win';
          humanDefendReasons.push('封堵对手连五绝杀');
        } else if (humanEval.score >= 50000) {
          if (humanMaxThreat !== 'block_win') humanMaxThreat = 'block_four';
          humanDefendReasons.push('封堵对手活四');
        } else if (humanEval.score >= 6000) {
          if (humanMaxThreat === 'neutral') humanMaxThreat = 'block_three';
          humanDefendReasons.push('阻断对手活三');
        }
      }

      // Overall Score Calculation
      let finalScore = positionalBonus;
      let primaryReason = '拓展阵型';
      let threatLevel: CandidateMove['threatLevel'] = 'position';

      if (totalAiScore >= 500000) {
        finalScore += 1000000;
        primaryReason = '本手可立即成五获胜！';
        threatLevel = 'win';
      } else if (totalHumanScore >= 500000) {
        finalScore += 600000;
        primaryReason = '紧急防守！封堵对手胜势点';
        threatLevel = 'block_win';
      } else if (totalAiScore >= 50000) {
        finalScore += 200000 + totalAiScore;
        primaryReason = '进攻核心点：形成双活三或活四胜势';
        threatLevel = 'four';
      } else if (totalHumanScore >= 50000) {
        finalScore += 150000 + totalHumanScore;
        primaryReason = '关键防守：瓦解对手冲四/活四攻势';
        threatLevel = 'block_four';
      } else if (totalAiScore >= 6000 && totalHumanScore >= 6000) {
        finalScore += 80000 + totalAiScore + totalHumanScore;
        primaryReason = '攻防兼备点：开拓己方并压制对手';
        threatLevel = 'three';
      } else if (totalHumanScore >= 6000) {
        finalScore += 30000 + totalHumanScore;
        primaryReason = humanDefendReasons.join('，') || '防守对手关键活三';
        threatLevel = 'block_three';
      } else if (totalAiScore >= 6000) {
        finalScore += 25000 + totalAiScore;
        primaryReason = aiReasons.join('，') || '开拓己方活三优势';
        threatLevel = 'three';
      } else {
        finalScore += totalAiScore * 1.2 + totalHumanScore * 1.0;
        primaryReason = totalAiScore > totalHumanScore ? '向外拓展阵型' : '限制对手发展空间';
        threatLevel = 'position';
      }

      const candidateItem: CandidateMove = {
        coord: [r, c],
        score: Math.round(finalScore),
        reason: primaryReason,
        threatLevel,
      };
      allScoredMoves.push(candidateItem);

      // -------------------------------------------------------------
      // Clustering Criteria (Strict JS Mechanical Rules)
      // -------------------------------------------------------------
      // 1. Aggressive: AI forms threat >= live three / rush four, or direct win
      const isAggressive = totalAiScore >= 6000 || threatLevel === 'win' || threatLevel === 'four';

      // 2. Balanced: Blocks human live three / rush four / win, AND AI forms at least live two (>=400)
      const isBalanced = totalHumanScore >= 6000 && totalAiScore >= 400;

      // 3. Passive: Distance >= 8 from center OR neither aggressive nor balanced (low threat / quiet)
      const isPassive = manhattanDist >= 8 || (!isAggressive && totalHumanScore < 6000);

      if (isAggressive) {
        aggressiveList.push(candidateItem);
      }
      if (isBalanced || (totalHumanScore >= 6000 && !isAggressive)) {
        balancedList.push(candidateItem);
      }
      if (isPassive) {
        passiveList.push(candidateItem);
      }
    }
  }

  // Sort each group descending by score
  aggressiveList.sort((a, b) => b.score - a.score);
  balancedList.sort((a, b) => b.score - a.score);
  passiveList.sort((a, b) => b.score - a.score);
  allScoredMoves.sort((a, b) => b.score - a.score);

  // Guarantee passive group has true low-threat / corner points if needed
  if (passiveList.length < 2) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === null && Math.abs(r - 7) + Math.abs(c - 7) >= 8) {
          const exists = passiveList.some((p) => p.coord[0] === r && p.coord[1] === c);
          if (!exists) {
            passiveList.push({
              coord: [r, c],
              score: 50,
              reason: '边角远点闲棋（低威胁）',
              threatLevel: 'neutral',
            });
          }
        }
        if (passiveList.length >= 3) break;
      }
      if (passiveList.length >= 3) break;
    }
  }

  // Fallback Fill Rules: Ensure each group has at least 2 candidate moves
  const finalAggressive = aggressiveList.slice(0, 3);
  const finalBalanced = balancedList.slice(0, 3);
  const finalPassive = passiveList.slice(0, 3);

  // Fill aggressive if < 2
  if (finalAggressive.length < 2) {
    for (const move of allScoredMoves) {
      if (!finalAggressive.some((m) => m.coord[0] === move.coord[0] && m.coord[1] === move.coord[1])) {
        finalAggressive.push(move);
      }
      if (finalAggressive.length >= 2) break;
    }
  }

  // Fill balanced if < 2
  if (finalBalanced.length < 2) {
    for (const move of allScoredMoves) {
      if (!finalBalanced.some((m) => m.coord[0] === move.coord[0] && m.coord[1] === move.coord[1])) {
        finalBalanced.push(move);
      }
      if (finalBalanced.length >= 2) break;
    }
  }

  // Fill passive if < 2: borrow lowest score candidates
  if (finalPassive.length < 2) {
    const reversedMoves = [...allScoredMoves].reverse();
    for (const move of reversedMoves) {
      if (!finalPassive.some((m) => m.coord[0] === move.coord[0] && m.coord[1] === move.coord[1])) {
        finalPassive.push(move);
      }
      if (finalPassive.length >= 2) break;
    }
  }

  return applyRankAndEmotionWeighting(finalAggressive, finalBalanced, finalPassive, charRank, emotionSnapshot);
}

/**
 * Generates the 3 candidate pools for Gomoku v4.1:
 * - attack_candidates: aggressive points building AI attack / winning lines
 * - defend_candidates: defensive points blocking opponent lines & lethal threats
 * - steady_candidates: balanced / positional points for solid development
 */
export function generateGomokuCandidatePools(
  board: Cell[][],
  aiColor: 'B' | 'W',
  charRank: GomokuRank = 'gold',
  emotionSnapshot?: Partial<EmotionVector>
): GomokuCandidatePools {
  const groups = generateStrategyCandidateGroups(board, aiColor, charRank, emotionSnapshot);
  return {
    attack_candidates: groups.aggressive,
    defend_candidates: groups.balanced,
    steady_candidates: groups.passive,
  };
}

/**
 * JS Weight Cleaning & Normalization (v4.1):
 * 1. Clamp negative values to 0
 * 2. Calculate sum
 * 3. If sum <= 0: fallback to { weight_attack: 0.33, weight_defend: 0.34, weight_steady: 0.33 }
 * 4. If sum > 0: normalize each by sum
 */
export function cleanAndNormalizeWeights(raw?: Partial<GomokuWeights> | null): GomokuWeights {
  let wAttack = Math.max(0, typeof raw?.weight_attack === 'number' && !isNaN(raw.weight_attack) ? raw.weight_attack : 0);
  let wDefend = Math.max(0, typeof raw?.weight_defend === 'number' && !isNaN(raw.weight_defend) ? raw.weight_defend : 0);
  let wSteady = Math.max(0, typeof raw?.weight_steady === 'number' && !isNaN(raw.weight_steady) ? raw.weight_steady : 0);

  const sum = wAttack + wDefend + wSteady;
  if (sum <= 0) {
    return {
      weight_attack: 0.33,
      weight_defend: 0.34,
      weight_steady: 0.33,
    };
  }

  return {
    weight_attack: Math.round((wAttack / sum) * 1000) / 1000,
    weight_defend: Math.round((wDefend / sum) * 1000) / 1000,
    weight_steady: Math.round((wSteady / sum) * 1000) / 1000,
  };
}

/**
 * Weighted Random Sampling across the 3 Candidate Pools:
 * - Uses normalized weights to pick a pool (attack / defend / steady).
 * - Inside the selected pool, picks the candidate with the highest algorithm score.
 * - Respects the user's verbal command and LLM weights (no mechanical emergency override).
 * - Empty Pool Fallback: Automatically degrades to non-empty pools if sampled pool is empty.
 */
export function sampleMoveFromPools(
  pools: GomokuCandidatePools,
  weights: GomokuWeights,
  _isEmergencyDefense: boolean = false
): {
  coord: [number, number];
  candidate: CandidateMove;
  chosenPool: 'attack' | 'defend' | 'steady';
  isEmergencyOverride: boolean;
  wasFallback: boolean;
} {
  const norm = cleanAndNormalizeWeights(weights);

  // Weighted random sampling to select pool
  const rand = Math.random();
  let poolName: 'attack' | 'defend' | 'steady' = 'steady';
  if (rand < norm.weight_attack) {
    poolName = 'attack';
  } else if (rand < norm.weight_attack + norm.weight_defend) {
    poolName = 'defend';
  } else {
    poolName = 'steady';
  }

  let selectedList =
    poolName === 'attack'
      ? pools.attack_candidates
      : poolName === 'defend'
      ? pools.defend_candidates
      : pools.steady_candidates;

  let wasFallback = false;

  if (!selectedList || selectedList.length === 0) {
    wasFallback = true;
    if (pools.defend_candidates && pools.defend_candidates.length > 0) {
      selectedList = pools.defend_candidates;
      poolName = 'defend';
    } else if (pools.steady_candidates && pools.steady_candidates.length > 0) {
      selectedList = pools.steady_candidates;
      poolName = 'steady';
    } else if (pools.attack_candidates && pools.attack_candidates.length > 0) {
      selectedList = pools.attack_candidates;
      poolName = 'attack';
    } else {
      const fallbackCand: CandidateMove = {
        coord: [7, 7],
        score: 100,
        reason: '落子天元',
        threatLevel: 'position',
      };
      return {
        coord: fallbackCand.coord,
        candidate: fallbackCand,
        chosenPool: 'steady',
        isEmergencyOverride: false,
        wasFallback: true,
      };
    }
  }

  // Top scored candidate within the chosen pool
  const chosenCand = selectedList[0];

  return {
    coord: chosenCand.coord,
    candidate: chosenCand,
    chosenPool: poolName,
    isEmergencyOverride: false,
    wasFallback,
  };
}

/**
 * Detects major board turning points / inflection points (v4.1 trigger 3):
 * - Opponent live four or winning threat (crisis)
 * - AI about to complete 5-in-a-row (inflection)
 */
export function detectBoardInflection(
  board: Cell[][],
  aiColor: 'B' | 'W'
): {
  hasCrisis: boolean;
  isEmergencyDefense: boolean;
  reason?: string;
} {
  const pools = generateGomokuCandidatePools(board, aiColor);

  // 1. AI is about to complete 5-in-a-row (immediate win)
  const aiWin = pools.attack_candidates.find((c) => c.threatLevel === 'win' || c.score >= 500000);
  if (aiWin) {
    return {
      hasCrisis: true,
      isEmergencyDefense: false,
      reason: '我方即将达成五连绝杀',
    };
  }

  // 2. Opponent is about to complete 5-in-a-row or has live 4 (life-or-death crisis)
  const humanLethal = pools.defend_candidates.find(
    (c) => c.threatLevel === 'block_win' || c.threatLevel === 'block_four' || c.score >= 150000
  );
  if (humanLethal) {
    return {
      hasCrisis: true,
      isEmergencyDefense: true,
      reason: humanLethal.reason || '对手形成活四或绝杀威胁，进入生死危机',
    };
  }

  return {
    hasCrisis: false,
    isEmergencyDefense: false,
  };
}

/**
 * Detects if the AI currently has 3 consecutive stones in any direction on the board,
 * or forms a live-3 / sleep-3 line.
 */
export function detectAiConsecutiveThree(
  board: Cell[][],
  aiColor: 'B' | 'W'
): {
  hasThree: boolean;
  count: number;
  description?: string;
  key?: string;
} {
  const directions: [number, number][] = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1],  // anti-diagonal /
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== aiColor) continue;

      for (const [dr, dc] of directions) {
        let consecutive = 0;
        for (let step = 0; step < 3; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === aiColor) {
            consecutive++;
          } else {
            break;
          }
        }

        if (consecutive === 3) {
          const prevR = r - dr;
          const prevC = c - dc;
          const nextR = r + dr * 3;
          const nextC = c + dc * 3;
          const prevIsSame = prevR >= 0 && prevR < BOARD_SIZE && prevC >= 0 && prevC < BOARD_SIZE && board[prevR][prevC] === aiColor;
          const nextIsSame = nextR >= 0 && nextR < BOARD_SIZE && nextC >= 0 && nextC < BOARD_SIZE && board[nextR][nextC] === aiColor;

          if (!prevIsSame && !nextIsSame) {
            return {
              hasThree: true,
              count: 3,
              description: `我方在 [${r + 1},${c + 1}] 方向形成三子连线`,
              key: `${r}_${c}_${dr}_${dc}`,
            };
          }
        }
      }
    }
  }

  return { hasThree: false, count: 0 };
}

/**
 * Applies Character Rank ceiling (on aggressive original scores) followed by
 * Emotion intra-group soft-weighting.
 *
 * Guarantees:
 * - Does NOT delete any group.
 * - Does NOT force or constrain LLM selected_strategy.
 * - Caps multiplier at 1.5x max.
 * - Each group preserves >= 2 candidates.
 */
function applyRankAndEmotionWeighting(
  rawAggressive: CandidateMove[],
  rawBalanced: CandidateMove[],
  rawPassive: CandidateMove[],
  charRank: GomokuRank = 'gold',
  emotionSnapshot?: Partial<EmotionVector>
): StrategyCandidateGroup {
  // Deep clone candidates so we don't mutate input objects unexpectedly
  const aggressive = rawAggressive.map((m) => ({ ...m }));
  const balanced = rawBalanced.map((m) => ({ ...m }));
  const passive = rawPassive.map((m) => ({ ...m }));

  // =========================================================================
  // STEP A: Character Rank Capacity Ceiling (applied to aggressive original score)
  // =========================================================================
  const balancedMax = balanced.length > 0 ? Math.max(...balanced.map((m) => m.score)) : 1000;
  let aggressiveCap = Infinity;

  if (charRank === 'bronze') {
    aggressiveCap = Math.round(balancedMax * 0.6);
  } else if (charRank === 'silver') {
    aggressiveCap = Math.round(balancedMax * 0.8);
  } else if (charRank === 'master') {
    aggressiveCap = Math.round(balancedMax * 1.2);
  } else {
    // gold: no cap (Infinity)
    aggressiveCap = Infinity;
  }

  if (aggressiveCap !== Infinity) {
    for (let i = 0; i < aggressive.length; i++) {
      if (aggressive[i].score > aggressiveCap) {
        aggressive[i].score = Math.max(1, aggressiveCap - i * 10);
      }
    }
  }

  // =========================================================================
  // STEP B: Emotion Intra-Group Soft Weighting (Reading Main World Snapshot)
  // =========================================================================
  const isAbove60 = (val?: number) => typeof val === 'number' && (val > 60 || val > 0.6);

  let aggressiveMult = 1.0;
  let balancedMult = 1.0;
  let passiveMult = 1.0;

  if (isAbove60(emotionSnapshot?.warmth)) {
    passiveMult *= 1.2;
  }
  if (isAbove60(emotionSnapshot?.sadness)) {
    passiveMult *= 1.15;
  }
  if (isAbove60(emotionSnapshot?.joy)) {
    balancedMult *= 1.15;
  }
  if (isAbove60(emotionSnapshot?.fear)) {
    balancedMult *= 1.1;
  }
  if (isAbove60(emotionSnapshot?.anger)) {
    aggressiveMult *= 1.2;
  }
  if (isAbove60(emotionSnapshot?.desire)) {
    aggressiveMult *= 1.15;
  }

  // Multiplier ceiling cap at 1.5x max
  aggressiveMult = Math.min(1.5, Math.round(aggressiveMult * 1000) / 1000);
  balancedMult = Math.min(1.5, Math.round(balancedMult * 1000) / 1000);
  passiveMult = Math.min(1.5, Math.round(passiveMult * 1000) / 1000);

  // Apply intra-group multipliers
  aggressive.forEach((m) => {
    m.score = Math.round(m.score * aggressiveMult);
  });
  balanced.forEach((m) => {
    m.score = Math.round(m.score * balancedMult);
  });
  passive.forEach((m) => {
    m.score = Math.round(m.score * passiveMult);
  });

  // Re-sort within each group
  aggressive.sort((a, b) => b.score - a.score);
  balanced.sort((a, b) => b.score - a.score);
  passive.sort((a, b) => b.score - a.score);

  return {
    aggressive: aggressive.slice(0, 3),
    balanced: balanced.slice(0, 3),
    passive: passive.slice(0, 3),
  };
}

/**
 * Produces purely objective information regarding emotion weighting for the LLM prompt.
 * STRICTLY FORBIDS suggestive or directive statements (e.g. "you should choose passive").
 */
export function getEmotionWeightingObjectiveInfo(
  emotionSnapshot?: Partial<EmotionVector>
): { statusText: string; adjustmentText: string; fullPromptHint: string } {
  if (!emotionSnapshot) {
    return {
      statusText: '处于均衡区间',
      adjustmentText: '各策略分组内部候选项保持基线算法评估相对排序',
      fullPromptHint: '候选池信息提示：当前情绪状态：处于均衡区间。算法层面：各策略分组内部候选项保持基线算法评估相对排序；你依然拥有完整自由，可以任意选择 aggressive / balanced / passive 的策略意图。',
    };
  }

  const isAbove60 = (val?: number) => typeof val === 'number' && (val > 60 || val > 0.6);
  const isBelow30 = (val?: number) => typeof val === 'number' && (val < 30 || val < 0.3);

  const getNormVal = (val?: number) => {
    if (typeof val !== 'number') return 0;
    return val > 1 ? Math.round(val) : Math.round(val * 100);
  };

  const statusParts: string[] = [];
  const adjustParts: string[] = [];

  // Check warmth
  if (isAbove60(emotionSnapshot.warmth)) {
    statusParts.push(`温情 ${getNormVal(emotionSnapshot.warmth)} (高)`);
    adjustParts.push('因你的温情情绪，passive 分组内部候选项相对分数已上调');
  } else if (isBelow30(emotionSnapshot.warmth)) {
    statusParts.push(`温情 ${getNormVal(emotionSnapshot.warmth)} (低)`);
  }

  // Check anger
  if (isAbove60(emotionSnapshot.anger)) {
    statusParts.push(`愤怒 ${getNormVal(emotionSnapshot.anger)} (高)`);
    adjustParts.push('因你的愤怒情绪，aggressive 分组内部候选项相对分数已上调');
  } else if (isBelow30(emotionSnapshot.anger)) {
    statusParts.push(`愤怒 ${getNormVal(emotionSnapshot.anger)} (低)`);
  }

  // Check joy
  if (isAbove60(emotionSnapshot.joy)) {
    statusParts.push(`喜悦 ${getNormVal(emotionSnapshot.joy)} (高)`);
    adjustParts.push('因你的喜悦情绪，balanced 分组内部候选项相对分数已上调');
  }

  // Check sadness
  if (isAbove60(emotionSnapshot.sadness)) {
    statusParts.push(`悲伤 ${getNormVal(emotionSnapshot.sadness)} (高)`);
    adjustParts.push('因你的悲伤情绪，passive 分组内部候选项相对分数已上调');
  }

  // Check desire
  if (isAbove60(emotionSnapshot.desire)) {
    statusParts.push(`好胜 ${getNormVal(emotionSnapshot.desire)} (高)`);
    adjustParts.push('因你的好胜情绪，aggressive 分组内部候选项相对分数已上调');
  }

  // Check fear
  if (isAbove60(emotionSnapshot.fear)) {
    statusParts.push(`恐惧 ${getNormVal(emotionSnapshot.fear)} (高)`);
    adjustParts.push('因你的恐惧情绪，balanced 分组内部候选项相对分数已上调');
  }

  const statusText = statusParts.length > 0 ? statusParts.join('，') : '各维度处于标准平稳区间';
  const adjustmentText = adjustParts.length > 0 ? adjustParts.join('；') : '各策略分组内部候选项保持基线算法评估相对排序';

  const fullPromptHint = `候选池信息提示：当前情绪状态：${statusText}。算法层面：${adjustmentText}；你依然拥有完整自由，可以任意选择 aggressive / balanced / passive 的策略意图。`;

  return { statusText, adjustmentText, fullPromptHint };
}

/**
 * Retains Top-5 candidates generator for backward compatibility
 */
export function generateTop5CandidateMoves(
  board: Cell[][],
  aiColor: 'B' | 'W'
): CandidateMove[] {
  const groups = generateStrategyCandidateGroups(board, aiColor);
  const pool = [...groups.aggressive, ...groups.balanced, ...groups.passive];
  const unique: CandidateMove[] = [];
  for (const item of pool) {
    if (!unique.some((u) => u.coord[0] === item.coord[0] && u.coord[1] === item.coord[1])) {
      unique.push(item);
    }
  }
  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, 5);
}

// -------------------------------------------------------------
// 4. Select Move by Strategy (JS Execution Layer)
// -------------------------------------------------------------

/**
 * Maps LLM strategy intent to concrete candidate move:
 * - aggressive: highest scored candidate in aggressive group
 * - balanced: highest scored candidate in balanced group
 * - passive: weighted random draw from passive group (weighted towards higher scores in group)
 *
 * Anti-hallucination: invalid strategy gracefully falls back to balanced.
 */
export function selectMoveByStrategy(
  strategyGroups: StrategyCandidateGroup,
  strategy: GomokuStrategy | string | undefined | null
): {
  coord: [number, number];
  candidate: CandidateMove;
  effectiveStrategy: GomokuStrategy;
  wasFallback: boolean;
  warning?: string;
} {
  let effectiveStrategy: GomokuStrategy = 'balanced';
  let wasFallback = false;
  let warning: string | undefined = undefined;

  if (strategy === 'aggressive' || strategy === 'balanced' || strategy === 'passive') {
    effectiveStrategy = strategy;
  } else {
    effectiveStrategy = 'balanced';
    wasFallback = true;
    warning = `LLM 返回的策略 "${strategy}" 不在枚举集合内，已自动安全回退至 balanced 策略。`;
    console.warn(`[Gomoku Strategy Fallback] ${warning}`);
  }

  const groupCandidates = strategyGroups[effectiveStrategy];

  if (!groupCandidates || groupCandidates.length === 0) {
    // Safety fallback to any available group
    const fallbackGroup = strategyGroups.balanced.length > 0
      ? strategyGroups.balanced
      : strategyGroups.aggressive.length > 0
      ? strategyGroups.aggressive
      : strategyGroups.passive;
    const fallbackCand = fallbackGroup[0] || { coord: [7, 7], score: 100, reason: '落子天元', threatLevel: 'position' };
    return {
      coord: fallbackCand.coord,
      candidate: fallbackCand,
      effectiveStrategy: 'balanced',
      wasFallback: true,
      warning: '候选池为空，安全降级至中腹点位',
    };
  }

  if (effectiveStrategy === 'aggressive') {
    // Pick highest score in aggressive
    const candidate = groupCandidates[0];
    return {
      coord: candidate.coord,
      candidate,
      effectiveStrategy,
      wasFallback,
      warning,
    };
  }

  if (effectiveStrategy === 'balanced') {
    // Pick highest score in balanced
    const candidate = groupCandidates[0];
    return {
      coord: candidate.coord,
      candidate,
      effectiveStrategy,
      wasFallback,
      warning,
    };
  }

  // Passive: Weighted random draw (weighted towards higher scores within passive group)
  // Ensures variety while avoiding repeatedly landing in the exact same dead corner
  const minScore = Math.min(...groupCandidates.map((c) => c.score));
  const weights = groupCandidates.map((c) => Math.max(1, c.score - minScore + 50));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let randomVal = Math.random() * totalWeight;

  let chosenIndex = 0;
  for (let i = 0; i < groupCandidates.length; i++) {
    randomVal -= weights[i];
    if (randomVal <= 0) {
      chosenIndex = i;
      break;
    }
  }

  const candidate = groupCandidates[chosenIndex] || groupCandidates[0];
  return {
    coord: candidate.coord,
    candidate,
    effectiveStrategy,
    wasFallback,
    warning,
  };
}

// -------------------------------------------------------------
// 5. Sandbagging (Letting / 放水) Objective Fact Detector
// -------------------------------------------------------------

export function analyzePlayerSandbagging(
  board: Cell[][],
  playerColor: 'B' | 'W',
  moveHistory: Array<{ step: number; r: number; c: number; color: 'B' | 'W' }>
): SandbaggingReport {
  const playerMoves = moveHistory.filter((m) => m.color === playerColor);
  if (playerMoves.length === 0) {
    return {
      isPlayerSandbagging: false,
      abandonedBestPoints: [],
      playerMistakeCount: 0,
    };
  }

  const lastMove = playerMoves[playerMoves.length - 1];

  // Reconstruct board state before last player move
  const boardBefore = board.map((row) => [...row]);
  boardBefore[lastMove.r][lastMove.c] = null;

  const candidateMoves = generateTop5CandidateMoves(boardBefore, playerColor);
  if (candidateMoves.length === 0) {
    return {
      isPlayerSandbagging: false,
      abandonedBestPoints: [],
      playerMistakeCount: 0,
    };
  }

  const top1 = candidateMoves[0];
  const actualMoveMatch = candidateMoves.find((m) => m.coord[0] === lastMove.r && m.coord[1] === lastMove.c);
  const actualScore = actualMoveMatch ? actualMoveMatch.score : 0;

  const abandonedPoints: Array<{ coord: [number, number]; reason: string; missedAdvantage: number }> = [];
  let isSandbagging = false;

  if (
    (top1.score >= 500000 && actualScore < 100000) ||
    (top1.score >= 150000 && actualScore < 10000) ||
    (top1.score >= 50000 && top1.score - actualScore >= 40000 && moveHistory.length >= 4)
  ) {
    isSandbagging = true;
    abandonedPoints.push({
      coord: top1.coord,
      reason: top1.reason,
      missedAdvantage: top1.score - actualScore,
    });
  }

  return {
    isPlayerSandbagging: isSandbagging,
    abandonedBestPoints: abandonedPoints,
    playerMistakeCount: abandonedPoints.length,
  };
}

// -------------------------------------------------------------
// 6. Accumulate Isolated Game Emotion Delta
// -------------------------------------------------------------

export function accumulateGameEmotionDelta(
  current: Partial<EmotionVector>,
  stepDelta: Partial<EmotionVector>
): Partial<EmotionVector> {
  const result: Partial<EmotionVector> = { ...current };
  for (const k of ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const) {
    const existing = result[k] || 0;
    const delta = stepDelta[k] || 0;
    const combined = existing + delta;
    if (combined !== 0) {
      result[k] = Math.max(-1.0, Math.min(1.0, Math.round(combined * 1000) / 1000));
    }
  }
  return result;
}

// -------------------------------------------------------------
// 7. Character Surrender Detection (Mechanical Layer)
// -------------------------------------------------------------

/**
 * Character surrender should NOT mechanically hijack the game just because of losing positions.
 * Letting the player connect 5-in-a-row themselves provides essential satisfaction and triumph.
 * Mechanical surrender is disabled by default; surrender is reserved as a low-probability,
 * high-EQ emotional decision in the LLM layer (e.g. soothing a frustrated player or teasing).
 */
export function checkIfCharacterShouldSurrender(
  _board: Cell[][],
  _aiColor: 'B' | 'W',
  _moveHistoryLength: number
): { shouldSurrender: boolean; reason?: string } {
  // Mechanical layer never forces surrender - let the human land the winning blow!
  return { shouldSurrender: false };
}

// -------------------------------------------------------------
// 8. Missing Fields & Strategy Sanitizer for LLM Decision Layer
// -------------------------------------------------------------

export function sanitizeLlmDecision(
  rawJson: any,
  strategyGroups: StrategyCandidateGroup,
  rawTextFallback?: string
): {
  coord: [number, number];
  strategy: GomokuStrategy;
  emotionLabel: string;
  innerThought: string;
  spokenDialogue: string;
  stepEmotionDelta: Partial<EmotionVector>;
  wasFallback: boolean;
  surrender: boolean;
} {
  const isSurrender =
    rawJson?.surrender === true ||
    rawJson?.action === 'surrender' ||
    rawJson?.action === 'resign' ||
    rawJson?.surrendered === true;

  // 1. Strategy selection
  const rawStrategy = rawJson?.selected_strategy || rawJson?.strategy;
  const moveResolution = selectMoveByStrategy(strategyGroups, rawStrategy);

  // 2. Monologue extraction priority:
  // Priority 1: JSON inner_thought field
  // Priority 2: Regex match *...* or (...) from rawTextFallback only if JSON lacked it
  // Priority 3: '无内心活动记录' placeholder
  let innerThought = '';
  if (typeof rawJson?.inner_thought === 'string' && rawJson.inner_thought.trim().length >= 2) {
    innerThought = rawJson.inner_thought.trim();
  } else if (rawTextFallback) {
    const starMatch = rawTextFallback.match(/\*([^*]+)\*/);
    const parenMatch = rawTextFallback.match(/[（(]([^）)]+)[）)]/);
    if (starMatch && starMatch[1]?.trim().length >= 3) {
      innerThought = `*${starMatch[1].trim()}*`;
    } else if (parenMatch && parenMatch[1]?.trim().length >= 3) {
      innerThought = `*${parenMatch[1].trim()}*`;
    }
  }

  if (!innerThought) {
    innerThought = isSurrender ? '*此局已无解，我投子认负了。*' : '无内心活动记录';
  }

  // 3. Spoken Dialogue
  const spokenDialogue = typeof rawJson?.spoken_dialogue === 'string' && rawJson.spoken_dialogue.trim()
    ? rawJson.spoken_dialogue.trim()
    : isSurrender
    ? '（端详棋局良久，轻叹一声放下手中棋子）"大势已去，这一局是你技高一筹，我认输了。"'
    : '……';

  // 4. Emotion Label (Fully dynamic from LLM, never overwritten by JS)
  let emotionLabel = typeof rawJson?.emotion_label === 'string' && rawJson.emotion_label.trim()
    ? rawJson.emotion_label.trim()
    : moveResolution.effectiveStrategy === 'aggressive'
    ? '沉着强攻'
    : moveResolution.effectiveStrategy === 'passive'
    ? '棋风偏保守'
    : '稳健应对';

  // 5. Step Emotion Delta
  const stepEmotionDelta: Partial<EmotionVector> = {};
  if (rawJson?.step_emotion_delta && typeof rawJson.step_emotion_delta === 'object') {
    for (const key of ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const) {
      const val = rawJson.step_emotion_delta[key];
      if (typeof val === 'number' && !isNaN(val)) {
        stepEmotionDelta[key] = Math.max(-0.3, Math.min(0.3, Math.round(val * 1000) / 1000));
      }
    }
  }

  return {
    coord: moveResolution.coord,
    strategy: moveResolution.effectiveStrategy,
    emotionLabel,
    innerThought,
    spokenDialogue,
    stepEmotionDelta,
    wasFallback: moveResolution.wasFallback,
    surrender: isSurrender,
  };
}
