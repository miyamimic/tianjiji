import { ChevronLeft, ChevronRight, Brain, Sparkles, BookMarked, ScanSearch, History } from 'lucide-react';
import EmotionRadar from './EmotionRadar';
import type { EmotionVector, BackgroundThread, TriggeredAnchor, IntentAnalysis, DynamicMemory } from '../data/types';
import { loadDynamicMemories } from '../lib/customStore';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  characterId?: string;
  emotion: EmotionVector;
  previousEmotion: EmotionVector | null;
  emotionConfirmed: boolean;
  onConfirmEmotion: () => void;
  threads: BackgroundThread[];
  anchors: TriggeredAnchor[];
  intent: IntentAnalysis | null;
  fallback: boolean;
  characterName: string;
  /**
   * overlay=true：手机竖屏，侧边栏是"浮在舞台右边"的 overlay（不占文档流，不压缩主内容区）
   * overlay=false：桌面横屏，保留原独立列布局（fixed 占舞台右侧 320px）
   */
  overlayMode?: boolean;
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '正向',
  negative: '负向',
  neutral: '中性',
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-yellow-300',
  negative: 'text-red-300',
  neutral: 'text-white/40',
};

const EMOTION_SHORT: Record<string, string> = {
  anger: '怒',
  fear: '惧',
  joy: '喜',
  sadness: '悲',
  desire: '欲',
  warmth: '温',
};

const EMOTION_CN: Record<string, string> = {
  anger: '愤怒',
  fear: '恐惧',
  joy: '喜悦',
  sadness: '悲伤',
  desire: '欲望',
  warmth: '温情',
};

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

export default function Sidebar({
  isOpen,
  onToggle,
  characterId,
  emotion,
  previousEmotion,
  emotionConfirmed,
  onConfirmEmotion,
  threads,
  anchors,
  intent,
  fallback,
  characterName,
  overlayMode = false,
}: Props) {
  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          className={`${overlayMode ? 'absolute' : 'fixed'} right-0 top-1/2 z-[60] -translate-y-1/2 bg-[hsl(220_22%_13%/0.8)] backdrop-blur-md border border-white/10 border-r-0 rounded-l-lg p-2 text-white/40 hover:text-white transition-all hover:bg-[hsl(220_22%_13%)]`}
          aria-label="展开调试面板"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* overlayMode：盖在舞台之上（absolute inset-y-0 right-0），不占主内容流；
          桌面：fixed（独立列）*/}
      <aside
        className={`${overlayMode ? 'absolute' : 'fixed'} right-0 top-0 z-[70] h-full w-80 max-w-[85vw] bg-[hsl(220_22%_13%/0.6)] backdrop-blur-xl border-l border-white/10 transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">内部状态</h2>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
            aria-label="收起调试面板"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 p-4">
          {/* Emotion Radar */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-[hsl(28_85%_62%)]" />
              <h3 className="text-sm font-medium text-white">六维情绪</h3>
              {previousEmotion && (
                <span className="ml-auto text-[10px] text-[hsl(28_85%_62%)]">自动更新中</span>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-2">
              <EmotionRadar
                emotion={emotion}
                previousEmotion={previousEmotion ?? undefined}
                confirmed={false}
                className="h-[260px] w-full"
              />
            </div>
            <div className="mt-3 space-y-2">
              {(['anger', 'fear', 'joy', 'sadness', 'desire', 'warmth'] as const).map((key) => {
                const oldVal = previousEmotion?.[key];
                const diff = oldVal !== undefined ? emotion[key] - oldVal : 0;
                const hasChange = oldVal !== undefined && Math.abs(diff) >= 0.005;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-12 text-xs text-white/40">{EMOTION_CN[key]}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[hsl(28_85%_62%)] transition-all duration-500"
                        style={{ width: `${Math.round(emotion[key] * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-white/40 tabular-nums">
                      {Math.round(emotion[key] * 100)}
                    </span>
                    {hasChange && (
                      <span className={`w-12 text-[10px] tabular-nums ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* NLP Intent */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ScanSearch className="size-4 text-[hsl(28_85%_62%)]" />
              <h3 className="text-sm font-medium text-white">NLP 意图分析</h3>
              {fallback && (
                <span className="ml-auto text-[10px] text-yellow-300/80">LLM 回退</span>
              )}
            </div>
            {!intent ? (
              <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-center text-xs text-white/40">
                发送消息后，这里展示对输入的理解
                <div className="mt-1 text-[10px] opacity-70">意图 / 实体 / 情感 / 情绪增量</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(28_85%_62%)]">
                      {intent.intent_label || intent.intent || '中性'}
                    </span>
                    <span className={`text-[10px] ${SENTIMENT_COLOR[intent.sentiment] || 'text-white/40'}`}>
                      {SENTIMENT_LABEL[intent.sentiment] || intent.sentiment}
                    </span>
                  </div>
                  {intent.entities.length > 0 && (
                    <div className="mb-1.5 text-[10px] text-white/40">
                      实体：<span className="text-white/80">{intent.entities.join('、')}</span>
                    </div>
                  )}
                  {Object.keys(intent.emotion_delta).length > 0 && (
                    <div className="text-[10px] text-white/40">
                      情绪增量：
                      {Object.entries(intent.emotion_delta)
                        .filter(([, v]) => v !== undefined && v !== 0)
                        .map(([k, v]) => `${EMOTION_SHORT[k] ?? k}${v! > 0 ? '+' : ''}${v!.toFixed(2)}`)
                        .join(' ')}
                    </div>
                  )}
                  {intent.notes && (
                    <div className="mt-1.5 text-[10px] text-white/30 leading-relaxed">
                      {intent.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Background Threads */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Brain className="size-4 text-[hsl(28_85%_62%)]" />
              <h3 className="text-sm font-medium text-white">后台思绪</h3>
              <span className="ml-auto text-xs text-white/40">{threads.length} 条</span>
            </div>
            {threads.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-center text-xs text-white/40">
                暂无活跃思绪
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((t, i) => (
                  <div key={`${t.content}-${i}`} className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3">
                    <p className="text-sm text-white/90">{t.content}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-white/40">剩余 {t.remaining_turns} 轮</span>
                      <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/30"
                          style={{ width: `${Math.min(100, t.remaining_turns * 25)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Memory Anchors */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BookMarked className="size-4 text-[hsl(28_85%_62%)]" />
              <h3 className="text-sm font-medium text-white">记忆锚点</h3>
              <span className="ml-auto text-xs text-white/40">{anchors.length} 条</span>
            </div>
            {anchors.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-center text-xs text-white/40">
                对话中触发的固定记忆锚点
              </div>
            ) : (
              <div className="space-y-2">
                {anchors.map((a, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[hsl(28_85%_62%)]">「{a.anchor.trigger}」</span>
                      <span className="text-xs text-white/40">权重 {a.anchor.weight}</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">{a.anchor.reaction}</p>
                    <p className="mt-1.5 text-xs text-white/40">{formatTimeAgo(a.triggered_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic High-Emotion Memories */}
          {characterId && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <History className="size-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-white">情绪长效记忆联动</h3>
                <span className="ml-auto text-xs text-emerald-400/80">
                  {loadDynamicMemories(characterId).length} 条
                </span>
              </div>
              {loadDynamicMemories(characterId).length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[hsl(222_28%_9%/0.4)] p-3 text-center text-xs text-white/40 leading-relaxed">
                  当对话产生高情绪波动（intensity ≥ 4 或剧烈情绪差）时，系统会自动在此沉淀长效情节记忆并在后续相关话题中主动唤醒。
                </div>
              ) : (
                <div className="space-y-2">
                  {loadDynamicMemories(characterId).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.topic_keywords.map((kw, ki) => (
                            <span
                              key={ki}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-emerald-400 font-medium shrink-0 ml-1">
                          {EMOTION_CN[m.emotion_type] || m.emotion_type} Lv.{m.intensity}
                        </span>
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed">{m.user_trigger_summary}</p>
                      <p className="text-[10px] text-white/40">{formatTimeAgo(m.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-[hsl(28_85%_62%/0.2)] flex items-center justify-center text-xs font-semibold text-[hsl(28_85%_62%)]">
              {characterName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate text-white">{characterName}</div>
              <div className="text-xs text-white/40">角色扮演中</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
