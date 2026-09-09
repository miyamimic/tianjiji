import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RetroComputer.css';
import PersonaApp from './PersonaApp';
import WallpaperApp from './WallpaperApp';
import LlmApp from './LlmApp';
import AmbienceApp from './AmbienceApp';
import DictionaryApp from './DictionaryApp';
import CssApp from './CssApp';
import GameLobbyApp, { type GameLobbySubApp } from './GameLobbyApp';
import DataBackupModal from '../DataBackupModal';
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

  // Mail state
  const [mails, setMails] = useState<MailItem[]>(INITIAL_MAILS);
  const [readingMailId, setReadingMailId] = useState<number | null>(null);

  // Files state
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);

  // Web state
  const [webPage, setWebPage] = useState<'directory' | 'detail'>('directory');
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  // Game state
  const [gameScore, setGameScore] = useState(0);
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [isGameJumping, setIsGameJumping] = useState(false);
  const [gameOverlayTitle, setGameOverlayTitle] = useState('PIXEL JUMPER');
  const [showGameOverlay, setShowGameOverlay] = useState(true);

  // Refs for game elements
  const playerRef = useRef<HTMLDivElement>(null);
  const obstacleRef = useRef<HTMLDivElement>(null);
  const gameScoreTimerRef = useRef<any>(null);
  const gameCheckTimerRef = useRef<any>(null);

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
      stopPixelGame();
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
    setActiveApp(appId);
    if (appId === 'game') {
      initPixelGame();
    }
  };

  const sysCloseApp = () => {
    if (activeApp === 'game') {
      stopPixelGame();
    }
    setActiveApp(null);
    if (onClearForceOpenApp) {
      onClearForceOpenApp();
    }
  };

  // Mail actions
  const openMail = (id: number) => {
    setReadingMailId(id);
    setMails(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m));
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

  // Pixel Jumper Game Logic
  const initPixelGame = () => {
    setGameOverlayTitle("PIXEL JUMPER");
    setShowGameOverlay(true);
    setIsPlayingGame(false);
  };

  const startPixelGame = () => {
    setIsPlayingGame(true);
    setGameScore(0);
    setShowGameOverlay(false);
    setIsGameJumping(false);

    if (obstacleRef.current) {
      obstacleRef.current.classList.remove('move-anim');
      void obstacleRef.current.offsetWidth;
      obstacleRef.current.classList.add('move-anim');
      obstacleRef.current.style.animationPlayState = 'running';
    }
    if (playerRef.current) {
      playerRef.current.style.animationPlayState = 'running';
      playerRef.current.classList.remove('jump-anim');
    }

    clearInterval(gameScoreTimerRef.current);
    clearInterval(gameCheckTimerRef.current);

    gameScoreTimerRef.current = setInterval(() => {
      setGameScore(prev => prev + 10);
    }, 500);

    gameCheckTimerRef.current = setInterval(checkGameCollision, 25);
  };

  const stopPixelGame = () => {
    setIsPlayingGame(false);
    clearInterval(gameScoreTimerRef.current);
    clearInterval(gameCheckTimerRef.current);
    if (obstacleRef.current) {
      obstacleRef.current.style.animationPlayState = 'paused';
    }
    if (playerRef.current) {
      playerRef.current.style.animationPlayState = 'paused';
    }
  };

  const triggerGameOver = () => {
    stopPixelGame();
    setGameOverlayTitle("CRASHED");
    setShowGameOverlay(true);
  };

  const jumpPixelGame = () => {
    if (isGameJumping) return;
    setIsGameJumping(true);

    if (playerRef.current) {
      playerRef.current.style.animationPlayState = 'running';
      playerRef.current.classList.remove('jump-anim');
      void playerRef.current.offsetWidth;
      playerRef.current.classList.add('jump-anim');
    }

    setTimeout(() => {
      if (playerRef.current) {
        playerRef.current.classList.remove('jump-anim');
      }
      setIsGameJumping(false);
    }, 600);
  };

  const checkGameCollision = () => {
    if (!playerRef.current || !obstacleRef.current) return;
    const p = playerRef.current.getBoundingClientRect();
    const o = obstacleRef.current.getBoundingClientRect();
    if (p.right - 5 > o.left && p.left + 5 < o.right && p.bottom > o.top + 4) {
      triggerGameOver();
    }
  };

  const handleGameScreenClick = () => {
    if (!isPlayingGame) {
      startPixelGame();
    } else {
      jumpPixelGame();
    }
  };

  // Keyboard handler for Space in game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeApp === 'game' && e.code === 'Space') {
        e.preventDefault();
        if (!isPlayingGame) startPixelGame();
        else jumpPixelGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeApp, isPlayingGame, isGameJumping]);

  // Clean up game timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(gameScoreTimerRef.current);
      clearInterval(gameCheckTimerRef.current);
    };
  }, []);

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
                <div className={`crt-effects ${isPowerOn ? 'active' : ''}`} id="crt-effects"></div>
                <div className={`power-line ${powerAnimClass}`} id="power-line"></div>

                {/* Desktop OS */}
                <div 
                  className={`desktop-os ${isPowerOn && !activeApp ? 'active' : ''}`} 
                  id="desktop-os"
                >
                  {/* System Pending Invite Banner */}
                  {pendingInvite && (
                    <div 
                      onClick={() => sysOpenApp('game_lobby')}
                      className="w-full mb-1 p-2 rounded bg-amber-950/80 border border-amber-400 text-amber-200 text-xs font-mono flex items-center justify-between cursor-pointer hover:bg-amber-900/90 transition-all shadow-md animate-pulse select-none"
                    >
                      <span className="flex items-center gap-2">
                        <i className="fa-solid fa-gamepad text-amber-400"></i>
                        <span>[INVITE] {pendingInvite.characterName} 发来游戏邀请!</span>
                      </span>
                      <span className="bg-amber-400 text-black px-2 py-0.5 rounded text-[10px] font-bold">进入对局</span>
                    </div>
                  )}

                  {/* Core 4 Retro Icons */}
                  <div className="desktop-icon" onClick={() => sysOpenApp('mail')} title="电子邮件客户端">
                    <i className="fa-solid fa-envelope"></i>
                    <span>MAIL{unreadCount > 0 ? `(${unreadCount})` : ''}</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('files')} title="文件资源管理器">
                    <i className="fa-solid fa-folder-open"></i>
                    <span>FILES</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('web')} title="万维网导航浏览器">
                    <i className="fa-solid fa-compass"></i>
                    <span>WEB</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('game')} title="像素跳跃小游戏">
                    <i className="fa-solid fa-gamepad"></i>
                    <span>GAME</span>
                  </div>

                  {/* Wind Chime System Tool Icons */}
                  <div className="desktop-icon" onClick={() => sysOpenApp('game_lobby')} title="游戏大厅 (五子棋/捉鬼牌/抽卡)">
                    <i className="fa-solid fa-dice text-amber-300"></i>
                    <span>LOBBY</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('persona')} title="人设与立绘管理">
                    <i className="fa-solid fa-user-gear text-orange-300"></i>
                    <span>PERSONA</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('wallpaper')} title="桌面背景装扮">
                    <i className="fa-solid fa-image text-cyan-300"></i>
                    <span>WALLPAPER</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('llm')} title="大语言模型接口与算力">
                    <i className="fa-solid fa-microchip text-emerald-300"></i>
                    <span>LLM_CONF</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('ambience')} title="背景氛围白噪声">
                    <i className="fa-solid fa-music text-rose-300"></i>
                    <span>AMBIENCE</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('dictionary')} title="敏感词与激化词典">
                    <i className="fa-solid fa-shield-halved text-purple-300"></i>
                    <span>DICTIONARY</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('css')} title="界面样式与滤镜工坊">
                    <i className="fa-solid fa-palette text-blue-300"></i>
                    <span>CSS_STYLE</span>
                  </div>

                  <div className="desktop-icon" onClick={() => sysOpenApp('backup')} title="分文件数据备份与恢复">
                    <i className="fa-solid fa-database text-pink-300"></i>
                    <span>BACKUP</span>
                  </div>
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

                {/* ================= APP 4: GAME (PIXEL JUMPER) ================= */}
                <div className={`app-window app-game ${isPowerOn && activeApp === 'game' ? 'active' : ''}`} id="app-game">
                  <div className="game-topbar">
                    <span>A:\PIXEL_JUMPER.EXE</span>
                    <div className="game-close-btn" onClick={sysCloseApp}>[X]</div>
                  </div>
                  <div className="game-screen" id="game-screen-area" onClick={handleGameScreenClick}>
                    <div className="game-score">SCORE: <span id="score-val">{gameScore}</span></div>
                    <div className="game-world" id="game-world">
                      <div className="ground-line"></div>
                      <div className="player" id="player" ref={playerRef}></div>
                      <div className="obstacle" id="obstacle" ref={obstacleRef}></div>
                    </div>
                    <div className={`game-overlay ${showGameOverlay ? 'active' : ''}`} id="game-overlay">
                      <div className="overlay-title" id="overlay-title">{gameOverlayTitle}</div>
                      <div className="overlay-blink">CLICK OR PRESS SPACE TO {gameOverlayTitle === 'CRASHED' ? 'RETRY' : 'START'}</div>
                    </div>
                  </div>
                </div>

                {/* ================= APP 5: SYSTEM TOOLS (Integrated WindChime features) ================= */}
                {isPowerOn && activeApp && !['mail', 'files', 'web', 'game'].includes(activeApp) && (
                  <div className="app-sys-tool active">
                    <div className="sys-tool-titlebar">
                      <span>SYS_APP.EXE - {
                        activeApp === 'game_lobby' ? '游戏大厅 (GAME_LOBBY)' :
                        activeApp === 'persona' ? '人设档案 (PERSONA)' :
                        activeApp === 'wallpaper' ? '壁纸装扮 (WALLPAPER)' :
                        activeApp === 'llm' ? '模型算力 (LLM_CONFIG)' :
                        activeApp === 'ambience' ? '氛围白噪 (AMBIENCE)' :
                        activeApp === 'dictionary' ? '拦截词典 (DICTIONARY)' :
                        activeApp === 'css' ? '视觉工坊 (CSS_STUDIO)' :
                        activeApp === 'backup' ? '数据备份 (DATA_BACKUP)' : activeApp
                      }</span>
                      <div 
                        onClick={sysCloseApp} 
                        className="cursor-pointer px-1 hover:bg-red-600 font-bold"
                        title="关闭应用返回桌面"
                      >
                        [X]
                      </div>
                    </div>
                    <div className="sys-tool-body">
                      {activeApp === 'game_lobby' && (
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
                      {activeApp === 'wallpaper' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <WallpaperApp
                            onBgChange={onBgChange}
                            currentBg={currentBg}
                          />
                        </div>
                      )}
                      {activeApp === 'llm' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <LlmApp onConfigChange={onConfigChange} />
                        </div>
                      )}
                      {activeApp === 'ambience' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <AmbienceApp />
                        </div>
                      )}
                      {activeApp === 'dictionary' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <DictionaryApp />
                        </div>
                      )}
                      {activeApp === 'css' && (
                        <div className="p-3 overflow-y-auto h-full">
                          <CssApp />
                        </div>
                      )}
                      {activeApp === 'backup' && (
                        <div className="p-2 sm:p-3 bg-[#fffafb] text-[#4a3e3d] shadow-sm h-full overflow-y-auto">
                          <DataBackupModal
                            currentCharacterId={currentCharacterId || 'default'}
                            onDataImported={onEngineReload}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
