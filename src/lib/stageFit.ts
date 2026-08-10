// 复现浏览器 object-fit: cover + object-position 的行为。
// 给定：
//   - 背景图原始尺寸 bgW x bgH（欢迎图 2276x1280；聊天图 1793x1188）
//   - 舞台容器尺寸 sW x sH（横屏 16:9，竖屏 9:16）
//   - object-position 百分比 posX%, posY%
// 返回：
//   - scale: 图片被放大倍数（cover 的意思：取 scaleX / scaleY 大者）
//   - drawW / drawH: 图片绘制后的宽高 = bgW*scale x bgH*scale
//   - offX / offY: 图片左上角相对于舞台容器的偏移（像素，可为负，代表被裁掉部分）
//   - mapUV(u,v): 把"相对背景图的比例坐标 u,v ∈ [0,1]"
//                 映射成"舞台容器内的像素坐标 x,y"
//     这用于把蒙版提取的 cx/cy（都是相对背景图比例）定位到实际容器位置，
//     即使容器比例与图片不一致、使用了 cover 也能对齐。
//   - stageUVFromStageXY(x,y): 反向
export type FitRect = {
  scale: number;
  drawW: number;
  drawH: number;
  offX: number;
  offY: number;
  mapUV: (u: number, v: number) => { x: number; y: number };
  mapStageUV: (u: number, v: number) => { x: number; y: number };
};

export function computeCoverFit(
  bgW: number,
  bgH: number,
  sW: number,
  sH: number,
  posX: number = 50,
  posY: number = 50,
): FitRect {
  const scale = Math.max(sW / bgW, sH / bgH);
  const drawW = bgW * scale;
  const drawH = bgH * scale;
  // object-position 的百分比是同时作用于「图片剩余空间」和「容器剩余空间」。
  // 当图片比容器大（cover），offX / offY 为负，对应图片的某个百分比点与容器的同一百分比点对齐。
  const offX = (sW - drawW) * (posX / 100);
  const offY = (sH - drawH) * (posY / 100);
  return {
    scale,
    drawW,
    drawH,
    offX,
    offY,
    mapUV: (u, v) => ({
      x: offX + u * drawW,
      y: offY + v * drawH,
    }),
    mapStageUV: (u, v) => ({ x: u * sW, y: v * sH }),
  };
}

// 各场景背景图原始尺寸（单位：像素，GitHub 原图）
export const BG_SIZE: Record<'welcome' | 'chat', { w: number; h: number }> = {
  welcome: { w: 2276, h: 1280 }, // 16:9
  chat:    { w: 1793, h: 1188 }, // ~1.509 (3:2)
};

// 各场景在 portrait 模式下的 object-position（百分比）。
// 调参原则：保证 A/B/C / 钟表 / 返回光点（它们的蒙版坐标见 SceneCanvas 常量）
//          全部落在可视区域内，且"主体人物"尽量不被上下左右裁掉过多。
// landscape 下舞台比例 = 图片比例，object-position 无效果（不会被裁）
export const BG_OBJECT_POS: Record<'welcome' | 'chat', { x: number; y: number }> = {
  welcome: { x: 46, y: 62 },
  chat:    { x: 52, y: 38 },
};

// 舞台"模式"：横屏（按图片比例放，图片不裁切）vs 竖屏（铺满，图片 cover 但坐标映射补偿）
export function isPortraitViewport(sW: number, sH: number): boolean {
  return sH > sW;
}
