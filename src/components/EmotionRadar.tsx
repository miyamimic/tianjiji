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

  // This round's current active emotion — pastel rose French style
  const currentPoints = EMOTION_LABELS.map((e, i) => {
    const value = Math.max(0, Math.min(1, emotion[e.key]));
    return pointOnRadius(i, radius * value);
  });
  const currentPolygon = currentPoints.map((p) => p.join(',')).join(' ');

  // The previous round's baseline emotion
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
          <polygon key={li} points={pts} fill="none" stroke="#f2d0d9" strokeWidth="1" strokeDasharray={li < levels - 1 ? '2 2' : 'none'} />
        );
      })}

      {/* Grid spokes */}
      {EMOTION_LABELS.map((_, i) => {
        const [x, y] = pointOnRadius(i, radius);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#f2d0d9" strokeWidth="1" />;
      })}

      {/* PREVIOUS emotion — transparent dashed */}
      {showDual && (
        <>
          <polygon
            points={prevPolygon}
            fill="rgba(242, 208, 217, 0.2)"
            stroke="#d494a8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeLinejoin="round"
          />
          {prevPoints.map(([x, y], i) => (
            <circle key={`prev-${i}`} cx={x} cy={y} r="2.5" fill="#d494a8" />
          ))}
        </>
      )}

      {/* CURRENT active emotion — French Pink/Rose fill with clean borders */}
      <polygon
        points={currentPolygon}
        fill="rgba(224, 122, 147, 0.28)"
        stroke="#e07a93"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {currentPoints.map(([x, y], i) => (
        <circle key={`curr-${i}`} cx={x} cy={y} r="3.5" fill="#e07a93" stroke="#ffffff" strokeWidth="1" />
      ))}

      {/* Axis labels */}
      {EMOTION_LABELS.map((e, i) => {
        const labelR = radius + (showDual ? 36 : 28);
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
            style={{ fontSize: '11px', fill: '#6e5653', fontFamily: 'serif', fontWeight: 600 }}
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}
