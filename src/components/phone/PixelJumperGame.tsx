import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trophy, Play, RotateCcw, Sparkles } from 'lucide-react';
import './RetroComputer.css';

interface PixelJumperGameProps {
  onExit?: () => void;
}

export default function PixelJumperGame({ onExit }: PixelJumperGameProps) {
  const [gameScore, setGameScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pixel_jumper_highscore');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [isGameJumping, setIsGameJumping] = useState(false);
  const [gameOverlayTitle, setGameOverlayTitle] = useState('PIXEL JUMPER');
  const [showGameOverlay, setShowGameOverlay] = useState(true);

  const playerRef = useRef<HTMLDivElement>(null);
  const obstacleRef = useRef<HTMLDivElement>(null);
  const gameScoreTimerRef = useRef<any>(null);
  const gameCheckTimerRef = useRef<any>(null);

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
      setGameScore(prev => {
        const next = prev + 10;
        setHighScore(old => {
          if (next > old) {
            try {
              localStorage.setItem('pixel_jumper_highscore', String(next));
            } catch {}
            return next;
          }
          return old;
        });
        return next;
      });
    }, 450);

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
    if (isGameJumping || !isPlayingGame) return;
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

  // Keyboard handler for Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlayingGame) startPixelGame();
        else jumpPixelGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayingGame, isGameJumping]);

  useEffect(() => {
    return () => {
      clearInterval(gameScoreTimerRef.current);
      clearInterval(gameCheckTimerRef.current);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#051005] text-[#33ff33] font-mono rounded-xl overflow-hidden border border-[#33ff33]/40 shadow-2xl relative">
      {/* Top Bar with back button */}
      <div className="bg-[#33ff33] text-black px-3 py-1.5 flex items-center justify-between font-bold text-xs select-none shadow">
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1 bg-black text-[#33ff33] hover:bg-black/80 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer font-bold active:scale-95"
            >
              <ArrowLeft className="size-3" />
              <span>返回大厅</span>
            </button>
          )}
          <span className="tracking-wide">A:\PIXEL_JUMPER.EXE [单机街机区]</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <Trophy className="size-3 text-amber-900" />
            <span>最高: {highScore}</span>
          </span>
          <span className="bg-black/20 px-1.5 py-0.5 rounded">
            当前: {gameScore}
          </span>
        </div>
      </div>

      {/* Screen Area */}
      <div 
        className="game-screen flex-1 relative overflow-hidden select-none cursor-pointer" 
        onClick={handleGameScreenClick}
      >
        <div className="game-score">
          SCORE: <span id="score-val">{gameScore}</span>
        </div>

        <div className="game-world" id="game-world">
          <div className="ground-line"></div>
          <div className="player" id="player" ref={playerRef}></div>
          <div className="obstacle" id="obstacle" ref={obstacleRef}></div>
        </div>

        {/* Overlay */}
        <div className={`game-overlay ${showGameOverlay ? 'active' : ''}`} id="game-overlay">
          <div className="overlay-title">{gameOverlayTitle}</div>
          <div className="text-xs text-[#33ff33]/80 mb-2 font-mono">
            {gameOverlayTitle === 'CRASHED' ? `最终得分: ${gameScore} 分` : '单机复古跑酷避障'}
          </div>
          <div className="overlay-blink">
            点击画面 或 按空格键 {gameOverlayTitle === 'CRASHED' ? '重新开始' : '投币起跑'}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                startPixelGame();
              }}
              className="px-4 py-1.5 bg-[#33ff33] text-black font-bold text-xs rounded hover:bg-[#4dff4d] transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Play className="size-3.5 fill-black" />
              <span>{gameOverlayTitle === 'CRASHED' ? '再来一局' : '开始游戏'}</span>
            </button>
            {onExit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExit();
                }}
                className="px-3 py-1.5 bg-black/60 border border-[#33ff33]/40 text-[#33ff33] text-xs rounded hover:bg-black/90 transition-all active:scale-95 cursor-pointer"
              >
                退出大厅
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Retro CRT Scanline Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,20,0,0.35)_100%)]"></div>
    </div>
  );
}
