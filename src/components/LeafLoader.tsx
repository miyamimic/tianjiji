import { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

// 40x40 High-Density Pixel Art Green Leaf matrix with rich palette
// Colors:
// 0: transparent
// 1: #1a3318 (dark forest contour)
// 2: #244b20 (deep emerald shadow)
// 3: #326b2b (rich moss green)
// 4: #48933b (vibrant spring green)
// 5: #65be4c (bright leaf green)
// 6: #8ee06a (fresh sprout highlight)
// 7: #c2f796 (golden sunlight apex)
// 8: #e6ffc2 (vein highlight / dew point)
// 9: #a8df75 (vein line)
// A: #56331a (stem brown)
// B: #7a4c28 (stem light)

const PALETTE: Record<string, string> = {
  '1': '#132812',
  '2': '#1e3d1c',
  '3': '#2b5825',
  '4': '#3f7c32',
  '5': '#59a744',
  '6': '#7ecb62',
  '7': '#a7e88b',
  '8': '#d4ffb8',
  '9': '#8fd571',
  'A': '#4e2d14',
  'B': '#754722',
};

// 32x32 Dense Pixel Art Leaf Grid Map
const PIXEL_MAP: string[] = [
  "................................",
  "...................BB...........",
  "..................BAA...........",
  ".................BA1............",
  "................BA12............",
  "...............BA1235...........",
  "..............BA123456..........",
  ".............BA1234567..........",
  "............BA12345678..........",
  "...........BA123495678..........",
  "..........BA1234995678..........",
  ".........1123449955678..........",
  "........12334499556677..........",
  ".......123344995566776..........",
  "......1233444955667765..........",
  ".....12233449955667654..........",
  "....122334499556665543..........",
  "...1123344995556655432..........",
  "..12233449955565544321..........",
  "..1233449955555443321...........",
  "..123344955544433221............",
  "...1234495444332211.............",
  "....1234944332211...............",
  ".....1239332211.................",
  "......12392211..................",
  ".......123911...................",
  "........1291....................",
  ".........191....................",
  "..........1.....................",
  "................................",
  "................................",
  "................................",
];

export default function LeafLoader({ onComplete }: Props) {
  const [stage, setStage] = useState<'enter' | 'fall' | 'leave' | 'done'>('enter');
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; color: string }>>([]);

  useEffect(() => {
    // Generate magical floating green/golden aura dust
    const dots = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      y: 10 + Math.random() * 80,
      size: Math.random() * 3 + 1.5,
      delay: i * 0.08,
      color: i % 3 === 0 ? '#a7e88b' : i % 3 === 1 ? '#ffd36a' : '#d4ffb8',
    }));
    setSparkles(dots);

    const t1 = setTimeout(() => setStage('fall'), 200);
    const t2 = setTimeout(() => setStage('leave'), 1700);
    const t3 = setTimeout(() => {
      setStage('done');
      onComplete();
    }, 2200);

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
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-gradient-to-br from-emerald-500/15 via-lime-500/10 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: '2.5s' }}
        />
      </div>

      {/* Floating stardust along breeze path */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {sparkles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full animate-ping"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 8px ${p.color}`,
              animationDuration: '1.6s',
              animationDelay: `${p.delay}s`,
              animationIterationCount: 'infinite',
              opacity: stage === 'fall' ? 0.9 : 0.2,
            }}
          />
        ))}
      </div>

      {/* High-Density Pixel Art Falling Leaf Container */}
      <div
        className={`relative z-10 transition-all duration-1500 ease-out ${
          stage === 'enter'
            ? '-translate-y-36 translate-x-10 scale-90 opacity-0'
            : stage === 'fall'
            ? 'translate-y-0 translate-x-0 scale-105 opacity-100'
            : 'translate-y-36 -translate-x-12 scale-95 opacity-0'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        <div className="leaf-tumble-motion">
          {/* Dense High-Precision Pixel Art SVG (32x32 grid rendered crisply) */}
          <div className="relative w-36 h-36 flex items-center justify-center filter drop-shadow-[0_0_24px_rgba(110,225,90,0.55)]">
            <svg
              viewBox="0 0 32 32"
              className="w-full h-full"
              style={{ imageRendering: 'pixelated' }}
              shapeRendering="crispEdges"
              xmlns="http://www.w3.org/2000/svg"
            >
              {PIXEL_MAP.map((row, y) =>
                row.split('').map((char, x) => {
                  const color = PALETTE[char];
                  if (!color) return null;
                  return (
                    <rect
                      key={`${x}-${y}`}
                      x={x}
                      y={y}
                      width={1}
                      height={1}
                      fill={color}
                    />
                  );
                })
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Poetic Atmospheric Label */}
      <div
        className={`mt-10 text-center transition-all duration-700 ${
          stage === 'leave' || stage === 'done' ? 'opacity-0 translate-y-4' : 'opacity-90 translate-y-0'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="inline-block w-8 h-[1px] bg-gradient-to-r from-transparent to-emerald-400" />
          <span className="text-sm tracking-[0.3em] text-emerald-300 font-light drop-shadow-[0_0_8px_rgba(110,225,90,0.5)]">
            一叶入画
          </span>
          <span className="inline-block w-8 h-[1px] bg-gradient-to-l from-transparent to-emerald-400" />
        </div>
        <p className="text-xs text-white/50 tracking-wider">清风微拂 · 即刻相见</p>
      </div>

      {/* Keyframe Styles for Realistic Wind-Tumbling Leaf */}
      <style>{`
        @keyframes leafDriftAndTumble {
          0% {
            transform: rotate(-15deg) rotateY(0deg) translateY(-8px);
          }
          25% {
            transform: rotate(8deg) rotateY(45deg) translateX(12px) translateY(4px);
          }
          50% {
            transform: rotate(-10deg) rotateY(180deg) translateX(-10px) translateY(12px);
          }
          75% {
            transform: rotate(15deg) rotateY(135deg) translateX(8px) translateY(6px);
          }
          100% {
            transform: rotate(-15deg) rotateY(0deg) translateY(-8px);
          }
        }

        .leaf-tumble-motion {
          animation: leafDriftAndTumble 3.2s infinite ease-in-out;
          transform-origin: center center;
        }
      `}</style>
    </div>
  );
}
