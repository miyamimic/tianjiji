import { useState, useRef, useEffect } from 'react';
import SceneCanvas, { type Scene } from '@/components/SceneCanvas';
import HotspotLayer from '@/components/HotspotLayer';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import ChatInput from '@/components/ChatInput';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import SettingsModal from '@/components/SettingsModal';
import NumbedNoticeModal from '@/components/NumbedNoticeModal';
import LeafLoader from '@/components/LeafLoader';
import WindChime, { type AppId } from '@/components/WindChime';
import GameInviteModal from '@/components/GameInviteModal';
import OutboxStatusBar from '@/components/OutboxStatusBar';
import { useEngine } from '@/hooks/useEngine';
import { loadLlmConfig, isLlmConfigured, type LlmConfig } from '@/lib/llm';
import { loadCustomCss, applyCustomCss, loadCustomChatBg } from '@/lib/customStore';
import { 
  subscribeGameInvite, 
  acceptGameInvite, 
  rejectGameInvite, 
  type GameInvitation 
} from '@/lib/gameStore';
import { BG_OBJECT_POS, BG_SIZE, isPortraitViewport } from '@/lib/stageFit';

export default function App() {
  const engine = useEngine();
  const [portrait, setPortrait] = useState<boolean>(() => isPortraitViewport(window.innerWidth, window.innerHeight));
  // 手机端直接进入 chat 场景，电脑端保留 welcome 场景
  const [scene, setScene] = useState<Scene>(() => isPortraitViewport(window.innerWidth, window.innerHeight) ? 'chat' : 'welcome');
  // 手机端展示高精度像素绿叶飘落加载动画，电脑端直接进入
  const [leafDone, setLeafDone] = useState<boolean>(() => !isPortraitViewport(window.innerWidth, window.innerHeight));
  const [customChatBg, setCustomChatBg] = useState<string>(() => loadCustomChatBg() || '/chat_bg.png');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [numbedModalInfo, setNumbedModalInfo] = useState<{
    characterName: string;
    numbedKeys: string[];
    isSensitized: boolean;
  } | null>(null);
  const [activeInviteModal, setActiveInviteModal] = useState<GameInvitation | null>(null);
  const [forceOpenApp, setForceOpenApp] = useState<AppId | null>(null);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(loadLlmConfig());
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [stickerToast, setStickerToast] = useState<{
    by: 'user' | 'ai';
    message: string;
    stickerUrl?: string;
  } | null>(null);

  useEffect(() => {
    const handleStickerStolen = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail) {
        setStickerToast({
          by: customEvt.detail.by,
          message: customEvt.detail.message,
          stickerUrl: customEvt.detail.stickerUrl,
        });
        setTimeout(() => {
          setStickerToast(null);
        }, 3600);
      }
    };
    window.addEventListener('rp_sticker_stolen_event', handleStickerStolen);
    return () => {
      window.removeEventListener('rp_sticker_stolen_event', handleStickerStolen);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeGameInvite((invite) => {
      if (invite && invite.status === 'pending') {
        setActiveInviteModal(invite);
      } else {
        setActiveInviteModal(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const css = loadCustomCss();
    applyCustomCss(css);
    const bg = loadCustomChatBg();
    if (bg) {
      setCustomChatBg(bg);
    }
  }, []);

  // 检测横屏 / 竖屏（用视口宽高比，不是设备方向，避免依赖 device orientation API）
  useEffect(() => {
    const recompute = () => {
      const isPort = isPortraitViewport(window.innerWidth, window.innerHeight);
      setPortrait(isPort);
      // 如果处于手机竖屏模式，确保场景为 chat 界面
      if (isPort) {
        setScene('chat');
      }
    };
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

  const handleSend = (text: string) => {
    try {
      engine.addUserMessageOnly(text);
    } catch (e) {
      console.error('发送失败', e);
    }
  };

  const handleRequestReply = async (messageId?: string) => {
    setIsLoading(true);
    try {
      const res = await engine.triggerCharacterReply(messageId, llmReady ? llmConfig : undefined);
      if (res && res.numbedKeys && res.numbedKeys.length > 0) {
        setNumbedModalInfo({
          characterName: res.characterName || character.name,
          numbedKeys: res.numbedKeys,
          isSensitized: (res.sensitizedKeys && res.sensitizedKeys.length > 0) || false,
        });
      }
    } catch (e) {
      console.error('回复生成失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReroll = async (messageId: string, feedback?: { score?: number; reason?: string }) => {
    setIsLoading(true);
    try {
      const res = await engine.rerollMessage(messageId, feedback, llmReady ? llmConfig : undefined);
      if (res && res.numbedKeys && res.numbedKeys.length > 0) {
        setNumbedModalInfo({
          characterName: res.characterName || character.name,
          numbedKeys: res.numbedKeys,
          isSensitized: (res.sensitizedKeys && res.sensitizedKeys.length > 0) || false,
        });
      }
    } catch (e) {
      console.error('重roll生成失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const bgSrc = scene === 'welcome' ? '/welcome_bg.png' : (customChatBg || '/chat_bg.png');
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
      {/* 手机端高精度像素绿叶飘落加载动画 */}
      {!leafDone && portrait && (
        <LeafLoader onComplete={() => setLeafDone(true)} />
      )}

      {/* ================ STAGE ================ */}
      <div
        className="relative overflow-hidden shadow-2xl"
        style={
          portrait
            // ---------- 竖屏（手机端）：铺满视口，背景图 cover + 左侧保留裁切 ----------
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
              竖屏：object-cover + 自定义 object-position (chat x: 0 保证左侧主体人物完整可见) */}
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
          portrait={portrait}
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
            portrait={portrait}
          />
        </div>

        {/* 202 Async Outbox & iOS Background Keep-Alive Status Island */}
        <OutboxStatusBar />

        {/* Wind Chime Pulldown Control Panel (Anchored top-left, left of avatar) */}
        <WindChime
          currentBg={customChatBg}
          onBgChange={(newBg) => setCustomChatBg(newBg)}
          currentCharacterId={character.character_id}
          characterName={character.name}
          character={character}
          currentEmotionSnapshot={engine.getEmotion()}
          onEngineReload={() => engine.reload()}
          onConfigChange={setLlmConfig}
          forceOpenApp={forceOpenApp}
          onClearForceOpenApp={() => setForceOpenApp(null)}
          onGameFinished={(summary, rawRecord, applyDelta, customDelta) =>
            engine.handleGameFinished(summary, rawRecord, applyDelta, customDelta)
          }
          onApplyGameEmotionDelta={(delta, summary) =>
            engine.applyGameEmotionSettlement(delta, summary)
          }
          onInGameChat={(userInput, matchContext, chatHistory) =>
            engine.sendInGameChat(userInput, character.character_id, matchContext, llmConfig, chatHistory)
          }
          onRejectGameInvite={(invite) => {
            rejectGameInvite(invite.id);
            engine.handleUserRejectGameInvite(invite.characterId, invite.characterName);
          }}
        />

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
                      characterId={character.character_id}
                      onRollback={(id) => engine.rollbackToMessage(id)}
                      onEdit={(id, text) => engine.editMessage(id, text)}
                      onTriggerReply={handleRequestReply}
                      onReroll={handleReroll}
                    />
                  </div>
                ))}
                {isLoading && <TypingIndicator characterName={character.name} />}
              </div>
            </div>

            <div className="pointer-events-auto">
              <ChatInput
                onSend={handleSend}
                onRequestReply={() => handleRequestReply()}
                disabled={isLoading}
                llmReady={llmReady}
              />
            </div>
          </div>
        )}

        {/* Sidebar
              - 手机竖屏：强制用 overlay 模式（absolute 盖在舞台上，有黑幕半透明遮罩）
              - 横屏：保留默认布局（在舞台右侧独立列，80w 宽）*/}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          characterId={character.character_id}
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
        currentCharacterId={character.character_id}
        onEngineReload={() => engine.reload()}
      />

      <NumbedNoticeModal
        isOpen={!!numbedModalInfo}
        onClose={() => setNumbedModalInfo(null)}
        characterName={numbedModalInfo?.characterName || character.name}
        numbedKeys={numbedModalInfo?.numbedKeys || []}
        isSensitized={numbedModalInfo?.isSensitized}
      />

      {/* Character Game Invitation Pop-up Modal */}
      <GameInviteModal
        invite={activeInviteModal}
        onStart={(invite) => {
          acceptGameInvite(invite.id);
          setActiveInviteModal(null);
          setForceOpenApp('game_lobby');
        }}
        onReject={(invite) => {
          rejectGameInvite(invite.id);
          engine.handleUserRejectGameInvite(invite.characterId, invite.characterName);
          setActiveInviteModal(null);
        }}
        onLater={(_invite) => {
          setActiveInviteModal(null);
        }}
      />

      {/* Floating Sticker Stolen Toast */}
      {stickerToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div
            onClick={() => setForceOpenApp('game_lobby')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border cursor-pointer hover:scale-105 transition active:scale-95 ${
              stickerToast.by === 'ai'
                ? 'bg-purple-950/90 border-purple-400/50 text-purple-100 shadow-purple-900/40'
                : 'bg-amber-950/90 border-amber-400/50 text-amber-100 shadow-amber-900/40'
            }`}
          >
            {stickerToast.stickerUrl && (
              <div className="size-8 rounded-xl overflow-hidden bg-black/50 border border-white/20 shrink-0">
                <img
                  src={stickerToast.stickerUrl}
                  alt="表情包"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="text-xs font-medium space-y-0.5">
              <p>{stickerToast.message}</p>
              <p className="text-[10px] opacity-70 underline">点击前往【游戏大厅·表情专区】查看详情 ➔</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

