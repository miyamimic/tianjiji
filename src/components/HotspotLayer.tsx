import { useEffect, useRef, useState } from 'react';
import {
  BG_OBJECT_POS,
  BG_SIZE,
  computeCoverFit,
  type FitRect,
} from '@/lib/stageFit';

export type Scene = 'welcome' | 'chat';

interface Hotspot {
  id: string;
  /** 0..1 相对"背景图像素"的比例（蒙版坐标），不是相对舞台宽高 */
  u: number;
  v: number;
  label: string;
  color: string;
  title: string;
  hint?: string;
  onClick: () => void;
}

interface Props {
  scene: Scene;
  onEnterChat: () => void;
}

export default function HotspotLayer({ scene, onEnterChat }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitRect | null>(null);

  // ResizeObserver：容器尺寸/场景变化时重新计算 cover-fit 映射
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const bg = BG_SIZE[scene];
      const pos = BG_OBJECT_POS[scene];
      setFit(computeCoverFit(bg.w, bg.h, w, h, pos.x, pos.y));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [scene]);

  // 统一坐标源：蒙版导出的坐标是相对背景图像素比例 0..1
  const hotspots: Hotspot[] = scene === 'welcome'
    ? [
        {
          id: 'A',
          u: 0.219, v: 0.538,
          label: 'A',
          color: '#ffd36a',
          title: '交谈 / 开始',
          hint: '与酒保展开对话',
          onClick: onEnterChat,
        },
        {
          id: 'B',
          u: 0.649, v: 0.588,
          label: 'B',
          color: '#9fffc0',
          title: '点菜 · 品酒',
          hint: '点单或邀请品鉴',
          onClick: () => console.log('B: 点菜/品酒 (功能待接)'),
        },
        {
          id: 'C',
          u: 0.472, v: 0.681,
          label: 'C',
          color: '#9fd6ff',
          title: '更换酒保',
          hint: '切换另一位接待员',
          onClick: () => console.log('C: 更换酒保 (功能待接)'),
        },
      ]
    : [];

  return (
    // z-40：必须高于 chat 消息区（z-20），否则点击会被空态 welcome 文案容器拦截
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-40 h-full w-full">
      {fit && hotspots.map((hs) => {
        // 把"相对背景图"的 u/v 转换成"相对容器"的像素坐标，再转 %（方便 CSS 绝对定位）
        const p = fit.mapUV(hs.u, hs.v);
        const wrap = wrapRef.current;
        const W = wrap?.clientWidth ?? 1;
        const H = wrap?.clientHeight ?? 1;
        const pctX = (p.x / W) * 100;
        const pctY = (p.y / H) * 100;
        // 如果光点被裁出舞台，就不渲染（避免边缘外出现不可点击的 ghost 按钮）
        const hidden = p.x < 0 || p.y < 0 || p.x > W || p.y > H;
        if (hidden) return null;
        return (
          <HotspotItem
            key={hs.id}
            hs={hs}
            pctX={pctX}
            pctY={pctY}
            isHover={hoverId === hs.id}
            onEnter={() => setHoverId(hs.id)}
            onLeave={() => setHoverId((v) => (v === hs.id ? null : v))}
          />
        );
      })}
    </div>
  );
}

// ============ 单个光点：点击触发主动作，悬停显示轻量 tooltip ============
function HotspotItem({
  hs,
  pctX,
  pctY,
  isHover,
  onEnter,
  onLeave,
}: {
  hs: Hotspot;
  pctX: number;
  pctY: number;
  isHover: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: `${pctX}%`,
        top: `${pctY}%`,
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
        // 手机上光点略缩小至 size-10，避免挡住主体
        className="block size-10 sm:size-12 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-90 transition-transform"
      />

      {/* Tooltip — 悬停时浮在光点上方，只告诉你这是什么 */}
      {isHover && (
        <div
          className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 -translate-x-1/2 select-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
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
