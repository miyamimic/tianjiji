import { useState } from 'react';

export type Scene = 'welcome' | 'chat';

interface Hotspot {
  id: string;
  cx: number;        // 0..1 相对舞台宽度
  cy: number;        // 0..1 相对舞台高度
  label: string;     // 字母标识 A / B / C / ←
  color: string;     // 主色
  /** 光点上的 tooltip 标题（悬停显示，告诉用户这是什么） */
  title: string;
  /** 光点上的副标题/细节描述 */
  hint?: string;
  /** 点击光点直接触发的主动作 */
  onClick: () => void;
}

interface Props {
  scene: Scene;
  onEnterChat: () => void;
  onLeaveChat: () => void;
}

export default function HotspotLayer({ scene, onEnterChat, onLeaveChat }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const hotspots: Hotspot[] = scene === 'welcome'
    ? [
        {
          id: 'A',
          cx: 0.219, cy: 0.538,
          label: 'A',
          color: '#ffd36a',
          title: '交谈 / 开始',
          hint: '与酒保展开对话',
          onClick: onEnterChat,
        },
        {
          id: 'B',
          cx: 0.649, cy: 0.588,
          label: 'B',
          color: '#9fffc0',
          title: '点菜 · 品酒',
          hint: '点单或邀请品鉴',
          onClick: () => console.log('B: 点菜/品酒 (功能待接)'),
        },
        {
          id: 'C',
          cx: 0.472, cy: 0.681,
          label: 'C',
          color: '#9fd6ff',
          title: '更换酒保',
          hint: '切换另一位接待员',
          onClick: () => console.log('C: 更换酒保 (功能待接)'),
        },
      ]
    : [
        {
          id: 'back',
          cx: 0.8145, cy: 0.5185,
          label: '←',
          color: '#ffe9a8',
          title: '返回大厅',
          hint: '回到欢迎场景',
          onClick: onLeaveChat,
        },
      ];

  return (
    // z-40：必须高于 chat 消息区（z-20），否则点击会被空态 welcome 文案容器拦截
    <div className="pointer-events-none absolute inset-0 z-40 h-full w-full">
      {hotspots.map((hs) => (
        <HotspotItem
          key={hs.id}
          hs={hs}
          isHover={hoverId === hs.id}
          onEnter={() => setHoverId(hs.id)}
          onLeave={() => setHoverId((v) => (v === hs.id ? null : v))}
        />
      ))}
    </div>
  );
}

// ============ 单个光点：点击触发主动作，悬停显示轻量 tooltip ============
function HotspotItem({
  hs,
  isHover,
  onEnter,
  onLeave,
}: {
  hs: Hotspot;
  isHover: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: `${hs.cx * 100}%`,
        top: `${hs.cy * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={`${hs.title} · 互动光点 ${hs.label}`}
        onClick={(e) => { e.stopPropagation(); hs.onClick(); }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        className="block size-12 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-90 transition-transform"
      />

      {/* Tooltip — 悬停时浮在光点上方，只告诉你这是什么 */}
      {isHover && (
        <div
          className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-3 -translate-x-1/2 select-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: '50% 100%' }}
        >
          <div
            className="relative rounded-full border border-white/20 bg-[rgba(18,14,10,0.92)] px-3 py-1.5 shadow-2xl backdrop-blur-md"
            style={{
              boxShadow: `0 6px 24px rgba(0,0,0,0.45), 0 0 0 1px ${hs.color}33, 0 0 16px ${hs.color}22`,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-black"
                style={{ backgroundColor: hs.color, boxShadow: `0 0 8px ${hs.color}` }}
              >
                {hs.label}
              </span>
              <span className="text-[12px] font-semibold tracking-wide text-white">
                {hs.title}
              </span>
              {hs.hint && (
                <span className="text-[11px] text-white/40">· {hs.hint}</span>
              )}
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-1 size-2 rotate-45 bg-[rgba(18,14,10,0.92)] border-r border-b border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
