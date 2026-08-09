import { useState, useRef, useEffect } from 'react';
import ParticleBackground from '@/components/ParticleBackground';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import ChatInput from '@/components/ChatInput';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import SettingsModal from '@/components/SettingsModal';
import { MOCK_CHARACTERS } from '@/data/characters';
import { useEngine } from '@/hooks/useEngine';
import { loadLlmConfig, isLlmConfigured, type LlmConfig } from '@/lib/llm';
import { loadCustomCss, applyCustomCss } from '@/lib/customStore';


export default function App() {
  const engine = useEngine();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(loadLlmConfig());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load and inject of custom user CSS styles
    const css = loadCustomCss();
    applyCustomCss(css);
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!engine.ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[hsl(222_28%_9%)]">
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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[hsl(222_28%_9%)]">
      {/* Background image */}
      <img
        src="/welcome_bg.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover"
      />
      {/* Particle effects overlay (kept) */}
      <ParticleBackground />

      {/* Top bar - minimal, floating */}
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

      {/* Main content area - chat floats over the scene */}
      <div
        className={`relative z-10 flex h-full flex-col pt-14 transition-all duration-300 ${sidebarOpen ? 'pr-80' : 'pr-0'}`}
      >
        {/* Chat scroll area - takes most of the space, messages float over the scene */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto chat-scroll"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
            {messages.length === 0 && (
              <div className="px-4 py-12 text-center">
                <div className="mx-auto mb-4 size-16 rounded-full bg-gradient-to-br from-[hsl(28_85%_62%)] to-[hsl(28_85%_62%/0.6)] flex items-center justify-center text-2xl font-bold text-[hsl(28_30%_10%)] shadow-xl shadow-[hsl(28_85%_62%/0.3)]">
                  {character.name.charAt(0)}
                </div>
                <h1 className="text-xl font-semibold text-white mb-2 drop-shadow-lg">
                  正在与 {character.name} 对话
                </h1>
                <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed mb-6 drop-shadow">
                  {llmReady
                    ? '已连接 LLM，角色回复由 AI 生成'
                    : '本地演示模式 · 在设置中配置 LLM 接口以启用 AI 回复'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['我真的破防了emo', '不行，我做不到', '想你', '你胸肌练得不错'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-sm text-white/60 backdrop-blur-sm hover:border-[hsl(28_85%_62%/0.4)] hover:text-white hover:bg-black/50 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'msg-enter-user' : 'msg-enter-char'}
              >
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

        {/* Chat input - floating at bottom, semi-transparent */}
        <ChatInput onSend={handleSend} disabled={isLoading} llmReady={llmReady} />
      </div>

      {/* Sidebar - slides in from right */}
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
      />

      {/* Settings Modal */}
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
