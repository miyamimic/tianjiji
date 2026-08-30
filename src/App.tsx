import { useState, useRef, useEffect, useCallback } from 'react';
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
import { loadCurrentTheme, THEME_PRESETS, loadGrainIntensity } from '@/lib/themeSystem';
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

  const [currentThemeId, setCurrentThemeId] = useState(() => loadCurrentTheme());

  useEffect(() => {
    const handleLlmConfigSaved = (e: Event) => {
      const customEvt = e as CustomEvent<LlmConfig>;
      if (customEvt.detail) {
        setLlmConfig(customEvt.detail);
      } else {
        setLlmConfig(loadLlmConfig());
      }
    };
    window.addEventListener('rp_engine_llm_config_saved', handleLlmConfigSaved);
    return () => window.removeEventListener('rp_engine_llm_config_saved', handleLlmConfigSaved);
  }, []);

  const [stickerToast, setStickerToast] = useState<{
    by: 'user' | 'ai';
    message: string;
    stickerUrl?: string;
  } | null>(null);

  useEffect(() => {
    const handleThemeChanged = () => {
      setCurrentThemeId(loadCurrentTheme());
    };
    window.addEventListener('tianjiji_theme_changed', handleThemeChanged);
    window.addEventListener('tianjiji_theme_elements_changed', handleThemeChanged);
    return () => {
      window.removeEventListener('tianjiji_theme_changed', handleThemeChanged);
      window.removeEventListener('tianjiji_theme_elements_changed', handleThemeChanged);
    };
  }, []);

  useEffect(() => {
    const handleStickerStolen = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail) {
        setStickerToast({
          by: customEvt.detail.by,
          message: customEvt.detail.message,
          stickerUrl: customEvt.detail.stickerUrl,
        });
        setTimeout(() => setStickerToast(null), 3500);
      }
    };
    window.addEventListener('sticker_stolen_event', handleStickerStolen);
    return () => window.removeEventListener('sticker_stolen_event', handleStickerStolen);
  }, []);

  // Listen to game invites
  useEffect(() => {
    const unsub = subscribeGameInvite((invite) => {
      if (invite) {
        setActiveInviteModal(invite);
      }
    });
    return unsub;
  }, []);

  // Inject user-custom CSS on startup
  useEffect(() => {
    applyCustomCss(loadCustomCss());
    document.documentElement.style.setProperty('--grain-opacity', String(loadGrainIntensity()));
  }, []);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const isPort = isPortraitViewport(window.innerWidth, window.innerHeight);
      setPortrait(isPort);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const messages = engine.getMessages();

  // Centralized message focus states: activate 1 bubble
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [lockedMessageId, setLockedMessageId] = useState<string | null>(null);

  const activeLockedRef = useRef<{ active: string | null; locked: string | null }>({
    active: null,
    locked: null,
  });
  activeLockedRef.current = { active: activeMessageId, locked: lockedMessageId };

  // Calculate the single message closest to the visual vertical center of the chat viewport
  const calculateActiveMessages = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const currentLocked = activeLockedRef.current.locked;

    // In locked mode: check if the locked message is still inside the viewport
    if (currentLocked) {
      const lockedElem = container.querySelector<HTMLElement>(`[data-msg-id="${currentLocked}"]`);
      if (lockedElem) {
        const containerRect = container.getBoundingClientRect();
        const elemRect = lockedElem.getBoundingClientRect();
        // Exit lock if the locked bubble completely scrolls out of the visible viewport
        const isCompletelyOutOfView =
          elemRect.bottom <= containerRect.top || elemRect.top >= containerRect.bottom;
        if (!isCompletelyOutOfView) {
          // Locked bubble remains in viewport, preserve locked focus
          return;
        }
      }
      // If locked message left the viewport or was deleted, release lock and restore auto center selection
      setLockedMessageId(null);
      activeLockedRef.current.locked = null;
    }

    // Auto-selection: find the single bubble closest to viewport vertical center
    const containerRect = container.getBoundingClientRect();
    if (containerRect.height === 0) return;
    const viewportCenterY = containerRect.top + containerRect.height / 2;

    const msgElements = container.querySelectorAll<HTMLElement>('[data-msg-id]');
    if (msgElements.length === 0) {
      setActiveMessageId(null);
      return;
    }

    const visibleList: { id: string; offset: number; ratio: number }[] = [];

    msgElements.forEach((el) => {
      const id = el.getAttribute('data-msg-id');
      if (!id) return;
      const rect = el.getBoundingClientRect();

      // Check if intersecting visible viewport
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      if (visibleHeight <= 0) return; // not in viewport

      const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;
      const bubbleCenterY = rect.top + rect.height / 2;
      const offset = Math.abs(bubbleCenterY - viewportCenterY);

      visibleList.push({ id, offset, ratio });
    });

    if (visibleList.length === 0) {
      setActiveMessageId(null);
      return;
    }

    // Sort by distance to center ascending, then by ratio descending
    visibleList.sort((a, b) => {
      const diff = Math.abs(a.offset - b.offset);
      if (diff < 8) {
        return b.ratio - a.ratio;
      }
      return a.offset - b.offset;
    });

    const bestId = visibleList[0]?.id || null;
    setActiveMessageId((prev) => (prev !== bestId ? bestId : prev));
  }, []);

  // Throttled scroll, resize, and message change listener using requestAnimationFrame
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || scene !== 'chat') return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        calculateActiveMessages();
        rafId = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    // Initial check
    const timer = setTimeout(handleScroll, 80);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [scene, calculateActiveMessages, messages.length]);

  const handleToggleLockMessage = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setLockedMessageId((prev) => (prev === id ? null : id));
  }, []);

  const handleChatContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicked empty background area outside any message bubble, exit lock mode
    const target = e.target as HTMLElement;
    if (!target.closest('[data-msg-id]')) {
      setLockedMessageId(null);
    }
  };

  // Safe auto scroll: only scroll when new messages arrive (messages.length increases) or on send
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom on mount/enter chat scene
  useEffect(() => {
    if (scene === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scene]);

  const character = engine.getCharacter();
  const llmReady = isLlmConfigured(llmConfig);

  const handleSend = async (text: string) => {
    setIsLoading(true);
    try {
      await engine.sendMessage(text, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('发送消息推演失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerReply = async (messageId?: string) => {
    setIsLoading(true);
    try {
      await engine.triggerCharacterReply(messageId, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('主动触发回复推演失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReroll = async (messageId: string, feedback?: { score?: number; reason?: string }) => {
    setIsLoading(true);
    try {
      await engine.rerollMessage(messageId, feedback, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('重roll生成失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateWithPreset = async (messageId: string, presetId: string) => {
    setIsLoading(true);
    try {
      await engine.regenerateWithPromptPreset(messageId, presetId, llmReady ? llmConfig : undefined);
    } catch (e) {
      console.error('换预设重生成失败', e);
    } finally {
      setIsLoading(false);
    }
  };

  const bgSrc = scene === 'welcome' ? '/welcome_bg.png' : (customChatBg || '/chat_bg.png');
  const bg = BG_SIZE[scene];
  const pos = BG_OBJECT_POS[scene];
  const stageRatio = bg;

  return (
    <div
      ref={wrapRef}
      className="relative w-full flex items-center justify-center overflow-hidden bg-[#fdf6f7] french-fine-grain"
      style={{ height: '100vh', width: '100vw' }}
    >
      {/* 手机端实景 Live 壁纸加载动画 */}
      {!leafDone && portrait && (
        <LeafLoader onComplete={() => setLeafDone(true)} />
      )}

      {/* ================ STAGE ================ */}
      <div
        className="relative overflow-hidden shadow-2xl"
        style={
          portrait
            ? {
                width: '100vw',
                height: '100vh',
                aspectRatio: undefined,
              }
            : {
                aspectRatio: `${stageRatio.w} / ${stageRatio.h}`,
                width: `min(100vw, calc(100vh * ${stageRatio.w} / ${stageRatio.h}))`,
                height: `min(100vh, calc(100vw * ${stageRatio.h} / ${stageRatio.w}))`,
              }
        }
      >
        {/* LAYER 1: BACKGROUND IMAGE */}
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

        {/* LAYER 3: INTERACTION HOTSPOTS */}
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

        {/* Wind Chime Pulldown Control Panel */}
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

        {/* CHAT 场景消息区 + 输入框 */}
        {scene === 'chat' && (
          <div
            className={`pointer-events-none absolute inset-0 z-20 flex flex-col pt-14 transition-[padding] duration-300 ${(!portrait && sidebarOpen) ? 'pr-80' : 'pr-0'}`}
          >
            <div
              ref={scrollRef}
              onClick={handleChatContainerClick}
              className="pointer-events-auto flex-1 overflow-y-auto chat-scroll"
            >
              <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 min-h-full">
                {messages.map((msg) => {
                  const shouldRenderControls = lockedMessageId
                    ? msg.id === lockedMessageId
                    : msg.id === activeMessageId;
                  return (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      characterName={character.name}
                      characterId={character.character_id}
                      isControlsVisible={shouldRenderControls}
                      onToggleLock={handleToggleLockMessage}
                      onRollback={(id) => engine.rollbackToMessage(id)}
                      onEdit={(id, newContent) => engine.editMessage(id, newContent)}
                      onTriggerReply={handleTriggerReply}
                      onReroll={handleReroll}
                      onRegenerateWithPreset={handleRegenerateWithPreset}
                      onSwitchVersion={(id, index) => engine.switchMessageVersion(id, index)}
                    />
                  );
                })}

                {isLoading && (
                  <div className="flex items-start gap-2.5 px-2">
                    <div className="size-8 shrink-0 rounded-full bg-gradient-to-br from-[#fcd3de] to-[#f7a8be] flex items-center justify-center text-xs font-serif font-bold text-[#8a3854] ring-2 ring-white shadow-md border border-[#f2d0d9]">
                      {character.name.charAt(0)}
                    </div>
                    <TypingIndicator />
                  </div>
                )}
              </div>
            </div>

            <div className="pointer-events-auto">
              <ChatInput
                onSend={handleSend}
                onRequestReply={handleTriggerReply}
                disabled={isLoading}
                llmReady={llmReady}
              />
            </div>
          </div>
        )}

        {/* 侧边栏 */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          characterId={character.character_id}
          emotion={engine.getEmotion()}
          previousEmotion={engine.getPreviousEmotion()}
          emotionConfirmed={engine.getEmotionConfirmed()}
          onConfirmEmotion={() => engine.confirmEmotion()}
          threads={engine.getBackgroundThreads()}
          anchors={engine.getTriggeredAnchors()}
          intent={engine.getLastIntent()}
          fallback={engine.getLastFallback()}
          characterName={character.name}
          overlayMode={portrait}
        />
      </div>

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
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border border-[#f2d0d9] bg-white/95 text-[#4a3e3d] cursor-pointer hover:scale-105 transition active:scale-95 font-serif"
          >
            {stickerToast.stickerUrl && (
              <div className="size-8 rounded-xl overflow-hidden bg-[#fff0f3] border border-[#f2d0d9] shrink-0">
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
              <p className="text-[10px] text-[#e07a93] underline">点击前往【游戏大厅·表情专区】查看 ➔</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
