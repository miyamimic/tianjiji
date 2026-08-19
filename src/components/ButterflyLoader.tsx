import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function ButterflyLoader({ onComplete }: Props) {
  const [stage, setStage] = useState<'enter' | 'fly' | 'leave' | 'done'>('enter');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; color: string }>>([]);

  useEffect(() => {
    // Generate magical sparkling stardust along the butterfly's flight path
    const dots = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: 35 + (i * 2.5) + (Math.random() * 16 - 8),
      y: 60 - (i * 2.2) + (Math.random() * 14 - 7),
      size: Math.random() * 4 + 2,
      delay: i * 0.07,
      color: i % 3 === 0 ? '#ffd36a' : i % 3 === 1 ? '#ff9a3c' : '#ffffff',
    }));
    setParticles(dots);

    // Sequence the animation stages
    const t1 = setTimeout(() => setStage('fly'), 300);
    const t2 = setTimeout(() => setStage('leave'), 1600);
    const t3 = setTimeout(() => {
      setStage('done');
      onComplete();
    }, 2100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 pointer-events-auto ${
        stage === 'leave' || stage === 'done' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="正在进入房间..."
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-gradient-to-br from-[hsl(28_85%_62%/0.18)] to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: '3s' }}
        />
      </div>

      {/* Sparkle particle trail */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full animate-ping"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}`,
              animationDuration: '1.4s',
              animationDelay: `${p.delay}s`,
              animationIterationCount: 'infinite',
              opacity: stage === 'fly' ? 0.85 : 0.2,
            }}
          />
        ))}
      </div>

      {/* The Animated Flying Butterfly Container */}
      <div
        className={`relative z-10 transition-all duration-1200 ease-in-out ${
          stage === 'enter'
            ? 'translate-x-0 translate-y-4 scale-95 opacity-80'
            : stage === 'fly'
            ? 'translate-x-4 -translate-y-8 scale-110 opacity-100'
            : '-translate-y-[140vh] translate-x-[60vw] scale-50 opacity-0'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        <div className="relative butterfly-flight-motion">
          {/* Butterfly SVG with 3D flapping wings */}
          <div className="relative w-28 h-28 flex items-center justify-center filter drop-shadow-[0_0_18px_rgba(255,180,60,0.6)]">
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="wingGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff2c2" />
                  <stop offset="30%" stopColor="#ffb347" />
                  <stop offset="70%" stopColor="#ff7828" />
                  <stop offset="100%" stopColor="#d94b00" />
                </linearGradient>
                <linearGradient id="wingGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fff2c2" />
                  <stop offset="30%" stopColor="#ffb347" />
                  <stop offset="70%" stopColor="#ff7828" />
                  <stop offset="100%" stopColor="#d94b00" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Central body & antennae */}
              <g className="butterfly-body">
                {/* Antennae */}
                <path
                  d="M58 48 C55 35 48 30 42 28 M62 48 C65 35 72 30 78 28"
                  stroke="#ffdd99"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="41" cy="27" r="2" fill="#ffd36a" />
                <circle cx="79" cy="27" r="2" fill="#ffd36a" />

                {/* Abdomen / thorax */}
                <ellipse cx="60" cy="58" rx="3.5" ry="16" fill="#4a2608" stroke="#ffd36a" strokeWidth="1" />
                <ellipse cx="60" cy="46" rx="4" ry="5" fill="#6d390c" stroke="#ffd36a" strokeWidth="1" />
                <circle cx="60" cy="45" r="2" fill="#fff" opacity="0.6" />
              </g>

              {/* Left Wing Group with CSS 3D flap animation */}
              <g className="butterfly-wing-left" style={{ transformOrigin: '60px 58px' }}>
                {/* Forewing */}
                <path
                  d="M59 48 C52 28 24 16 10 32 C0 44 8 68 34 68 C46 68 56 60 59 54 Z"
                  fill="url(#wingGradLeft)"
                  stroke="#ffe6a3"
                  strokeWidth="1.2"
                  opacity="0.92"
                />
                {/* Hindwing */}
                <path
                  d="M58 56 C44 58 20 66 18 82 C16 96 36 102 46 90 C53 82 56 70 58 64 Z"
                  fill="url(#wingGradLeft)"
                  stroke="#ffe6a3"
                  strokeWidth="1"
                  opacity="0.85"
                />
                {/* Wing pattern veins / spots */}
                <path
                  d="M56 49 C42 38 28 32 18 38 M55 53 C38 48 24 52 18 60 M55 58 C38 66 28 78 26 86"
                  stroke="#fff6d6"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                <circle cx="24" cy="38" r="3" fill="#ffffff" opacity="0.8" />
                <circle cx="34" cy="48" r="2" fill="#ffffff" opacity="0.8" />
                <circle cx="28" cy="82" r="2.5" fill="#ffffff" opacity="0.8" />
              </g>

              {/* Right Wing Group with CSS 3D flap animation */}
              <g className="butterfly-wing-right" style={{ transformOrigin: '60px 58px' }}>
                {/* Forewing */}
                <path
                  d="M61 48 C68 28 96 16 110 32 C120 44 112 68 86 68 C74 68 64 60 61 54 Z"
                  fill="url(#wingGradRight)"
                  stroke="#ffe6a3"
                  strokeWidth="1.2"
                  opacity="0.92"
                />
                {/* Hindwing */}
                <path
                  d="M62 56 C76 58 100 66 102 82 C104 96 84 102 74 90 C67 82 64 70 62 64 Z"
                  fill="url(#wingGradRight)"
                  stroke="#ffe6a3"
                  strokeWidth="1"
                  opacity="0.85"
                />
                {/* Wing pattern veins / spots */}
                <path
                  d="M64 49 C78 38 92 32 102 38 M65 53 C82 48 96 52 102 60 M65 58 C82 66 92 78 94 86"
                  stroke="#fff6d6"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                <circle cx="96" cy="38" r="3" fill="#ffffff" opacity="0.8" />
                <circle cx="86" cy="48" r="2" fill="#ffffff" opacity="0.8" />
                <circle cx="92" cy="82" r="2.5" fill="#ffffff" opacity="0.8" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Elegant Atmospheric Text below */}
      <div
        className={`mt-8 text-center transition-all duration-700 ${
          stage === 'leave' || stage === 'done' ? 'opacity-0 translate-y-3' : 'opacity-80 translate-y-0'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="inline-block w-8 h-[1px] bg-gradient-to-r from-transparent to-[hsl(28_85%_62%)]" />
          <span className="text-sm tracking-[0.25em] text-[hsl(28_85%_62%)] font-light">
            天机集
          </span>
          <span className="inline-block w-8 h-[1px] bg-gradient-to-l from-transparent to-[hsl(28_85%_62%)]" />
        </div>
        <p className="text-xs text-white/50 tracking-wider">正在入画 · 即将相见</p>
      </div>

      {/* Embedded Styles for 3D Butterfly Flapping & Motion */}
      <style>{`
        @keyframes wingFlapLeft {
          0%, 100% {
            transform: scaleX(1) skewY(0deg);
          }
          50% {
            transform: scaleX(0.18) skewY(-8deg);
          }
        }

        @keyframes wingFlapRight {
          0%, 100% {
            transform: scaleX(1) skewY(0deg);
          }
          50% {
            transform: scaleX(0.18) skewY(8deg);
          }
        }

        @keyframes butterflyHover {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-8px) rotate(-3deg);
          }
          75% {
            transform: translateY(6px) rotate(3deg);
          }
        }

        .butterfly-wing-left {
          animation: wingFlapLeft 0.18s infinite ease-in-out;
        }

        .butterfly-wing-right {
          animation: wingFlapRight 0.18s infinite ease-in-out;
        }

        .butterfly-flight-motion {
          animation: butterflyHover 1.8s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
