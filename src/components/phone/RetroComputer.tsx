import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RetroComputer.css';
import PersonaApp from './PersonaApp';
import LlmApp from './LlmApp';
import DictionaryApp from './DictionaryApp';
import CssApp from './CssApp';
import GameLobbyApp, { type GameLobbySubApp } from './GameLobbyApp';
import DataBackupModal from '../DataBackupModal';
import { idbLoadRetroMailsReadState, idbSaveRetroMailsReadState } from '../../lib/idb';
import type { LlmConfig } from '../../lib/llm';
import type { EmotionVector, Character } from '../../data/types';
import type { GameInvitation } from '../../lib/gameStore';

interface RetroComputerProps {
  onClose: () => void;
  // System app props
  onBgChange: (newBg: string) => void;
  currentBg?: string;
  currentCharacterId?: string;
  characterName?: string;
  character?: Character;
  currentEmotionSnapshot?: EmotionVector;
  onEngineReload?: () => void;
  onConfigChange?: (config: LlmConfig) => void;
  forceOpenApp?: string | null;
  forceOpenSubApp?: GameLobbySubApp | null;
  onClearForceOpenApp?: () => void;
  onGameFinished?: (
    summary: string, 
    rawRecord: any, 
    applyEmotionDelta?: boolean, 
    customDelta?: Partial<EmotionVector>
  ) => void;
  onApplyGameEmotionDelta?: (delta: Partial<EmotionVector>, summary: string) => void;
  onInGameChat?: (
    userInput: string,
    matchContext: { moveCount: number; playerColor: 'B' | 'W'; currentTurn: 'B' | 'W' },
    chatHistory?: Array<{ sender: 'user' | 'character' | 'system'; text: string }>
  ) => Promise<{ reply: string; tactic: 'aggressive' | 'defensive' | 'gentle' | 'balanced' } | string>;
  onRejectGameInvite?: (invite: GameInvitation) => void;
  pendingInvite?: GameInvitation | null;
}

// Mail Data
interface MailItem {
  id: number;
  unread: boolean;
  subj: string;
  sender: string;
  date: string;
  body: string;
}

const INITIAL_MAILS: MailItem[] = [
  { 
    id: 1, 
    unread: true, 
    subj: "欢迎使用 CRT-OS!", 
    sender: "系统管理员", 
    date: "1998/10/24", 
    body: "你好，用户：\n欢迎使用全新的 CRT-OS 操作系统。\n请不要在处理数据时中断电源。\n随时可通过桌面图标访问系统工具与本地文件。" 
  },
  { 
    id: 2, 
    unread: true, 
    subj: "不知你在寻找什么...", 
    sender: "未知发件人", 
    date: "????/??/??", 
    body: "有些眼睛正在看着你。\n千万别回头。\n风铃的声音在空气中泛起涟漪……" 
  },
  { 
    id: 3, 
    unread: false, 
    subj: "磁盘清理已完成。", 
    sender: "SYSTEM", 
    date: "1998/10/20", 
    body: "自动清理已成功完成。\n释放空间：1.44 MB\n簇分配状态：良好。" 
  }
];

// File Data
interface FileItem {
  id: number;
  type: 'text' | 'image';
  name: string;
  icon: string;
  content?: string;
  url?: string;
  alt?: string;
}

const INITIAL_FILES: FileItem[] = [
  { 
    id: 1, 
    type: "text", 
    name: "日记本.TXT", 
    icon: "fa-file-lines", 
    content: "1998/10/25\n天气越来越冷了。\n后台数据库似乎有异常的波动……\n今天风铃摇晃了三次，不知是谁在思念。" 
  },
  { 
    id: 2, 
    type: "text", 
    name: "密码.DOC", 
    icon: "fa-file-word", 
    content: "系统重置密钥备忘：\nA区门禁：4892\n核心机房：[已加密]\n天机通信频段：77.4 MHz" 
  },
  { 
    id: 3, 
    type: "image", 
    name: "剪影.JPG", 
    icon: "fa-image", 
    url: "", 
    alt: "图片数据丢失" 
  }
];

// Student Directory Data
interface StudentItem {
  id: number;
  name: string;
  code: string;
  major: string;
  status: string;
  remarks: string;
}

const STUDENT_DB: StudentItem[] = [
  { id: 1, name: "Alexander, J.", code: "1995-042", major: "哲学系", status: "在读", remarks: "在图书馆自习室多次被目击。" },
  { id: 2, name: "Miller, S.", code: "1996-118", major: "计算机系", status: "休学", remarks: "因违规网络操作已被暂时停课。" },
  { id: 3, name: "Chen, W.", code: "1994-007", major: "物理系", status: "在读", remarks: "提前毕业论文撰写中，导师评价优异。" },
  { id: 4, name: "Doe, J.", code: "未知", major: "未知", status: "未注册", remarks: "档案已被系统管理员标记删除。" }
];

export interface DesktopAppMeta {
  id: string;
  name: string;
  fullName: string;
  icon: string;
  colorClass: string;
  isCore: boolean;
  desc: string;
}

export const DESKTOP_APPS_META: Record<string, DesktopAppMeta> = {
  mail: {
    id: 'mail',
    name: 'MAIL',
    fullName: '电子邮件 (MAIL)',
    icon: 'fa-solid fa-envelope',
    colorClass: 'text-blue-300',
    isCore: true,
    desc: '电子邮件客户端',
  },
  files: {
    id: 'files',
    name: 'FILES',
    fullName: '文件管理器 (FILES)',
    icon: 'fa-solid fa-folder-open',
    colorClass: 'text-amber-300',
    isCore: true,
    desc: '文件资源管理器',
  },
  web: {
    id: 'web',
    name: 'WEB',
    fullName: '万维网导航 (WEB)',
    icon: 'fa-solid fa-compass',
    colorClass: 'text-teal-300',
    isCore: true,
    desc: '万维网导航浏览器',
  },
  game: {
    id: 'game',
    name: 'GAME',
    fullName: '游戏大厅 (GAME)',
    icon: 'fa-solid fa-gamepad',
    colorClass: 'text-amber-300',
    isCore: true,
    desc: '游戏大厅 (单机像素跳跃/五子棋/捉鬼牌/抽卡)',
  },
  persona: {
    id: 'persona',
    name: 'PERSONA',
    fullName: '人设档案 (PERSONA)',
    icon: 'fa-solid fa-user-gear',
    colorClass: 'text-orange-300',
    isCore: false,
    desc: '人设与立绘管理',
  },
  css: {
    id: 'css',
    name: 'CSS_STYLE',
    fullName: '外观工坊 (CSS_STYLE)',
    icon: 'fa-solid fa-palette',
    colorClass: 'text-blue-300',
    isCore: false,
    desc: '外观与音效工坊 (视觉样式/壁纸背景/氛围白噪)',
  },
  llm: {
    id: 'llm',
    name: 'LLM_CONF',
    fullName: '模型算力 (LLM)',
    icon: 'fa-solid fa-microchip',
    colorClass: 'text-emerald-300',
    isCore: false,
    desc: '大语言模型接口与算力',
  },
  dictionary: {
    id: 'dictionary',
    name: 'DICTIONARY',
    fullName: '词典安全 (DICTIONARY)',
    icon: 'fa-solid fa-shield-halved',
    colorClass: 'text-purple-300',
    isCore: false,
    desc: '敏感词与激化词典',
  },
  backup: {
    id: 'backup',
    name: 'BACKUP',
    fullName: '数据备份 (BACKUP)',
    icon: 'fa-solid fa-database',
    colorClass: 'text-pink-300',
    isCore: false,
    desc: '分文件数据备份与恢复',
  },
};

export default function RetroComputer({
  onClose,
  onBgChange,
  currentBg,
  currentCharacterId,
  characterName,
  character,
  currentEmotionSnapshot,
  onEngineReload,
  onConfigChange,
  forceOpenApp,
  forceOpenSubApp,
  onClearForceOpenApp,
  onGameFinished,
  onApplyGameEmotionDelta,
  onInGameChat,
  onRejectGameInvite,
  pendingInvite,
}: RetroComputerProps) {
  // Power state
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isAnimatingPower, setIsAnimatingPower] = useState(false);
  const [powerAnimClass, setPowerAnimClass] = useState<'turn-on-anim' | 'turn-off-anim' | ''>('turn-on-anim');
  const [screenBrightness, setScreenBrightness] = useState<number>(1);

  // Active Windows: null = desktop, 'mail' | 'files' | 'web' | 'game' | system tool ids
  const [activeApp, setActiveApp] = useState<string | null>(forceOpenApp || null);

  // Desktop Apps state: Default strictly mail, files, web, game
  const [desktopApps, setDesktopApps] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('retro_desktop_apps_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return ['mail', 'files', 'web', 'game'];
  });

  useEffect(() => {
    try {
      localStorage.setItem('retro_desktop_apps_v2', JSON.stringify(desktopApps));
    } catch (e) {}
  }, [desktopApps]);

  // Desktop edit / delete mode & toast notice
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [desktopNotice, setDesktopNotice] = useState<string | null>(null);

  const showDesktopNotice = (msg: string) => {
    setDesktopNotice(msg);
    setTimeout(() => setDesktopNotice(null), 2500);
  };

  const addAppToDesktop = (appId: string) => {
    if (!desktopApps.includes(appId)) {
      setDesktopApps(prev => [...prev, appId]);
      showDesktopNotice(`快捷方式 [${DESKTOP_APPS_META[appId]?.name || appId}] 已添加到桌面`);
    }
  };

  const removeAppFromDesktop = (appId: string) => {
    setDesktopApps(prev => prev.filter(id => id !== appId));
    setIsEditMode(false);
    showDesktopNotice(`已从桌面移除 [${DESKTOP_APPS_META[appId]?.name || appId}]`);
  };

  // Auto-dismiss edit mode timer: if no deletion occurs, all red crosses automatically disappear
  const editModeAutoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isEditMode) {
      if (editModeAutoDismissTimerRef.current) clearTimeout(editModeAutoDismissTimerRef.current);
      // Automatically dismiss all red crosses after 5 seconds if user does not delete
      editModeAutoDismissTimerRef.current = setTimeout(() => {
        setIsEditMode(false);
      }, 5000);
    } else {
      if (editModeAutoDismissTimerRef.current) {
        clearTimeout(editModeAutoDismissTimerRef.current);
        editModeAutoDismissTimerRef.current = null;
      }
    }
    return () => {
      if (editModeAutoDismissTimerRef.current) {
        clearTimeout(editModeAutoDismissTimerRef.current);
      }
    };
  }, [isEditMode]);

  // iOS-compatible Touch & Pointer Drag and Drop State
  const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isOverDesktop, setIsOverDesktop] = useState<boolean>(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number; appId: string } | null>(null);
  const isDraggingActiveRef = useRef<boolean>(false);

  const handleItemTouchStart = (appId: string, clientX: number, clientY: number) => {
    touchStartPosRef.current = { x: clientX, y: clientY, appId };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isDraggingActiveRef.current = true;
      setDraggingAppId(appId);
      setDragPosition({ x: clientX, y: clientY });
      setIsOverDesktop(true);
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch (_) {}
      }
    }, 320);
  };

  // Snappy, reliable long-press on desktop icons to enter delete/edit mode
  const desktopIconPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopIconTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isEditModeJustActivatedRef = useRef<boolean>(false);
  const isTouchInteractionRef = useRef<boolean>(false);

  const startDesktopIconLongPress = (clientX: number, clientY: number) => {
    desktopIconTouchStartPosRef.current = { x: clientX, y: clientY };
    if (desktopIconPressTimerRef.current) clearTimeout(desktopIconPressTimerRef.current);

    desktopIconPressTimerRef.current = setTimeout(() => {
      setIsEditMode(true);
      isEditModeJustActivatedRef.current = true;
      // Shield against synthetic release clicks for 700ms so releasing finger never dismisses edit mode!
      setTimeout(() => {
        isEditModeJustActivatedRef.current = false;
      }, 700);

      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }

      showDesktopNotice('已进入管理模式: 点击红叉 [×] 可从桌面删除图标');
    }, 300);
  };

  const cancelDesktopIconLongPress = () => {
    if (desktopIconPressTimerRef.current) {
      clearTimeout(desktopIconPressTimerRef.current);
      desktopIconPressTimerRef.current = null;
    }
    desktopIconTouchStartPosRef.current = null;
  };

  // Global listeners for iOS touch and pointer dragging
  useEffect(() => {
    const handleMove = (e: TouchEvent | PointerEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as PointerEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as PointerEvent).clientY;

      if (touchStartPosRef.current && !isDraggingActiveRef.current) {
        const dist = Math.hypot(clientX - touchStartPosRef.current.x, clientY - touchStartPosRef.current.y);
        if (dist > 8) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }

      // If finger moves significantly on desktop icon, cancel long-press (allow 15px micro-jitter)
      if (desktopIconTouchStartPosRef.current && !isEditMode) {
        const dist = Math.hypot(clientX - desktopIconTouchStartPosRef.current.x, clientY - desktopIconTouchStartPosRef.current.y);
        if (dist > 15) {
          cancelDesktopIconLongPress();
        }
      }

      if (isDraggingActiveRef.current) {
        if (e.cancelable) e.preventDefault();
        setDragPosition({ x: clientX, y: clientY });

        const desktopEl = document.getElementById('desktop-icons-area') || document.getElementById('main-screen');
        if (desktopEl) {
          const rect = desktopEl.getBoundingClientRect();
          const over = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
          setIsOverDesktop(over);
        }
      }
    };

    const handleUp = (e: TouchEvent | PointerEvent) => {
      cancelDesktopIconLongPress();

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (isDraggingActiveRef.current && touchStartPosRef.current) {
        const appId = touchStartPosRef.current.appId;
        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as PointerEvent).clientX;
        const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as PointerEvent).clientY;

        const desktopEl = document.getElementById('desktop-icons-area') || document.getElementById('main-screen');
        let dropped = false;
        if (desktopEl) {
          const rect = desktopEl.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            dropped = true;
          }
        }

        if (dropped && appId) {
          addAppToDesktop(appId);
          setIsStartMenuOpen(false);
          setIsEditMode(false);
        }

        isDraggingActiveRef.current = false;
        setDraggingAppId(null);
        setIsOverDesktop(false);
      }

      touchStartPosRef.current = null;
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [desktopApps]);

  // System bar & OS state
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toTimeString().slice(0, 5));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mail state with persistent read status via IndexedDB
  const [mails, setMails] = useState<MailItem[]>(INITIAL_MAILS);
  const [readingMailId, setReadingMailId] = useState<number | null>(null);

  // Load persistent mail read status from IndexedDB on mount
  useEffect(() => {
    let active = true;
    idbLoadRetroMailsReadState().then(readIds => {
      if (!active || !readIds || readIds.length === 0) return;
      const readSet = new Set<number>(readIds);
      setMails(prev =>
        prev.map(m => ({
          ...m,
          unread: readSet.has(m.id) ? false : m.unread,
        }))
      );
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Files state
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);

  // Web state
  const [webPage, setWebPage] = useState<'directory' | 'detail'>('directory');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  // Initial power-on animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setPowerAnimClass('');
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  // Handle forceOpenApp prop changes
  useEffect(() => {
    if (forceOpenApp) {
      setActiveApp(forceOpenApp);
    }
  }, [forceOpenApp]);

  // Power Button Toggle
  const handleTogglePower = () => {
    if (isAnimatingPower) return;
    setIsAnimatingPower(true);

    if (isPowerOn) {
      // Turn off
      setPowerAnimClass('turn-off-anim');
      setTimeout(() => {
        setIsPowerOn(false);
        setIsAnimatingPower(false);
      }, 500);
    } else {
      // Turn on
      setIsPowerOn(true);
      setPowerAnimClass('turn-on-anim');
      setTimeout(() => {
        setPowerAnimClass('');
        setIsAnimatingPower(false);
      }, 600);
    }
  };

  // Brightness controls
  const handleBrightness = (delta: number) => {
    setScreenBrightness(prev => Math.min(1.3, Math.max(0.7, +(prev + delta).toFixed(2))));
  };

  // Open / Close system apps
  const sysOpenApp = (appId: string) => {
    setIsStartMenuOpen(false);
    setIsEditMode(false);
    if (appId === 'game_lobby') {
      setActiveApp('game');
    } else {
      setActiveApp(appId);
    }
  };

  const sysCloseApp = () => {
    setActiveApp(null);
    setIsStartMenuOpen(false);
    setIsEditMode(false);
    if (onClearForceOpenApp) {
      onClearForceOpenApp();
    }
  };

  // Mail actions
  const openMail = (id: number) => {
    setReadingMailId(id);
    setMails(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, unread: false } : m);
      const readIds = updated.filter(m => !m.unread).map(m => m.id);
      idbSaveRetroMailsReadState(readIds).catch(() => {});
      return updated;
    });
  };

  const closeMailReader = () => {
    setReadingMailId(null);
  };

  // File actions
  const openFile = (file: FileItem) => {
    setActiveFile(file);
  };

  const closeFileView = () => {
    setActiveFile(null);
  };

  // Web actions
  const openStudent = (s: StudentItem) => {
    setSelectedStudent(s);
    setWebPage('detail');
  };

  const backToDirectory = () => {
    setWebPage('directory');
    setSelectedStudent(null);
  };

  const readingMail = readingMailId ? mails.find(m => m.id === readingMailId) : null;
  const unreadCount = mails.filter(m => m.unread).length;

  return (
    <div className="retro-desktop-wrapper">
      <div className="retro-machine-stack">
        {/* Cowl */}
        <div className="retro-monitor-top-cowl"></div>

        {/* Chassis */}
        <div className="retro-monitor-chassis">
          <div className="chassis-top-detail"></div>

          {/* Bezel */}
          <div className="retro-monitor-bezel">
            {/* Inner */}
            <div className="retro-monitor-inner">
              {/* Screen */}
              <div 
                className="retro-screen-display" 
                id="main-screen"
                style={{ filter: `brightness(${screenBrightness})` }}
              >
                {/* CRT Effects */}
                <div className={`crt-effects ${isPowerOn && activeApp !== 'backup' ? 'active' : ''}`} id="crt-effects"></div>
                <div className={`power-line ${powerAnimClass}`} id="power-line"></div>

                {/* Desktop OS */}
                <div 
                  className={`desktop-os ${isPowerOn ? 'active' : ''}`} 
                  id="desktop-os"
                  onClick={() => {
                    setIsStartMenuOpen(false);
                    if (isEditModeJustActivatedRef.current) return;
                    if (isEditMode) setIsEditMode(false);
                  }}
                >
                  {/* Floating Drag Ghost Badge following touch/pointer */}
                  {draggingAppId && (
                    <div 
                      className={`retro-drag-ghost ${isOverDesktop ? 'over-desktop' : ''}`}
                      style={{
                        left: `${dragPosition.x}px`,
                        top: `${dragPosition.y}px`,
                      }}
                    >
                      <i className={`${DESKTOP_APPS_META[draggingAppId]?.icon || 'fa-solid fa-cube'} text-sm`}></i>
                      <span>{DESKTOP_APPS_META[draggingAppId]?.name || draggingAppId}</span>
                      <span className="text-[9px] bg-black/40 px-1 py-0.5 rounded border border-white/30">
                        {isOverDesktop ? '松手添加到桌面' : '拖动至屏幕'}
                      </span>
                    </div>
                  )}

                  {/* Desktop Notice Banner */}
                  {desktopNotice && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-stone-900/90 text-emerald-300 border border-emerald-500/80 px-2.5 py-1 rounded text-[11px] font-mono z-30 pointer-events-none shadow-xl animate-fade-in">
                      {desktopNotice}
                    </div>
                  )}

                  {/* Desktop Icons Area */}
                  <div 
                    id="desktop-icons-area"
                    className={`desktop-icons-area ${activeApp ? 'pointer-events-none opacity-0' : ''} ${draggingAppId && isOverDesktop ? 'desktop-drop-zone-active' : ''}`}
                    onClick={() => {
                      if (isEditModeJustActivatedRef.current) return;
                      if (isEditMode) setIsEditMode(false);
                    }}
                  >
                    {/* System Pending Invite Banner */}
                    {pendingInvite && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); sysOpenApp('game_lobby'); }}
                        className="w-full mb-1 p-2 rounded bg-amber-950/80 border border-amber-400 text-amber-200 text-xs font-mono flex items-center justify-between cursor-pointer hover:bg-amber-900/90 transition-all shadow-md animate-pulse select-none"
                      >
                        <span className="flex items-center gap-2">
                          <i className="fa-solid fa-gamepad text-amber-400"></i>
                          <span>[INVITE] {pendingInvite.characterName} 发来游戏邀请!</span>
                        </span>
                        <span className="bg-amber-400 text-black px-2 py-0.5 rounded text-[10px] font-bold">进入对局</span>
                      </div>
                    )}

                    {/* Dynamic Desktop Icons based on desktopApps state */}
                    {desktopApps.map((appId) => {
                      const meta = DESKTOP_APPS_META[appId];
                      if (!meta) return null;

                      return (
                        <div 
                          key={appId} 
                          className="desktop-icon-wrapper"
                          onContextMenu={(e) => e.preventDefault()}
                          onTouchStart={(e) => {
                            isTouchInteractionRef.current = true;
                            const touch = e.touches[0];
                            startDesktopIconLongPress(touch.clientX, touch.clientY);
                          }}
                          onTouchEnd={() => {
                            cancelDesktopIconLongPress();
                            setTimeout(() => {
                              isTouchInteractionRef.current = false;
                            }, 400);
                          }}
                          onTouchCancel={() => {
                            cancelDesktopIconLongPress();
                            isTouchInteractionRef.current = false;
                          }}
                          onMouseDown={(e) => {
                            if (isTouchInteractionRef.current) return;
                            if (e.button === 0) {
                              startDesktopIconLongPress(e.clientX, e.clientY);
                            }
                          }}
                          onMouseUp={() => {
                            if (isTouchInteractionRef.current) return;
                            cancelDesktopIconLongPress();
                          }}
                          onMouseLeave={() => {
                            if (isTouchInteractionRef.current) return;
                            cancelDesktopIconLongPress();
                          }}
                        >
                          <div 
                            className={`desktop-icon ${isEditMode ? 'jiggle-mode' : ''}`} 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              // If this click is the synthetic release of the long press that just activated edit mode, ignore it!
                              if (isEditModeJustActivatedRef.current) {
                                return;
                              }
                              if (isEditMode) {
                                // A subsequent intentional tap on the icon dismisses edit mode, DOES NOT delete!
                                setIsEditMode(false);
                                return;
                              }
                              sysOpenApp(appId); 
                            }} 
                            title={meta.desc}
                          >
                            <i className={`${meta.icon} ${meta.colorClass}`}></i>
                            <span>{meta.name}{appId === 'mail' && unreadCount > 0 ? `(${unreadCount})` : ''}</span>
                          </div>

                          {/* Delete [×] Badge: shown when long-pressed into edit mode for all desktop apps */}
                          {isEditMode && (
                            <div 
                              className="desktop-icon-remove-badge"
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                removeAppFromDesktop(appId);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAppFromDesktop(appId);
                              }}
                              title={`从桌面删除 ${meta.name}`}
                            >
                              ×
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                {/* ================= APP 1: MAIL ================= */}
                <div className={`app-window app-mail ${isPowerOn && activeApp === 'mail' ? 'active' : ''}`} id="app-mail">
                  {/* List View */}
                  <div className={`mail-view-list ${readingMail ? 'hidden' : ''}`} id="mail-view-list">
                    <div className="mail-topbar">
                      <span className="topbar-title">SYS_MAIL_CLIENT v1.0</span>
                      <div className="topbar-close" onClick={sysCloseApp}>[X]</div>
                    </div>
                    <div className="mail-inbox-title">&gt;&gt; INBOX ({unreadCount} UNREAD)</div>
                    <div className="mail-list-container" id="mail-dynamic-list">
                      {mails.map(m => (
                        <div 
                          key={m.id} 
                          className={`mail-item ${m.unread ? 'unread' : ''}`}
                          onClick={() => openMail(m.id)}
                        >
                          <div className="item-header">
                            <span className="sender">{m.sender}</span>
                            <span className="date">{m.date}</span>
                          </div>
                          <div className="item-subject">{m.subj}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reader View */}
                  <div className={`mail-view-reader ${readingMail ? 'active' : ''}`} id="mail-view-reader">
                    <div className="mail-topbar">
                      <div className="topbar-back" onClick={closeMailReader}>[&lt; BACK]</div>
                      <span className="topbar-title">READING...</span>
                    </div>
                    {readingMail && (
                      <div className="reader-content-box">
                        <div className="reader-header" id="reader-header">
                          <div className="r-subj">{readingMail.subj}</div>
                          <div className="r-meta">FROM: {readingMail.sender} | DATE: {readingMail.date}</div>
                        </div>
                        <div className="reader-body" id="reader-body">{readingMail.body}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================= APP 2: FILES ================= */}
                <div className={`app-window app-files ${isPowerOn && activeApp === 'files' ? 'active' : ''}`} id="app-files">
                  {/* List View */}
                  <div className={`files-view-list ${activeFile ? 'hidden' : ''}`} id="files-view-list">
                    <div className="files-titlebar">
                      <div className="titlebar-text">C:\USER\DOCUMENTS</div>
                      <div className="titlebar-close" onClick={sysCloseApp}><div className="close-box"></div></div>
                    </div>
                    <div className="files-menubar">
                      <span>File</span><span>Edit</span><span>View</span><span>Help</span>
                    </div>
                    <div className="files-grid" id="files-grid">
                      {INITIAL_FILES.map(f => (
                        <div key={f.id} className="file-item" onClick={() => openFile(f)}>
                          <div className="file-icon"><i className={`fa-solid ${f.icon}`}></i></div>
                          <div className="file-name">{f.name}</div>
                        </div>
                      ))}
                    </div>
                    <div className="files-statusbar" id="files-statusbar">{INITIAL_FILES.length} Object(s)</div>
                  </div>

                  {/* Text Viewer */}
                  <div className={`files-view-text ${activeFile && activeFile.type === 'text' ? 'active' : ''}`} id="files-view-text">
                    <div className="files-titlebar">
                      <div className="titlebar-text" id="text-title">{activeFile?.name || 'NOTEPAD.EXE'}</div>
                      <div className="titlebar-close" onClick={closeFileView}><div className="close-box"></div></div>
                    </div>
                    <div className="files-menubar"><span>File</span><span>Edit</span><span>Format</span></div>
                    <div className="text-content-area" id="text-content">{activeFile?.content}</div>
                  </div>

                  {/* Image Viewer */}
                  <div className={`files-view-image ${activeFile && activeFile.type === 'image' ? 'active' : ''}`} id="files-view-image">
                    <div className="files-titlebar">
                      <div className="titlebar-text" id="img-title">{activeFile?.name || 'IMAGE_VIEWER'}</div>
                      <div className="titlebar-close" onClick={closeFileView}><div className="close-box"></div></div>
                    </div>
                    <div className="image-content-area" id="image-container">
                      {activeFile?.url ? (
                        <img src={activeFile.url} alt={activeFile.name} />
                      ) : (
                        <div className="missing-image-box">
                          <i className="fa-solid fa-triangle-exclamation"></i>
                          <span>{activeFile?.alt || '图片数据丢失'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= APP 3: WEB ================= */}
                <div className={`app-window app-web ${isPowerOn && activeApp === 'web' ? 'active' : ''}`} id="app-web">
                  <div className="web-browser-chrome">
                    <div className="web-titlebar">
                      <div className="titlebar-text">Web Navigator - [32-Bit Retro Edition]</div>
                      <div className="titlebar-close" onClick={sysCloseApp}><div className="close-box"></div></div>
                    </div>
                    <div className="web-toolbar">
                      <div className="tool-btn" onClick={backToDirectory}>
                        <i className="fa-solid fa-arrow-left"></i> Back
                      </div>
                      <div className="tool-btn">
                        <i className="fa-solid fa-arrow-right"></i> Fwd
                      </div>
                      <div className="tool-btn" onClick={() => {}}>
                        <i className="fa-solid fa-rotate-right"></i> Reload
                      </div>
                    </div>
                    <div className="web-address-bar">
                      <span>Addr:</span>
                      <div className="address-input" id="address-input">
                        {webPage === 'directory' ? 'http://edu.sys.local/directory' : `http://edu.sys.local/profile?id=${selectedStudent?.id}`}
                      </div>
                    </div>
                  </div>

                  <div className="web-viewport">
                    {/* Directory Page */}
                    <div className={`web-page ${webPage === 'directory' ? 'active' : ''}`} id="page-directory">
                      <div className="school-header">
                        <div className="school-logo">U</div>
                        <h1>University S.I.S.</h1>
                      </div>
                      <hr className="retro-hr" />
                      <h2>Student Directory</h2>
                      <ul className="student-link-list" id="student-list">
                        {STUDENT_DB.map(s => (
                          <li key={s.id}>
                            <span className="retro-link" onClick={() => openStudent(s)}>
                              {s.name} [ID: {s.code}]
                            </span>
                          </li>
                        ))}
                      </ul>
                      <hr className="retro-hr" />
                    </div>

                    {/* Detail Profile Page */}
                    <div className={`web-page ${webPage === 'detail' ? 'active' : ''}`} id="page-detail">
                      <h2 id="detail-title">Student Profile</h2>
                      <hr className="retro-hr" />
                      {selectedStudent && (
                        <>
                          <div className="profile-container">
                            <div className="profile-photo">
                              <i className="fa-solid fa-user"></i>
                              <span className="photo-text">NO PHOTO</span>
                            </div>
                            <table className="retro-table">
                              <tbody>
                                <tr>
                                  <td className="td-label">Name:</td>
                                  <td className="td-value" id="s-name">{selectedStudent.name}</td>
                                </tr>
                                <tr>
                                  <td className="td-label">ID:</td>
                                  <td className="td-value" id="s-id">{selectedStudent.code}</td>
                                </tr>
                                <tr>
                                  <td className="td-label">Major:</td>
                                  <td className="td-value" id="s-major">{selectedStudent.major}</td>
                                </tr>
                                <tr>
                                  <td className="td-label">Status:</td>
                                  <td 
                                    className="td-value" 
                                    id="s-status"
                                    style={{ color: selectedStudent.status !== "在读" ? "red" : "black" }}
                                  >
                                    {selectedStudent.status}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="remarks-box">
                            <strong>Remarks:</strong>
                            <p id="s-remarks">{selectedStudent.remarks}</p>
                          </div>
                          <br />
                          <div className="retro-link" onClick={backToDirectory}>[ Return to Directory ]</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= APP 4: SYSTEM & GAME TOOLS (Integrated WindChime features) ================= */}
                {isPowerOn && activeApp && !['mail', 'files', 'web'].includes(activeApp) && (
                  <div className="app-sys-tool active">
                    {activeApp !== 'backup' && (
                      <div className="sys-tool-titlebar">
                        <span>SYS_APP.EXE - {
                          (activeApp === 'game' || activeApp === 'game_lobby') ? '游戏大厅 (GAME)' :
                          activeApp === 'persona' ? '人设档案 (PERSONA)' :
                          (activeApp === 'css' || activeApp === 'wallpaper' || activeApp === 'ambience') ? '外观与音效工坊 (CSS_STYLE)' :
                          activeApp === 'llm' ? '模型算力 (LLM_CONFIG)' :
                          activeApp === 'dictionary' ? '拦截词典 (DICTIONARY)' : activeApp
                        }</span>
                        <div 
                          onClick={sysCloseApp} 
                          className="cursor-pointer px-1 hover:bg-red-600 font-bold"
                          title="关闭应用返回桌面"
                        >
                          [X]
                        </div>
                      </div>
                    )}
                    <div className="sys-tool-body">
                      {(activeApp === 'game' || activeApp === 'game_lobby') && (
                        <GameLobbyApp
                          characterName={characterName || '少女'}
                          character={character}
                          currentEmotionSnapshot={currentEmotionSnapshot}
                          onGameFinished={onGameFinished}
                          onApplyGameEmotionDelta={onApplyGameEmotionDelta}
                          onInGameChat={onInGameChat}
                          initialSubApp={forceOpenSubApp || undefined}
                          onRejectGameInvite={onRejectGameInvite}
                        />
                      )}
                      {activeApp === 'persona' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <PersonaApp
                            currentCharacterId={currentCharacterId}
                            onEngineReload={onEngineReload}
                          />
                        </div>
                      )}
                      {(activeApp === 'css' || activeApp === 'wallpaper' || activeApp === 'ambience') && (
                        <div className="p-3 overflow-y-auto h-full">
                          <CssApp
                            onBgChange={onBgChange}
                            currentBg={currentBg}
                            initialTab={activeApp === 'wallpaper' ? 'wallpaper' : activeApp === 'ambience' ? 'ambience' : 'css'}
                          />
                        </div>
                      )}
                      {activeApp === 'llm' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <LlmApp onConfigChange={onConfigChange} />
                        </div>
                      )}
                      {activeApp === 'dictionary' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <DictionaryApp />
                        </div>
                      )}
                      {activeApp === 'backup' && (
                        <div className="h-full overflow-y-auto">
                          <DataBackupModal
                            currentCharacterId={currentCharacterId || 'default'}
                            onDataImported={onEngineReload}
                            onClose={sysCloseApp}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ================= RETRO START MENU (开始菜单) ================= */}
                {isPowerOn && isStartMenuOpen && (
                  <div 
                    className="retro-start-menu" 
                    id="retro-start-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="start-menu-sidebar">
                      <span>Windows</span>
                    </div>
                    <div className="start-menu-items">
                      {Object.values(DESKTOP_APPS_META).map((meta, idx) => {
                        const isDraggingThis = draggingAppId === meta.id;

                        return (
                          <React.Fragment key={meta.id}>
                            {idx === 4 && <div className="start-menu-divider" />}
                            <div 
                              className={`start-menu-item ${isDraggingThis ? 'dragging-source' : ''}`}
                              onTouchStart={(e) => {
                                const touch = e.touches[0];
                                handleItemTouchStart(meta.id, touch.clientX, touch.clientY);
                              }}
                              onMouseDown={(e) => {
                                handleItemTouchStart(meta.id, e.clientX, e.clientY);
                              }}
                              onClick={() => {
                                if (!isDraggingActiveRef.current) {
                                  sysOpenApp(meta.id);
                                }
                              }}
                              title={`${meta.fullName} - 可长按拖拽至桌面`}
                            >
                              <i className={`${meta.icon} ${
                                meta.id === 'mail' ? 'text-blue-600' :
                                meta.id === 'files' ? 'text-amber-600' :
                                meta.id === 'web' ? 'text-teal-600' :
                                meta.id === 'game' ? 'text-purple-600' :
                                meta.id === 'persona' ? 'text-orange-600' :
                                meta.id === 'css' ? 'text-indigo-600' :
                                meta.id === 'llm' ? 'text-emerald-600' :
                                meta.id === 'dictionary' ? 'text-red-600' :
                                'text-pink-600'
                              } w-4 text-center shrink-0`}></i>
                              <span className="truncate flex-1">{meta.fullName}</span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div className="start-menu-divider"></div>
                      <div className="start-menu-item" onClick={handleTogglePower}>
                        <i className="fa-solid fa-power-off text-rose-600 w-4 text-center shrink-0"></i>
                        <span>关闭计算机 (SHUTDOWN)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= RETRO SYSTEM TASKBAR (系统栏) ================= */}
                {isPowerOn && (
                  <div 
                    className="retro-taskbar" 
                    id="retro-taskbar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Left: Green Windows Start Key & Active App Window Button */}
                    <div className="flex items-center gap-1.5 overflow-hidden h-full">
                      <button 
                        className={`start-btn ${isStartMenuOpen ? 'pressed' : ''}`}
                        id="start-button"
                        onClick={() => setIsStartMenuOpen(prev => !prev)}
                        title="开始"
                      >
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                          <path d="M1.5 2.5 C3.5 2 5.5 3.5 7.5 3 L7.5 7.5 C5.5 8 3.5 6.5 1.5 7 Z" fill="#f34f1c" />
                          <path d="M8.5 2.7 C10.5 2.2 12.5 3.7 14.5 3.2 L14.5 7.7 C12.5 8.2 10.5 6.7 8.5 7.2 Z" fill="#7fba00" />
                          <path d="M1.5 8.5 C3.5 8 5.5 9.5 7.5 9 L7.5 13.5 C5.5 14 3.5 12.5 1.5 13 Z" fill="#01a6f0" />
                          <path d="M8.5 8.7 C10.5 8.2 12.5 9.7 14.5 9.2 L14.5 13.7 C12.5 14.2 10.5 12.7 8.5 13.2 Z" fill="#ffba08" />
                        </svg>
                        <span className="font-black italic tracking-wide text-xs">开始</span>
                      </button>

                      {/* Active Task / Window Indicator */}
                      {activeApp && (
                        <div 
                          className="taskbar-active-item truncate max-w-[140px] sm:max-w-[180px]"
                          onClick={sysCloseApp}
                          title="点击返回桌面 / 最小化"
                        >
                          <i className={`fa-solid ${
                            activeApp === 'mail' ? 'fa-envelope text-blue-200' :
                            activeApp === 'files' ? 'fa-folder-open text-amber-200' :
                            activeApp === 'web' ? 'fa-compass text-teal-200' :
                            (activeApp === 'game' || activeApp === 'game_lobby') ? 'fa-gamepad text-purple-200' :
                            activeApp === 'persona' ? 'fa-user-gear text-orange-200' :
                            (activeApp === 'css' || activeApp === 'wallpaper' || activeApp === 'ambience') ? 'fa-palette text-indigo-200' :
                            activeApp === 'llm' ? 'fa-microchip text-emerald-200' :
                            activeApp === 'dictionary' ? 'fa-shield-halved text-red-200' :
                            'fa-database text-pink-200'
                          } text-[11px]`}></i>
                          <span className="truncate">{
                            activeApp === 'mail' ? 'SYS_MAIL' :
                            activeApp === 'files' ? 'SYS_FILES' :
                            activeApp === 'web' ? 'SYS_WEB' :
                            (activeApp === 'game' || activeApp === 'game_lobby') ? 'SYS_GAME' :
                            activeApp === 'persona' ? 'SYS_PERSONA' :
                            (activeApp === 'css' || activeApp === 'wallpaper' || activeApp === 'ambience') ? 'SYS_CSS' :
                            activeApp === 'llm' ? 'SYS_LLM' :
                            activeApp === 'dictionary' ? 'SYS_DICT' : 'SYS_BACKUP'
                          }</span>
                        </div>
                      )}
                    </div>

                    {/* Right: System Tray (Audio + Real-time Clock) */}
                    <div className="taskbar-tray" id="taskbar-tray">
                      {/* Audio mute toggle */}
                      <div 
                        className="tray-icon cursor-pointer"
                        onClick={() => setIsMuted(prev => !prev)}
                        title={isMuted ? '声音: 已静音 (点击开启)' : '声音: 正常 (点击静音)'}
                      >
                        <i className={`fa-solid ${isMuted ? 'fa-volume-xmark text-red-300' : 'fa-volume-high text-white'}`}></i>
                      </div>

                      {/* Digital Clock */}
                      <div className="tray-clock" title={`系统时间: ${currentTime}`}>
                        {currentTime}
                      </div>
                    </div>
                  </div>
                )}

              </div> {/* End desktop-os */}

              </div>
            </div>
          </div>

          {/* Chin controls */}
          <div className="retro-monitor-chin">
            <div className="chin-brand">
              <span className="brand-text">CRT-SYS 90X</span>
            </div>
            <div className="chin-vents">
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
              <div className="vent-line"></div>
            </div>
            <div className="chin-controls">
              <div 
                className="control-btn" 
                onClick={() => handleBrightness(-0.1)} 
                title="降低屏幕亮度"
              >
                <span>-</span>
              </div>
              <div 
                className="control-btn" 
                onClick={() => handleBrightness(0.1)} 
                title="提高屏幕亮度"
              >
                <span>+</span>
              </div>
              <div className="power-section">
                <div 
                  className={`power-led ${isPowerOn ? 'led-on' : ''}`} 
                  id="power-led"
                ></div>
                <div 
                  className="power-btn" 
                  id="power-btn" 
                  onClick={handleTogglePower}
                  title={isPowerOn ? "关闭显示器电源" : "开启显示器电源"}
                >
                  <div className="power-icon"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Host Base */}
        <div className="retro-host-base">
          <div className="host-drive-cd" title="CD-ROM 光驱驱动器" onClick={() => {}}>
            <div className="cd-slot"></div>
            <div className="cd-details">
              <div className="cd-hole"></div>
              <div className="cd-btn"></div>
            </div>
          </div>
          <div className="host-drive-floppy" title="3.5英寸软盘驱动器" onClick={() => {}}>
            <div className="floppy-slot"></div>
            <div className="floppy-btn"></div>
          </div>
          <div className="host-ports">
            <div className="port-circle" title="COM1 串行端口"></div>
            <div className="port-circle" title="COM2 串行端口"></div>
            <div 
              className="host-main-power" 
              title="主机电源"
              onClick={handleTogglePower}
            ></div>
          </div>
        </div>

        {/* Exit / Return button below host */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white border border-white/20 hover:border-amber-400 text-xs font-mono transition-all cursor-pointer shadow-lg flex items-center gap-2"
          >
            <span>[X] 关闭终端并返回主屏幕</span>
          </button>
        </div>
      </div>
    </div>
  );
}
