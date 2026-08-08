import type { EmotionVector } from '../data/types';

interface Props {
  emotion: EmotionVector;
  previousEmotion?: EmotionVector;
  confirmed?: boolean;
  className?: string;
}

const EMOTION_LABELS: { key: keyof EmotionVector; label: string }[] = [
  { key: 'anger', label: '愤怒' },
  { key: 'fear', label: '恐惧' },
  { key: 'joy', label: '喜悦' },
  { key: 'sadness', label: '悲伤' },
  { key: 'desire', label: '欲望' },
  { key: 'warmth', label: '温情' },
];

export default function EmotionRadar({ emotion, previousEmotion, confirmed = true, className }: Props) {
  const size = 240;
  const center = size / 2;
  const radius = size * 0.32;
  const levels = 4;

  const anglePerAxis = (Math.PI * 2) / 6;
  const startAngle = -Math.PI / 2;

  function pointOnRadius(index: number, r: number): [number, number] {
    const angle = startAngle + anglePerAxis * index;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  }

  const hasPrevious = previousEmotion !== undefined;
  const showDual = hasPrevious && !confirmed;

  // This round's current active emotion — always solid yellow
  const currentPoints = EMOTION_LABELS.map((e, i) => {
    const value = Math.max(0, Math.min(1, emotion[e.key]));
    return pointOnRadius(i, radius * value);
  });
  const currentPolygon = currentPoints.map((p) => p.join(',')).join(' ');

  // The previous round's baseline emotion — white dashed transparent when dual-view
  const prevPoints = showDual
    ? EMOTION_LABELS.map((e, i) => {
        const value = Math.max(0, Math.min(1, previousEmotion![e.key]));
        return pointOnRadius(i, radius * value);
      })
    : [];
  const prevPolygon = prevPoints.map((p) => p.join(',')).join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className || 'w-full h-auto'}
      role="img"
      aria-label="六维情绪雷达图"
    >
      {/* Grid rings */}
      {Array.from({ length: levels }).map((_, li) => {
        const r = (radius * (li + 1)) / levels;
        const pts = EMOTION_LABELS.map((_, i) => pointOnRadius(i, r).join(',')).join(' ');
        return (
          <polygon key={li} points={pts} fill="none" stroke="hsl(217 12% 22%)" strokeWidth="1" />
        );
      })}

      {/* Grid spokes */}
      {EMOTION_LABELS.map((_, i) => {
        const [x, y] = pointOnRadius(i, radius);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="hsl(217 12% 22%)" strokeWidth="1" />;
      })}

      {/* PREVIOUS emotion — transparent white dashed hexagon underneath (only when dual) */}
      {showDual && (
        <>
          <polygon
            points={prevPolygon}
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
          {prevPoints.map(([x, y], i) => (
            <circle key={`prev-${i}`} cx={x} cy={y} r="2.5" fill="rgba(255,255,255,0.4)" />
          ))}
        </>
      )}

      {/* CURRENT active emotion — yellow hexagon (always solid, top level) */}
      <polygon
        points={currentPolygon}
        fill="hsl(48 90% 60% / 0.28)"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {currentPoints.map(([x, y], i) => (
        <circle key={`curr-${i}`} cx={x} cy={y} r="3.5" fill="#fbbf24" />
      ))}

      {/* Red/green delta labels on each changed axis (only when unconfirmed) */}
      {showDual &&
        EMOTION_LABELS.map((e, i) => {
          const oldVal = previousEmotion![e.key];
          const newVal = emotion[e.key];
          const diff = newVal - oldVal;
          if (Math.abs(diff) < 0.005) return null;

          const [px, py] = pointOnRadius(i, radius + 20);
          const isUp = diff > 0;
          const color = isUp ? '#ef4444' : '#22c55e';
          const sign = isUp ? '↑' : '↓';
          return (
            <text
              key={`delta-${e.key}`}
              x={px}
              y={py}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              style={{ fontSize: '10px', fontWeight: 700 }}
            >
              {sign}{Math.abs(diff).toFixed(2)}
            </text>
          );
        })}

      {/* Axis labels */}
      {EMOTION_LABELS.map((e, i) => {
        const labelR = radius + (showDual ? 36 : 30);
        const [x, y] = pointOnRadius(i, labelR);
        const angle = startAngle + anglePerAxis * i;
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angle) > 0.3) textAnchor = 'start';
        else if (Math.cos(angle) < -0.3) textAnchor = 'end';
        return (
          <text
            key={e.key}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            style={{ fontSize: '11px', fill: 'hsl(217 10% 55%)' }}
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}
