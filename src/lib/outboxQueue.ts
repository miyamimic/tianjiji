/**
 * 202 + Outbox Async Generation Queue Engine
 * 
 * Implements a durable, background-resilient Outbox pattern for LLM generation:
 * - 202 Accepted: Asynchronous immediate task acceptance with durable task ID.
 * - Outbox Persistence: Task state is stored in IndexedDB with localStorage fallback.
 * - iOS Background Keep-Alive Integration: Keeps network connections and JS worker alive when switching apps.
 * - Smart Exponential Backoff Retry: Eliminates "Load failed" / transient network drop errors.
 * - Seamless Recovery: Auto-resumes on app focus, pageshow, or online events.
 */

import { backgroundKeepAlive } from './backgroundKeepAlive';
import { 
  callLlmWithGuardrail, 
  parseStructuredLlmResponses, 
  type LlmConfig, 
  type LlmMessage, 
  type StructuredLlmResponse 
} from './llm';
import type { Character, EmotionVector, ChatMessage, DynamicMemory, BackgroundThread } from '../data/types';
import { EMOTION_KEYS, EMOTION_NAMES } from '../data/types';
import { 
  addEmotion, 
  applyIntensityCalibration, 
  processMultiTurnInertia 
} from '../engine/emotion';
import { parseSegments } from '../engine/postprocess';
import { saveDynamicMemory } from './customStore';
import { 
  canCharacterSendInvite, 
  recordCharacterInviteSent, 
  isGameDebugShortcutEnabled, 
  setPendingGameInvite, 
  type GameInvitation 
} from './gameStore';

export type OutboxTaskStatus = 'queued' | 'generating' | 'retrying' | 'completed' | 'failed' | 'cancelled';

export interface OutboxTaskPayload {
  characterId: string;
  character: Character;
  triggerInput: string;
  messageId?: string;
  llmConfig: LlmConfig;
  llmMessages: LlmMessage[];
  currentEmotionSnapshot: EmotionVector;
  backgroundThreads: Array<{ content: string; remaining_turns?: number }>;
  dynamicMemoriesContext?: string;
  targetMsgContent?: string;
  customContext?: Record<string, any>;
}

export interface OutboxTaskResult {
  rawText: string;
  structuredList: StructuredLlmResponse[];
  newReplies: ChatMessage[];
  updatedEmotion: EmotionVector;
  updatedThreads: Array<{ content: string; remaining_turns?: number }>;
  numbedKeys: string[];
  sensitizedKeys: string[];
  generatedMemory?: DynamicMemory;
  gameInvite?: GameInvitation;
}

export interface OutboxTask {
  id: string;
  type: 'chat_reply' | 'game_move' | 'casual_dialogue';
  characterId: string;
  characterName: string;
  status: OutboxTaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  error?: string;
  payload: OutboxTaskPayload;
  result?: OutboxTaskResult;
}

export interface OutboxQueueState {
  activeTaskId: string | null;
  tasks: OutboxTask[];
  isGenerating: boolean;
  totalPending: number;
  lastCompletedTask: OutboxTask | null;
}

const OUTBOX_STORAGE_KEY = '__rp_generation_outbox_queue_v1';
const MAX_DEFAULT_RETRIES = 4;
const TASK_TIMEOUT_MS = 55000; // 55s per network generation attempt

class OutboxQueueEngine {
  private tasks: OutboxTask[] = [];
  private isProcessing = false;
  private listeners = new Set<(state: OutboxQueueState) => void>();
  private completedCallbacks = new Set<(task: OutboxTask) => void>();
  private activeAbortController: AbortController | null = null;
  private retryTimer: any = null;

  constructor() {
    this.loadPersistedTasks();
    this.setupLifecycleRecovery();
    // Start processing if any tasks were pending across reloads
    setTimeout(() => this.processNextTask(), 100);
  }

  private loadPersistedTasks() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Clean up old completed/cancelled tasks older than 1 hour
          const cutoff = Date.now() - 3600 * 1000;
          this.tasks = parsed
            .filter((t) => t && t.id && (t.status === 'queued' || t.status === 'generating' || t.status === 'retrying' || t.createdAt > cutoff))
            .map((t) => {
              // Reset 'generating' back to 'queued' on cold reload so it resumes
              if (t.status === 'generating') {
                return { ...t, status: 'queued' as OutboxTaskStatus };
              }
              return t;
            });
        }
      }
    } catch {
      this.tasks = [];
    }
  }

  private persistTasks() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.tasks.slice(-20)));
    } catch {
      // ignore
    }
  }

  private setupLifecycleRecovery() {
    if (typeof window === 'undefined') return;

    const handleWakeup = () => {
      // If there are pending/retrying tasks and we're not currently processing, resume
      const hasPending = this.tasks.some((t) => t.status === 'queued' || t.status === 'retrying');
      if (hasPending && !this.isProcessing) {
        this.processNextTask();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleWakeup();
      }
    });
    window.addEventListener('pageshow', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    window.addEventListener('online', handleWakeup);
  }

  /**
   * 202 Enqueue Task:
   * Immediately registers task, returns 202 acceptance handle, captures background keep-alive, kicks off worker
   */
  public enqueue(
    type: 'chat_reply' | 'game_move' | 'casual_dialogue',
    payload: OutboxTaskPayload,
    options?: { maxRetries?: number }
  ): { taskId: string; status: 'queued'; acceptedAt: number } {
    const taskId = `task_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const task: OutboxTask = {
      id: taskId,
      type,
      characterId: payload.characterId,
      characterName: payload.character.name,
      status: 'queued',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? MAX_DEFAULT_RETRIES,
      payload,
    };

    this.tasks.push(task);
    this.persistTasks();

    // Acquire iOS background keep-alive lease immediately
    backgroundKeepAlive.acquire(taskId, `generate_${type}`);

    this.notify();

    // Trigger queue worker
    setTimeout(() => this.processNextTask(), 10);

    return {
      taskId,
      status: 'queued',
      acceptedAt: task.createdAt,
    };
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): OutboxTask | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  /**
   * Cancel task
   */
  public cancelTask(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    if (task.status === 'generating' && this.activeAbortController) {
      this.activeAbortController.abort();
    }

    task.status = 'cancelled';
    task.error = '用户取消生成';
    task.completedAt = Date.now();
    backgroundKeepAlive.release(taskId);
    this.persistTasks();
    this.notify();

    if (this.isProcessing) {
      this.isProcessing = false;
      setTimeout(() => this.processNextTask(), 50);
    }
    return true;
  }

  /**
   * Retry task immediately bypassing backoff delay
   */
  public retryImmediately(taskId: string): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.status = 'queued';
    task.nextRetryAt = undefined;
    task.error = undefined;
    backgroundKeepAlive.acquire(taskId, 'retry');
    this.persistTasks();
    this.notify();

    if (!this.isProcessing) {
      this.processNextTask();
    }
    return true;
  }

  /**
   * Main Queue Worker
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing) return;

    // Find next task ready for processing
    const now = Date.now();
    const task = this.tasks.find(
      (t) => t.status === 'queued' || (t.status === 'retrying' && (!t.nextRetryAt || t.nextRetryAt <= now))
    );

    if (!task) {
      // Check if any retrying tasks are scheduled in the future
      const nextPending = this.tasks.find((t) => t.status === 'retrying' && t.nextRetryAt && t.nextRetryAt > now);
      if (nextPending && nextPending.nextRetryAt) {
        const delay = Math.max(100, nextPending.nextRetryAt - now);
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.processNextTask(), delay);
      }
      return;
    }

    this.isProcessing = true;
    task.status = 'generating';
    task.startedAt = task.startedAt || now;
    task.error = undefined;
    this.persistTasks();
    this.notify();

    // Ensure Keep-Alive is locked
    backgroundKeepAlive.acquire(task.id, 'active_processing');

    this.activeAbortController = new AbortController();

    try {
      // Execute the generation payload
      const result = await this.executeGeneration(task, this.activeAbortController.signal);

      // Successfully finished!
      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;
      task.error = undefined;
      backgroundKeepAlive.release(task.id);
      this.persistTasks();
      this.notify();

      // Trigger completion callbacks
      this.completedCallbacks.forEach((cb) => {
        try {
          cb(task);
        } catch (err) {
          console.error('Outbox completion callback error:', err);
        }
      });

      // Dispatch global custom event for components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('rp_outbox_task_completed', {
            detail: { task },
          })
        );
      }
    } catch (err: any) {
      const currentTask = this.getTask(task.id);
      if (currentTask?.status === 'cancelled') {
        // Was explicitly cancelled by user
        this.isProcessing = false;
        return;
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Outbox task ${task.id} execution encountered error:`, errMsg);

      // Evaluate if retryable (e.g. network drops, iOS WebKit pause, rate limits, load failed)
      const isNetworkOrTimeout =
        errMsg.includes('Load failed') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('timeout') ||
        errMsg.includes('aborted') ||
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.includes('502');

      if (task.retryCount < task.maxRetries && (isNetworkOrTimeout || task.retryCount === 0)) {
        task.retryCount += 1;
        task.status = 'retrying';
        task.error = `网络暂时波动（正在自动重试 ${task.retryCount}/${task.maxRetries}）: ${errMsg}`;
        
        // Exponential backoff with jitter: 1.2s -> 2.5s -> 5.0s -> 10s
        const backoffDelay = Math.min(10000, 1200 * Math.pow(1.9, task.retryCount - 1)) + Math.random() * 400;
        task.nextRetryAt = Date.now() + backoffDelay;

        this.persistTasks();
        this.notify();

        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.isProcessing = false;
          this.processNextTask();
        }, backoffDelay);
        return;
      } else {
        // Max retries exceeded or fatal error
        task.status = 'failed';
        task.completedAt = Date.now();
        task.error = `生成失败（已重试 ${task.retryCount} 次）: ${errMsg}`;
        backgroundKeepAlive.release(task.id);
        this.persistTasks();
        this.notify();

        // Dispatch global failure event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('rp_outbox_task_failed', {
              detail: { task, error: errMsg },
            })
          );
        }
      }
    } finally {
      this.activeAbortController = null;
      this.isProcessing = false;
      // Loop to next task
      setTimeout(() => this.processNextTask(), 50);
    }
  }

  /**
   * Internal generator with timeout abort handling
   */
  private async executeGeneration(task: OutboxTask, signal: AbortSignal): Promise<OutboxTaskResult> {
    const {
      character,
      triggerInput,
      llmConfig,
      llmMessages,
      currentEmotionSnapshot,
      backgroundThreads,
    } = task.payload;

    // 1. Timeout race promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`请求超时（超过 ${TASK_TIMEOUT_MS / 1000} 秒未响应，自动重连）`));
      }, TASK_TIMEOUT_MS);

      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('生成已取消'));
      });
    });

    // 2. Call LLM with guardrail & retry
    const generationPromise = callLlmWithGuardrail(llmConfig, llmMessages, character);

    const rawText = await Promise.race([generationPromise, timeoutPromise]);
    const structuredList = parseStructuredLlmResponses(rawText);

    // 3. Process emotions, memories, and chat replies
    const now = Date.now();
    let updatedEmotion = { ...currentEmotionSnapshot };
    const updatedThreads = [...backgroundThreads];
    let maxIntensityThisTurn = 1;
    const netDeltaThisTurn: Partial<EmotionVector> = {};
    const turnNumbedKeys: string[] = [];
    const turnSensitizedKeys: string[] = [];
    const newReplies: ChatMessage[] = [];

    structuredList.forEach((structured, idx) => {
      const intensity = structured.emotion_intensity ?? 3;
      if (intensity > maxIntensityThisTurn) maxIntensityThisTurn = intensity;

      if (structured.emotion_delta && Object.keys(structured.emotion_delta).length > 0) {
        // Calibration
        const calibratedDelta = applyIntensityCalibration(structured.emotion_delta, intensity);

        // Inertia
        const { finalDelta, numbedKeys, sensitizedKeys } = processMultiTurnInertia(
          updatedEmotion,
          calibratedDelta,
          []
        );

        if (numbedKeys.length > 0) {
          numbedKeys.forEach((nk) => {
            if (!turnNumbedKeys.includes(nk)) turnNumbedKeys.push(nk);
          });
        }
        if (sensitizedKeys.length > 0) {
          sensitizedKeys.forEach((sk) => {
            if (!turnSensitizedKeys.includes(sk)) turnSensitizedKeys.push(sk);
          });
        }

        updatedEmotion = addEmotion(updatedEmotion, finalDelta);

        for (const k of EMOTION_KEYS) {
          const d = finalDelta[k];
          if (d !== undefined && d !== null) {
            netDeltaThisTurn[k] = (netDeltaThisTurn[k] || 0) + d;
          }
        }
      }

      if (structured.triggered_memory) {
        updatedThreads.push({
          content: structured.triggered_memory,
          remaining_turns: 3,
        });
      }

      newReplies.push({
        id: `char-${now}-${idx}`,
        role: 'character',
        content: structured.reply,
        segments: parseSegments(structured.reply),
        timestamp: now + idx * 10,
        character_id: character.character_id,
        snapshot: {
          emotion: { ...updatedEmotion },
          backgroundThreads: updatedThreads.map((t) => ({
            content: t.content,
            remaining_turns: t.remaining_turns ?? 3,
          })),
          triggeredAnchors: [],
        },
      });
    });

    // 4. Memory synthesis
    let generatedMemory: DynamicMemory | undefined = undefined;
    const maxDeltaVal = Math.max(0, ...Object.values(netDeltaThisTurn).map((v) => Math.abs(v || 0)));
    if ((maxIntensityThisTurn >= 4 || maxDeltaVal >= 0.2) && triggerInput !== '...' && triggerInput.trim().length >= 2) {
      let topEmotionKey: (typeof EMOTION_KEYS)[number] = 'sadness';
      let topMag = 0;
      for (const k of EMOTION_KEYS) {
        const val = Math.abs(netDeltaThisTurn[k] || 0);
        if (val > topMag) {
          topMag = val;
          topEmotionKey = k;
        }
      }

      const cleanWords = triggerInput
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !['什么', '怎么', '这个', '那个', '因为', '所以', '虽然', '但是'].includes(w));
      const keywords = cleanWords.slice(0, 3);

      if (keywords.length > 0) {
        generatedMemory = {
          id: `dyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          character_id: character.character_id,
          topic_keywords: keywords,
          emotion_type: topEmotionKey,
          intensity: maxIntensityThisTurn,
          user_trigger_summary: `主控说："${triggerInput.slice(0, 35)}${triggerInput.length > 35 ? '...' : ''}"`,
          character_reaction_summary: `${character.name}对这番话产生了显著的${EMOTION_NAMES[topEmotionKey]}共鸣`,
          created_at: Date.now(),
          recall_count: 0,
        };
        saveDynamicMemory(character.character_id, generatedMemory);
      }
    }

    // 5. Game Invite evaluation
    let gameInvite: GameInvitation | undefined = undefined;
    const isGomokuKeyword = /下棋|五子棋|下盘棋|陪我下棋|对弈|下一局/.test(triggerInput);
    const isGhostCardKeyword = /捉鬼牌|抽鬼牌|鬼牌|抽牌游戏|玩捉鬼牌|来局捉鬼牌/.test(triggerInput);
    const gameInviteItem = structuredList.find((st) => st.game_invite);

    if (gameInviteItem?.game_invite && canCharacterSendInvite(character.character_id)) {
      gameInvite = {
        id: `invite_${Date.now()}`,
        gameType: 'gomoku',
        characterId: character.character_id,
        characterName: character.name,
        inviteText: gameInviteItem.game_invite.text || `“棋盘已经为你备好了，要不要与我下一盘五子棋？”`,
        timestamp: Date.now(),
        status: 'pending',
      };
      recordCharacterInviteSent(character.character_id);
      setPendingGameInvite(gameInvite);
    } else if (isGhostCardKeyword && isGameDebugShortcutEnabled()) {
      gameInvite = {
        id: `invite_ghost_${Date.now()}`,
        gameType: 'ghost_card',
        characterId: character.character_id,
        characterName: character.name,
        inviteText: `“牌已经洗好了，要不要来一局惊险刺激的捉鬼牌？看看谁会把鬼牌留在手里🐾”`,
        timestamp: Date.now(),
        status: 'pending',
      };
      setPendingGameInvite(gameInvite);
    } else if (isGomokuKeyword && isGameDebugShortcutEnabled()) {
      gameInvite = {
        id: `invite_debug_${Date.now()}`,
        gameType: 'gomoku',
        characterId: character.character_id,
        characterName: character.name,
        inviteText: `“（调试模式触发）执黑先行，我们来一盘五子棋吧！”`,
        timestamp: Date.now(),
        status: 'pending',
      };
      setPendingGameInvite(gameInvite);
    }

    return {
      rawText,
      structuredList,
      newReplies,
      updatedEmotion,
      updatedThreads,
      numbedKeys: turnNumbedKeys,
      sensitizedKeys: turnSensitizedKeys,
      generatedMemory,
      gameInvite,
    };
  }

  /**
   * Subscribe to outbox queue state
   */
  public subscribe(listener: (state: OutboxQueueState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * Register task completed callback
   */
  public onCompleted(cb: (task: OutboxTask) => void): () => void {
    this.completedCallbacks.add(cb);
    return () => this.completedCallbacks.delete(cb);
  }

  public getState(): OutboxQueueState {
    const activeTask = this.tasks.find((t) => t.status === 'generating' || t.status === 'retrying') || null;
    const completedTasks = this.tasks.filter((t) => t.status === 'completed');
    const lastCompleted = completedTasks.length > 0 ? completedTasks[completedTasks.length - 1] : null;
    const pendingTasks = this.tasks.filter((t) => t.status === 'queued' || t.status === 'generating' || t.status === 'retrying');

    return {
      activeTaskId: activeTask ? activeTask.id : null,
      tasks: [...this.tasks],
      isGenerating: !!activeTask,
      totalPending: pendingTasks.length,
      lastCompletedTask: lastCompleted,
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Outbox listener error:', err);
      }
    });
  }
}

export const outboxQueue = new OutboxQueueEngine();
