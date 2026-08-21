// ============================================================================
// 风铃·五子棋系统矫正补充协议 - JS 机械层核心引擎
// 职责：
// 1. 规则校验、落子合法性检查、胜负判定
// 2. 对所有合法落子打分，输出 Top-5 候选落子集合 (含得分与战术意图)
// 3. 统计历史步数，产出客观事实标记：isPlayerSandbagging (放水检测) 及 放弃优质点位记录
// 4. 防幻觉与容错校验：验证 LLM 选择的落子坐标，校验失败自动降级到 Top-1
// ============================================================================

import type { EmotionVector } from '../data/types';

export const BOARD_SIZE = 15;
export type Cell = 'B' | 'W' | null;

export interface CandidateMove {
  coord: [number, number]; // [r, c]
  score: number;
  reason: string;
  threatLevel: 'win' | 'block_win' | 'four' | 'block_four' | 'three' | 'block_three' | 'position' | 'neutral';
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
  innerThought?: string;
  spokenDialogue?: string;
  emotionDelta?: Partial<EmotionVector>;
  timestamp: number;
}

export interface LlmMoveDecision {
  selected_move: [number, number];
  inner_thought: string;
  spoken_dialogue: string;
  step_emotion_delta: Partial<EmotionVector>;
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
// 3. Top-5 Candidate Generator (JS Mechanical Layer)
// -------------------------------------------------------------

export function generateTop5CandidateMoves(
  board: Cell[][],
  aiColor: 'B' | 'W'
): CandidateMove[] {
  const humanColor: 'B' | 'W' = aiColor === 'B' ? 'W' : 'B';
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal \
    [1, -1], // diagonal /
  ];

  // Check if board is completely empty -> Center point [7, 7]
  const isBoardEmpty = board.every((row) => row.every((c) => c === null));
  if (isBoardEmpty) {
    return [
      { coord: [7, 7], score: 1000, reason: '天元开局占据全局中心', threatLevel: 'position' },
      { coord: [7, 8], score: 800, reason: '近中腹开局', threatLevel: 'position' },
      { coord: [8, 7], score: 800, reason: '近中腹开局', threatLevel: 'position' },
      { coord: [6, 7], score: 800, reason: '近中腹开局', threatLevel: 'position' },
      { coord: [7, 6], score: 800, reason: '近中腹开局', threatLevel: 'position' },
    ];
  }

  const allScoredMoves: CandidateMove[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;

      // Distance from center factor
      const centerDist = Math.abs(r - 7) + Math.abs(c - 7);
      const positionalBonus = (14 - centerDist) * 2;

      // Neighbor pruning (within 2 cells)
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
      if (!hasNeighbor) continue;

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

      // Priority calculation
      let finalScore = positionalBonus;
      let primaryReason = '拓展外势';
      let threatLevel: CandidateMove['threatLevel'] = 'position';

      if (totalAiScore >= 500000) {
        finalScore += 1000000;
        primaryReason = '本手可立即成五获胜！';
        threatLevel = 'win';
      } else if (totalHumanScore >= 500000) {
        finalScore += 600000;
        primaryReason = '紧急防守！封堵对手下一步必胜点';
        threatLevel = 'block_win';
      } else if (totalAiScore >= 50000) {
        finalScore += 200000 + totalAiScore;
        primaryReason = '进攻核心点：形成双活三或活四胜势';
        threatLevel = 'four';
      } else if (totalHumanScore >= 50000) {
        finalScore += 150000 + totalHumanScore;
        primaryReason = '关键防守：瓦解对手活四/冲四攻势';
        threatLevel = 'block_four';
      } else if (totalAiScore >= 10000 && totalHumanScore >= 10000) {
        finalScore += 80000 + totalAiScore + totalHumanScore;
        primaryReason = '攻防兼备点：同时开拓己方并压制对手';
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

      allScoredMoves.push({
        coord: [r, c],
        score: Math.round(finalScore),
        reason: primaryReason,
        threatLevel,
      });
    }
  }

  // Sort descending by score
  allScoredMoves.sort((a, b) => b.score - a.score);

  // Return Top-5 (or up to 5)
  return allScoredMoves.slice(0, 5);
}

// -------------------------------------------------------------
// 4. Sandbagging (Letting / 放水) Objective Fact Detector
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
// 5. Accumulate Isolated Game Emotion Delta
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
// 5. Anti-Hallucination Fallback & Validator (JS Mechanical Layer)
// -------------------------------------------------------------

export function validateAndSanitizeLlmMove(
  llmSelectedMove: [number, number] | undefined | null,
  top5Candidates: CandidateMove[],
  board: Cell[][]
): { validCoord: [number, number]; wasFallback: boolean; warning?: string } {
  if (top5Candidates.length === 0) {
    // Ultimate fallback to center or first empty
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === null) return { validCoord: [r, c], wasFallback: true, warning: '棋盘满盘回退' };
      }
    }
    return { validCoord: [7, 7], wasFallback: true };
  }

  const top1 = top5Candidates[0].coord;

  if (!llmSelectedMove || !Array.isArray(llmSelectedMove) || llmSelectedMove.length !== 2) {
    return {
      validCoord: top1,
      wasFallback: true,
      warning: 'LLM 未返回有效坐标格式，已安全降级至候选池 Top-1 最优手',
    };
  }

  const [r, c] = llmSelectedMove;

  // Check bounds
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
    return {
      validCoord: top1,
      wasFallback: true,
      warning: `LLM 返回越界坐标 [${r}, ${c}]，已安全降级至候选池 Top-1 最优手`,
    };
  }

  // Check if cell is already occupied
  if (board[r][c] !== null) {
    return {
      validCoord: top1,
      wasFallback: true,
      warning: `LLM 选择的点位 [${r}, ${c}] 已有棋子，已安全降级至候选池 Top-1 最优手`,
    };
  }

  // Check if it belongs to Top-5 candidate pool
  const isInsideTop5 = top5Candidates.some((cand) => cand.coord[0] === r && cand.coord[1] === c);
  if (!isInsideTop5) {
    return {
      validCoord: top1,
      wasFallback: true,
      warning: `LLM 选择的点位 [${r}, ${c}] 不在 Top-5 候选集合中，已安全校准为 Top-1 最优手`,
    };
  }

  return {
    validCoord: [r, c],
    wasFallback: false,
  };
}

// -------------------------------------------------------------
// 6. Character Surrender Detection
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
// 7. Missing Fields Sanitizer for LLM Decision Layer
// -------------------------------------------------------------

export function sanitizeLlmDecision(rawJson: any, top5Candidates: CandidateMove[], board: Cell[][]): {
  coord: [number, number];
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

  const moveCheck = validateAndSanitizeLlmMove(rawJson?.selected_move, top5Candidates, board);

  const innerThought = typeof rawJson?.inner_thought === 'string' && rawJson.inner_thought.trim()
    ? rawJson.inner_thought.trim()
    : isSurrender
    ? '*此局已无解，我投子认负了。*'
    : '无内心活动记录';

  const spokenDialogue = typeof rawJson?.spoken_dialogue === 'string' && rawJson.spoken_dialogue.trim()
    ? rawJson.spoken_dialogue.trim()
    : isSurrender
    ? '（端详棋局良久，轻叹一声放下手中棋子）"大势已去，这一局是你技高一筹，我认输了。"'
    : '……';

  const stepEmotionDelta: Partial<EmotionVector> = {};
  if (rawJson?.step_emotion_delta && typeof rawJson.step_emotion_delta === 'object') {
    for (const key of ['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const) {
      const val = rawJson.step_emotion_delta[key];
      if (typeof val === 'number' && !isNaN(val)) {
        // Clamp step delta between -0.3 and +0.3
        stepEmotionDelta[key] = Math.max(-0.3, Math.min(0.3, Math.round(val * 1000) / 1000));
      }
    }
  }

  return {
    coord: moveCheck.validCoord,
    innerThought,
    spokenDialogue,
    stepEmotionDelta,
    wasFallback: moveCheck.wasFallback,
    surrender: isSurrender,
  };
}
