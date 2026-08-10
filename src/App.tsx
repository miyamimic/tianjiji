import { useState, useRef, useEffect } from 'react';
import SceneCanvas, { type Scene } from '@/components/SceneCanvas';
import HotspotLayer from '@/components/HotspotLayer';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import ChatInput from '@/components/ChatInput';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import SettingsModal from '@/components/SettingsModal';
import { useEngine } from '@/hooks/useEngine';
import { loadLlmConfig, isLlmConfigured, type LlmConfig } from '@/lib/llm';
import { loadCustomCss, applyCustomCss } from '@/lib/customStore';
import { BG_OBJECT_POS, BG_SIZE, isPortraitViewport } from '@/lib/stageFit';

export default function App() {
  const engine = useEngine();
  const [scene, setScene] = useState<Scene>('welcome');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(loadLlmConfig());
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState<boolean>(() => isPortraitViewport(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const css = loadCustomCss();
    applyCustomCss(css);
  }, []);

  // 检测横屏 / 竖屏（用视口宽高比，不是设备方向，避免依赖 device orientation API）
  useEffect(() => {
    const recompute = () => setPortrait(isPortraitViewport(window.innerWidth, window.innerHeight));
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('orientationchange', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('orientationchange', recompute);
    };
  }, []);

  const character = engine.getCharacter();
  const emotion = engine.getEmotion();
  const previousEmotion = engine.getPreviousEmotion();
  const emotionConfirmed = engine.getEmotionConfirmed();
  const threads = engine.getBackgroundThreads();
  const anchors = engine.getTriggeredAnchors();
  const messages = engine.getMessages();
  const intent = engine.getLastIntent();
  const fallback = engine.getLastFallback();

  const llmReady = isLlmConfigured(llmConfig);

  useEffect(() => {
    if (scrollRef.current && scene === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, scene]);

  if (!engine.ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="text-white/40 animate-pulse">正在进入房间...</div>
      </div>
    );
  }

  const handleSend = async (text: string) => {
    setIsLoading(true);
    try {
      await engine.sendMessage(text, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('发送失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerReply = async (messageId: string) => {
    setIsLoading(true);
    try {
      await engine.triggerCharacterReply(messageId, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('追问生成失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const bgSrc = scene === 'welcome' ? '/welcome_bg.png' : '/chat_bg.png';
  const bg = BG_SIZE[scene];            // 原始图像素尺寸
  const pos = BG_OBJECT_POS[scene];     // 竖屏时的 object-position（横屏无效）
  // 横屏时：舞台严格按图片比例居中，图片 1:1 不裁切
  // 竖屏时：舞台铺满视口（无黑边），背景图用 cover + 偏移保证主体/光点可见
  const stageRatio = bg;

  return (
    <div
      ref={wrapRef}
      className="relative w-full flex items-center justify-center overflow-hidden bg-black"
      style={{ height: '100vh', width: '100vw' }}
    >
      {/* ================ STAGE ================ */}
      <div
        className="relative overflow-hidden shadow-2xl"
        style={
          portrait
            // ---------- 竖屏（手机端）：铺满视口，背景图 cover + 自定义 object-position ----------
            ? {
                width: '100vw',
                height: '100vh',
                aspectRatio: undefined,
              }
            // ---------- 横屏（桌面 / 横屏手机）：按原图像素比例居中，图片绝不裁切 ----------
            : {
                aspectRatio: `${stageRatio.w} / ${stageRatio.h}`,
                width: `min(100vw, calc(100vh * ${stageRatio.w} / ${stageRatio.h}))`,
                height: `min(100vh, calc(100vw * ${stageRatio.h} / ${stageRatio.w}))`,
              }
        }
      >
        {/* LAYER 1: BACKGROUND IMAGE
              横屏：舞台比例 = 图片比例，object-cover ≡ object-contain，不裁切
              竖屏：object-cover + 自定义 object-position，配合 Hotspot/Canvas 内部同样的 cover-fit 公式
                    → 光点/钟表永远与背景图标记对齐，主体人物不被切掉关键 */}
        <img
          key={bgSrc}
          src={bgSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full animate-in fade-in-0 duration-300"
          style={{
            objectFit: 'cover',
            objectPosition: portrait ? `${pos.x}% ${pos.y}%` : '50% 50%',
          }}
        />

        {/* LAYER 2: CANVAS OVERLAY — 钟表指针 + 呼吸光点 */}
        <SceneCanvas scene={scene} />

        {/* LAYER 3: INTERACTION HOTSPOTS — z-40 需高于 chat 消息层(z-20) */}
        <HotspotLayer
          scene={scene}
          onEnterChat={() => setScene('chat')}
          onLeaveChat={() => setScene('welcome')}
        />

        {/* UI LAYER: Top bar */}
        <div className="absolute inset-x-0 top-0 z-30">
          <TopBar
            currentCharacter={character}
            availableCharacters={engine.getCharactersList()}
            onSwitchCharacter={(id) => engine.switchCharacter(id)}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            onClearHistory={() => engine.clearHistory()}
            onResetEmotion={() => engine.resetEmotion()}
            onOpenSettings={() => setSettingsOpen(true)}
            llmReady={llmReady}
          />
        </div>

        {/* CHAT 场景才显示的消息区 + 输入框
              - 手机竖屏：侧边栏改为 overlay（absolute 盖在主内容上），不再 pr-80 push 主内容
              - 横屏：保留 pr-80（把主内容左推，避免与侧边栏重叠） */}
        {scene === 'chat' && (
          <div
            className={`pointer-events-none absolute inset-0 z-20 flex flex-col pt-14 transition-[padding] duration-300 ${(!portrait && sidebarOpen) ? 'pr-80' : 'pr-0'}`}
          >
            <div ref={scrollRef} className="pointer-events-auto flex-1 overflow-y-auto chat-scroll">
              <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3">
                {messages.length === 0 && (
                  <div className="px-3 py-8 sm:py-12 text-center">
                    <div className="mx-auto mb-3 sm:mb-4 size-14 sm:size-16 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-xl sm:text-2xl font-bold text-[hsl(28_30%_10%)] shadow-xl shadow-[hsl(28_85%_62%/0.3)]">
                      {character.name.charAt(0)}
                    </div>
                    <h1 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2 drop-shadow-lg">
                      正在与 {character.name} 对话
                    </h1>
                    <p className="text-xs sm:text-sm text-white/50 max-w-md mx-auto leading-relaxed mb-4 sm:mb-6 drop-shadow">
                      {llmReady
                        ? '已连接 LLM，角色回复由 AI 生成'
                        : '本地演示模式 · 在设置中配置 LLM 接口以启用 AI 回复'}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['我真的破防了emo', '不行，我做不到', '想你', '你胸肌练得不错'].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className="rounded-full border border-white/15 bg-black/30 px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-white/60 backdrop-blur-sm hover:border-[hsl(28_85%_62%/0.4)] hover:text-white hover:bg-black/50 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'msg-enter-user' : 'msg-enter-char'}>
                    <ChatBubble
                      message={m}
                      characterName={m.role === 'character' ? character.name : undefined}
                      onRollback={(id) => engine.rollbackToMessage(id)}
                      onEdit={(id, text) => engine.editMessage(id, text)}
                      onTriggerReply={handleTriggerReply}
                      onAddUserMsgOnly={(id, text) => engine.addUserMessageOnly(text, id)}
                    />
                  </div>
                ))}
                {isLoading && <TypingIndicator characterName={character.name} />}
              </div>
            </div>

            <div className="pointer-events-auto">
              <ChatInput onSend={handleSend} disabled={isLoading} llmReady={llmReady} />
            </div>
          </div>
        )}

        {/* Sidebar
              - 手机竖屏：强制用 overlay 模式（absolute 盖在舞台上，有黑幕半透明遮罩）
              - 横屏：保留默认布局（在舞台右侧独立列，80w 宽）*/}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          emotion={emotion}
          previousEmotion={previousEmotion}
          emotionConfirmed={emotionConfirmed}
          onConfirmEmotion={() => engine.confirmEmotion()}
          threads={threads}
          anchors={anchors}
          intent={intent}
          fallback={fallback}
          characterName={character.name}
          overlayMode={portrait}
        />
      </div>

      {/* 手机竖屏侧边栏打开时：舞台盖一层暗幕（侧栏 z-50 时才有用，这里仅视觉提示；Sidebar 自己带 backdrop）*/}
      {portrait && sidebarOpen && (
        <div
          className="pointer-events-none absolute inset-0 z-40 bg-black/40"
          aria-hidden="true"
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onConfigChange={setLlmConfig}
        currentCharacterId={character.character_id}
        onEngineReload={() => engine.reload()}
      />
    </div>
  );
}
