/**
 * drawAndGuessData.ts
 *
 * Question bank, AI character brush profiles, preset dialogue banks,
 * and pre-drawn stroke datasets (preDrawData) for Draw & Guess (你画我猜).
 */
import type { CharacterBrushParams, StrokeData } from '../lib/perfectFreehandHelper';

// -------------------------------------------------------------
// Category and Word Bank Definition
// -------------------------------------------------------------
export interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  words: {
    text: string;
    hints: string[];
  }[];
}

export const WORD_CATEGORIES: WordCategory[] = [
  {
    id: 'love',
    name: '恋爱主题',
    emoji: '💖',
    description: '甜蜜悸动、定情信物与浪漫心事',
    words: [
      { text: '爱心', hints: ['代表喜欢', '两瓣圆润', '红色的符号'] },
      { text: '玫瑰花', hints: ['带刺的植物', '情人节常送', '花语是爱情'] },
      { text: '情书', hints: ['写满心意', '装在信封里', '纸短情长'] },
      { text: '钻戒', hints: ['套在无名指', '闪闪发光', '承诺的象征'] },
      { text: '心锁', hints: ['挂在桥边', '需要钥匙开启', '锁住两颗心'] },
      { text: '拥抱', hints: ['温暖的肢体接触', '张开双臂', '融化孤单'] },
    ],
  },
  {
    id: 'animal',
    name: '可爱动物',
    emoji: '🐾',
    description: '毛茸茸与游水飞禽的可爱生灵',
    words: [
      { text: '小鱼', hints: ['生活在水里', '吐泡泡', '会摆动尾鳍'] },
      { text: '猫咪', hints: ['喵喵叫', '喜欢吃鱼', '长着胡须与尖耳朵'] },
      { text: '兔子', hints: ['长长的大耳朵', '红眼睛', '喜欢吃胡萝卜'] },
      { text: '小鸟', hints: ['长着翅膀', '站在枝头', '会叽叽喳喳唱歌'] },
      { text: '蝴蝶', hints: ['两扇斑斓的翅膀', '在花丛中飞舞', '由毛毛虫蜕变'] },
      { text: '企鹅', hints: ['住在南极', '走起路来摇摇晃晃', '穿黑白礼服'] },
    ],
  },
  {
    id: 'food',
    name: '美味食物',
    emoji: '🍰',
    description: '令人垂涎欲滴的珍馐与甜点',
    words: [
      { text: '苹果', hints: ['红彤彤的果实', '砸中牛顿', '带有一片绿叶'] },
      { text: '汉堡', hints: ['快餐主角', '两片面包夹肉和生菜', '多层结构'] },
      { text: '西瓜', hints: ['夏日解暑神器', '红瓤黑籽绿皮', '切成三角形'] },
      { text: '荷包蛋', hints: ['早餐常客', '金黄蛋黄在中间', '蛋白煎得嫩白'] },
      { text: '冰淇淋', hints: ['夏天甜品', '蛋筒托着球状冰霜', '会慢慢融化'] },
      { text: '甜甜圈', hints: ['中间有一个空心圆孔', '裹着彩色糖霜', '油炸面点'] },
    ],
  },
  {
    id: 'daily',
    name: '日常物品',
    emoji: '🎒',
    description: '生活里触手可及的各种陪伴小物',
    words: [
      { text: '太阳', hints: ['挂在天空', '带来光明与温暖', '散发耀眼光芒'] },
      { text: '雨伞', hints: ['下雨天撑开', '带有弯弯的手柄', '遮风挡雨'] },
      { text: '房子', hints: ['遮风避雨的家', '三角形屋顶', '有窗户与门'] },
      { text: '咖啡杯', hints: ['装热饮的瓷器', '带有侧边把手', '飘散袅袅热气'] },
      { text: '气球', hints: ['轻飘飘飞向空中', '系着一根细绳', '容易被针扎破'] },
      { text: '闹钟', hints: ['早晨叫你起床', '圆盘上有指针', '头顶有两个敲击铃铛'] },
    ],
  },
];

// -------------------------------------------------------------
// AI Character Brush Parameters & Dialogue System
// -------------------------------------------------------------
export interface AiArtistCharacter {
  id: string;
  name: string;
  avatar: string;
  title: string;
  tag: string;
  personality: string;
  brushParams: CharacterBrushParams;
  dialogues: {
    startDraw: string[];
    drawing: string[];
    finishDraw: string[];
    correctGuess: string[];
    wrongGuess: string[];
    playerTurn: string[];
    playerFinished: string[];
  };
}

export const AI_ARTISTS: AiArtistCharacter[] = [
  {
    id: 'char_001',
    name: '陆沉',
    avatar: '🍷',
    title: '艺术大师 · 沉着内敛',
    tag: '大师级画风',
    personality: '笔触沉稳流畅，分寸感极强，下笔如有神助。',
    brushParams: {
      thinning: 0.65,
      smoothing: 0.88,
      jitter: 0.03,
      taperStart: 18,
      taperEnd: 16,
      size: 9,
    },
    dialogues: {
      startDraw: [
        '“别眨眼，看着我怎么下第一笔。”',
        '“这道题很有意思，稍等片刻，我来描摹它的神韵。”',
        '“既然是你选的题目，那我自然不能怠慢。”',
      ],
      drawing: [
        '“轮廓渐渐分明了，你看出来了吗？”',
        '“这里收一笔，带点弧度会更好看。”',
        '“运笔需要耐心，就像品一杯好酒。”',
      ],
      finishDraw: [
        '“落笔完成了。来，猜猜看这画的是什么？”',
        '“已经画好了。以你的聪慧，应该一眼就能看破吧？”',
      ],
      correctGuess: [
        '“心有灵犀。完全正确，不愧是你。”',
        '“这么快就猜中了？看来我们的默契远超我的预期。”',
      ],
      wrongGuess: [
        '“差了一点分寸。别急，再仔细凝视一下线条。”',
        '“不太对呢。难道是我落笔太含蓄了么？”',
      ],
      playerTurn: [
        '“现在轮到你了。不必紧张，信马由缰地画，我都看得懂。”',
        '“把画板交给你。我很期待你笔下的线条。”',
      ],
      playerFinished: [
        '“这笔触很有灵气，即便没有言语，我也完全感受到了你的心意。”',
        '“画得极好，透着独属于你的温度。我猜到了，非常传神。”',
      ],
    },
  },
  {
    id: 'char_002',
    name: '阿野',
    avatar: '🐺',
    title: '狂野速写 · 激情随性',
    tag: '狂野写意派',
    personality: '下笔迅猛豪爽，线条充满力量感，略带不羁抖动。',
    brushParams: {
      thinning: 0.82,
      smoothing: 0.46,
      jitter: 0.28,
      taperStart: 8,
      taperEnd: 6,
      size: 11,
    },
    dialogues: {
      startDraw: [
        '“瞧好了！看小爷我分分钟给你整出一幅大作！”',
        '“简单！这玩意儿闭着眼睛我都能给你画出来！”',
      ],
      drawing: [
        '“刷刷几笔就来感觉了！”',
        '“哈哈，虽然线条飞了点，但灵魂绝对到位！”',
        '“这狂放的笔势，也就我能驾驭了！”',
      ],
      finishDraw: [
        '“大功告成！喂，这要是猜不出来，你可得罚一杯！”',
        '“搞定！瞪大眼睛好好猜！”',
      ],
      correctGuess: [
        '“哈哈！中了！我就说咱俩默契无敌吧！”',
        '“漂亮！我就知道你懂我画的是啥！”',
      ],
      wrongGuess: [
        '“哈？这怎么可能猜错？你再揉揉眼睛仔细看！”',
        '“啧，居然没猜对，明明画得这么霸气传神！”',
      ],
      playerTurn: [
        '“来来来，赶紧换你画！让我瞧瞧你的画技怎么样！”',
        '“别磨蹭，尽情在上面画，看我一秒给你识破！”',
      ],
      playerFinished: [
        '“卧槽！画得可以啊！这线条有两把刷子，我一眼就认出来了！”',
        '“牛！虽然带点可爱，但帅气值直接拉满！我服了！”',
      ],
    },
  },
  {
    id: 'char_003',
    name: '糊涂酱',
    avatar: '🐱',
    title: '灵魂画手 · 呆萌手残',
    tag: '手残灵魂派',
    personality: '手腕微微发抖，线条随缘起伏，全靠心意与真诚取胜。',
    brushParams: {
      thinning: 0.2,
      smoothing: 0.2,
      jitter: 0.72,
      taperStart: 2,
      taperEnd: 2,
      size: 10,
    },
    dialogues: {
      startDraw: [
        '“呜呜，手、手在抖……你先答应我不许笑话我哦QAQ”',
        '“我画啦！虽然我的画笔有自己的想法……”',
      ],
      drawing: [
        '“咦？奇怪，这条线怎么自己拐弯了……”',
        '“别看现在歪歪扭扭的，等下看整体！”',
        '“手抖不是我的错，是空气有阻力！”',
      ],
      finishDraw: [
        '“呼……画完了！虽然很抽象，但灵魂真的在里面！”',
        '“求求了，一定要猜出来呀，我画得好努力的！”',
      ],
      correctGuess: [
        '“天哪！！！这你都能猜中？！你是神仙吧！！！”',
        '“呜呜呜太感动了，你居然懂我的灵魂抽象画！抱抱！”',
      ],
      wrongGuess: [
        '“呜哇，果然还是太难辨认了么……对不起QAQ”',
        '“不对不对，差了一点点，再给我个机会再猜猜嘛~”',
      ],
      playerTurn: [
        '“耶！终于轮到你画了，快救救我的眼睛吧！”',
        '“你画你画！我一定会超级超级认真猜的！”',
      ],
      playerFinished: [
        '“哇塞！！！太好看了吧！简直是博物馆级别的大师作！”',
        '“比我画的好一亿倍！我猜到了，这也太传神太美了！”',
      ],
    },
  },
  {
    id: 'char_004',
    name: '桃桃',
    avatar: '🌸',
    title: '治愈插画 · 软萌纯真',
    tag: '治愈软萌风',
    personality: '画风圆润饱满，线条温柔细腻，充满阳光糖果色。',
    brushParams: {
      thinning: 0.35,
      smoothing: 0.82,
      jitter: 0.08,
      taperStart: 14,
      taperEnd: 12,
      size: 10,
    },
    dialogues: {
      startDraw: [
        '“轻轻落笔，给你画一个超可爱的东西哦~”',
        '“准备好咯，让色彩跳个舞吧~”',
      ],
      drawing: [
        '“画一个圆圆胖胖的弧度~”',
        '“再添上一点点细节，马上就生动起来了呢。”',
        '“粉粉嫩嫩的，是不是超级可爱？”',
      ],
      finishDraw: [
        '“好啦好啦！新鲜出炉的画作，快来猜猜看是什么吧！”',
        '“完成啦~猜中给送你一朵软绵绵的小红花哦！”',
      ],
      correctGuess: [
        '“哇！完全答对！送你大红花和甜甜的糖果！”',
        '“真聪明！我就知道难不倒可爱的你~”',
      ],
      wrongGuess: [
        '“嘻嘻，猜偏啦，不过思路很有趣哦，再猜一次吧~”',
        '“差一点点！提示你一下，想想生活里可爱的东西~”',
      ],
      playerTurn: [
        '“现在轮到你啦！画什么我都喜欢，大胆下笔吧~”',
        '“你的小画板已擦干净，期待你的画作！”',
      ],
      playerFinished: [
        '“好温馨治愈的笔画！我好喜欢呀，已经猜出是什么啦！”',
        '“软萌软萌的，我要把这幅画悄悄收藏在心底！”',
      ],
    },
  },
];

// Helper to generate smooth Catmull-Rom spline points between control anchors
function genSpline(anchors: [number, number][], numSteps = 16): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
    for (let step = 0; step < numSteps; step++) {
      const t = step / numSteps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      result.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
  }
  result.push(anchors[anchors.length - 1]);
  return result;
}

// -------------------------------------------------------------
// Pre-Drawn Stroke Dataset (preDrawData)
// Canvas pixel coordinate space: 520 x 380
// -------------------------------------------------------------
export const preDrawData: Record<string, StrokeData[]> = {
  // 1. 爱心 (Heart)
  爱心: [
    {
      points: genSpline([
        [260, 155], [235, 125], [195, 125], [170, 160], [175, 210], [215, 260], [260, 300]
      ], 20),
      color: '#F43F5E',
      duration: 650,
    },
    {
      points: genSpline([
        [260, 155], [285, 125], [325, 125], [350, 160], [345, 210], [305, 260], [260, 300]
      ], 20),
      color: '#F43F5E',
      duration: 650,
    },
    // Center glow / sparkle
    {
      points: genSpline([
        [205, 165], [215, 185], [230, 205]
      ], 12),
      color: '#FFE4E6',
      duration: 350,
    },
  ],

  // 2. 小鱼 (Fish)
  小鱼: [
    // Fish body outline
    {
      points: genSpline([
        [150, 190], [180, 140], [250, 130], [320, 160], [370, 190], [420, 145], [410, 190], [425, 235], [370, 190], [320, 225], [250, 245], [180, 235], [150, 190]
      ], 18),
      color: '#38BDF8',
      duration: 1100,
    },
    // Eye dot
    {
      points: [
        [200, 175], [202, 177], [202, 179], [200, 180], [198, 178], [200, 175]
      ],
      color: '#0F172A',
      duration: 250,
    },
    // Gill curve
    {
      points: genSpline([
        [235, 160], [245, 185], [235, 215]
      ], 12),
      color: '#0284C7',
      duration: 350,
    },
    // Water bubbles
    {
      points: genSpline([[125, 170], [130, 165], [125, 160], [120, 165], [125, 170]], 8),
      color: '#7DD3FC',
      duration: 250,
    },
    {
      points: genSpline([[105, 145], [112, 140], [105, 135], [98, 140], [105, 145]], 8),
      color: '#7DD3FC',
      duration: 250,
    },
  ],

  // 3. 猫咪 (Cat)
  猫咪: [
    // Head with ears outline
    {
      points: genSpline([
        [220, 140], [210, 100], [250, 125], [270, 125], [310, 100], [300, 140], [340, 170], [350, 230], [320, 275], [260, 285], [200, 275], [170, 230], [180, 170], [220, 140]
      ], 18),
      color: '#475569',
      duration: 1200,
    },
    // Left eye
    {
      points: genSpline([[220, 195], [228, 190], [236, 195]], 8),
      color: '#0F172A',
      duration: 200,
    },
    // Right eye
    {
      points: genSpline([[284, 195], [292, 190], [300, 195]], 8),
      color: '#0F172A',
      duration: 200,
    },
    // Nose triangle
    {
      points: genSpline([[255, 215], [265, 215], [260, 222], [255, 215]], 6),
      color: '#F43F5E',
      duration: 220,
    },
    // Mouth
    {
      points: genSpline([[260, 222], [260, 230], [250, 238]], 8),
      color: '#475569',
      duration: 200,
    },
    {
      points: genSpline([[260, 230], [270, 238]], 8),
      color: '#475569',
      duration: 200,
    },
    // Left whiskers
    {
      points: genSpline([[225, 220], [175, 215]], 8),
      color: '#94A3B8',
      duration: 180,
    },
    {
      points: genSpline([[225, 230], [170, 235]], 8),
      color: '#94A3B8',
      duration: 180,
    },
    // Right whiskers
    {
      points: genSpline([[295, 220], [345, 215]], 8),
      color: '#94A3B8',
      duration: 180,
    },
    {
      points: genSpline([[295, 230], [350, 235]], 8),
      color: '#94A3B8',
      duration: 180,
    },
  ],

  // 4. 太阳 (Sun)
  太阳: [
    // Center circle
    {
      points: genSpline([
        [260, 140], [305, 155], [325, 195], [305, 235], [260, 250], [215, 235], [195, 195], [215, 155], [260, 140]
      ], 16),
      color: '#F59E0B',
      duration: 850,
    },
    // Top ray
    {
      points: genSpline([[260, 125], [260, 90]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Bottom ray
    {
      points: genSpline([[260, 265], [260, 300]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Left ray
    {
      points: genSpline([[180, 195], [145, 195]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Right ray
    {
      points: genSpline([[340, 195], [375, 195]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Top-right ray
    {
      points: genSpline([[315, 145], [345, 120]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Bottom-right ray
    {
      points: genSpline([[315, 245], [345, 270]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Bottom-left ray
    {
      points: genSpline([[205, 245], [175, 270]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Top-left ray
    {
      points: genSpline([[205, 145], [175, 120]], 8),
      color: '#FBBF24',
      duration: 180,
    },
    // Cute smile face inside sun
    {
      points: genSpline([[235, 205], [260, 220], [285, 205]], 10),
      color: '#D97706',
      duration: 300,
    },
  ],

  // 5. 苹果 (Apple)
  苹果: [
    // Apple outline
    {
      points: genSpline([
        [260, 175], [225, 155], [185, 170], [170, 220], [185, 275], [230, 310], [260, 300], [290, 310], [335, 275], [350, 220], [335, 170], [295, 155], [260, 175]
      ], 18),
      color: '#EF4444',
      duration: 1100,
    },
    // Apple stem
    {
      points: genSpline([
        [260, 175], [262, 145], [270, 125]
      ], 10),
      color: '#78350F',
      duration: 300,
    },
    // Green leaf
    {
      points: genSpline([
        [265, 140], [290, 120], [315, 130], [290, 145], [265, 140]
      ], 12),
      color: '#22C55E',
      duration: 400,
    },
  ],

  // 6. 雨伞 (Umbrella)
  雨伞: [
    // Umbrella canopy arc
    {
      points: genSpline([
        [150, 200], [180, 140], [260, 115], [340, 140], [370, 200]
      ], 18),
      color: '#EC4899',
      duration: 750,
    },
    // Umbrella bottom scalloped edges
    {
      points: genSpline([
        [150, 200], [185, 190], [220, 200], [260, 190], [300, 200], [335, 190], [370, 200]
      ], 18),
      color: '#EC4899',
      duration: 650,
    },
    // Umbrella top spike
    {
      points: genSpline([[260, 115], [260, 95]], 6),
      color: '#64748B',
      duration: 180,
    },
    // Umbrella handle
    {
      points: genSpline([
        [260, 190], [260, 275], [250, 295], [230, 285], [235, 270]
      ], 16),
      color: '#64748B',
      duration: 600,
    },
    // Raindrops
    {
      points: genSpline([[130, 230], [125, 255]], 6),
      color: '#38BDF8',
      duration: 150,
    },
    {
      points: genSpline([[390, 230], [395, 255]], 6),
      color: '#38BDF8',
      duration: 150,
    },
  ],

  // 7. 汉堡 (Burger)
  汉堡: [
    // Top bun dome
    {
      points: genSpline([
        [170, 180], [195, 130], [260, 115], [325, 130], [350, 180], [170, 180]
      ], 18),
      color: '#D97706',
      duration: 800,
    },
    // Sesame seeds
    {
      points: genSpline([[230, 145], [235, 145]], 4),
      color: '#FEF3C7',
      duration: 120,
    },
    {
      points: genSpline([[265, 135], [270, 135]], 4),
      color: '#FEF3C7',
      duration: 120,
    },
    {
      points: genSpline([[290, 150], [295, 150]], 4),
      color: '#FEF3C7',
      duration: 120,
    },
    // Lettuce wavy green
    {
      points: genSpline([
        [160, 190], [185, 205], [215, 190], [245, 205], [275, 190], [305, 205], [335, 190], [360, 195]
      ], 18),
      color: '#22C55E',
      duration: 500,
    },
    // Cheese slice triangle
    {
      points: genSpline([
        [170, 208], [230, 212], [250, 235], [270, 212], [350, 208]
      ], 16),
      color: '#FACC15',
      duration: 400,
    },
    // Meat patty
    {
      points: genSpline([
        [170, 222], [350, 222], [345, 245], [175, 245], [170, 222]
      ], 16),
      color: '#78350F',
      duration: 550,
    },
    // Bottom bun
    {
      points: genSpline([
        [175, 252], [345, 252], [335, 275], [260, 280], [185, 275], [175, 252]
      ], 16),
      color: '#D97706',
      duration: 650,
    },
  ],

  // 8. 玫瑰花 (Rose)
  玫瑰花: [
    // Center spiral
    {
      points: genSpline([
        [260, 150], [270, 140], [280, 150], [270, 165], [250, 160], [240, 140], [260, 125], [290, 135], [295, 165], [270, 185], [235, 175]
      ], 20),
      color: '#E11D48',
      duration: 850,
    },
    // Outer petals
    {
      points: genSpline([
        [220, 160], [240, 195], [280, 195], [300, 160]
      ], 14),
      color: '#BE123C',
      duration: 500,
    },
    // Flower stem
    {
      points: genSpline([
        [260, 195], [258, 240], [265, 285], [260, 320]
      ], 16),
      color: '#15803D',
      duration: 600,
    },
    // Left leaf
    {
      points: genSpline([
        [260, 245], [225, 235], [210, 250], [235, 260], [260, 255]
      ], 14),
      color: '#16A34A',
      duration: 450,
    },
    // Right leaf
    {
      points: genSpline([
        [263, 275], [295, 265], [315, 280], [290, 290], [263, 285]
      ], 14),
      color: '#16A34A',
      duration: 450,
    },
  ],

  // 9. 情书 (Love Letter)
  情书: [
    // Envelope rectangular body
    {
      points: genSpline([
        [160, 150], [360, 150], [360, 270], [160, 270], [160, 150]
      ], 18),
      color: '#FDE047',
      duration: 800,
    },
    // Envelope fold flap (open / closed)
    {
      points: genSpline([
        [160, 150], [260, 215], [360, 150]
      ], 14),
      color: '#CA8A04',
      duration: 500,
    },
    // Bottom fold creases
    {
      points: genSpline([[160, 270], [230, 215]], 10),
      color: '#CA8A04',
      duration: 300,
    },
    {
      points: genSpline([[360, 270], [290, 215]], 10),
      color: '#CA8A04',
      duration: 300,
    },
    // Wax seal heart
    {
      points: genSpline([
        [260, 210], [250, 198], [240, 205], [240, 218], [260, 230], [280, 218], [280, 205], [270, 198], [260, 210]
      ], 16),
      color: '#EF4444',
      duration: 450,
    },
  ],

  // 10. 房子 (House)
  房子: [
    // Triangular roof
    {
      points: genSpline([
        [160, 180], [260, 110], [360, 180], [160, 180]
      ], 18),
      color: '#EF4444',
      duration: 750,
    },
    // Chimney
    {
      points: genSpline([
        [310, 140], [310, 105], [330, 105], [330, 155]
      ], 12),
      color: '#78350F',
      duration: 350,
    },
    // Chimney smoke
    {
      points: genSpline([
        [320, 95], [330, 85], [325, 75], [340, 65]
      ], 10),
      color: '#94A3B8',
      duration: 300,
    },
    // House rectangular base
    {
      points: genSpline([
        [180, 180], [340, 180], [340, 290], [180, 290], [180, 180]
      ], 18),
      color: '#3B82F6',
      duration: 800,
    },
    // Front door
    {
      points: genSpline([
        [240, 290], [240, 230], [280, 230], [280, 290]
      ], 14),
      color: '#78350F',
      duration: 450,
    },
    // Door knob
    {
      points: [[248, 260], [250, 260]],
      color: '#FACC15',
      duration: 100,
    },
    // Window
    {
      points: genSpline([
        [200, 205], [225, 205], [225, 230], [200, 230], [200, 205]
      ], 12),
      color: '#38BDF8',
      duration: 350,
    },
  ],

  // 11. 西瓜 (Watermelon)
  西瓜: [
    // Green outer rind crescent
    {
      points: genSpline([
        [150, 180], [185, 270], [260, 290], [335, 270], [370, 180]
      ], 18),
      color: '#16A34A',
      duration: 750,
    },
    // White inner rind
    {
      points: genSpline([
        [155, 182], [188, 260], [260, 280], [332, 260], [365, 182]
      ], 18),
      color: '#E2E8F0',
      duration: 550,
    },
    // Red flesh top flat line
    {
      points: genSpline([[150, 180], [370, 180]], 12),
      color: '#F43F5E',
      duration: 400,
    },
    // Seeds
    {
      points: [[210, 210], [212, 215]],
      color: '#0F172A',
      duration: 120,
    },
    {
      points: [[255, 230], [257, 235]],
      color: '#0F172A',
      duration: 120,
    },
    {
      points: [[305, 210], [307, 215]],
      color: '#0F172A',
      duration: 120,
    },
    {
      points: [[260, 200], [262, 205]],
      color: '#0F172A',
      duration: 120,
    },
  ],

  // 12. 咖啡杯 (Coffee Cup)
  咖啡杯: [
    // Cup body
    {
      points: genSpline([
        [190, 170], [330, 170], [315, 255], [205, 255], [190, 170]
      ], 18),
      color: '#64748B',
      duration: 800,
    },
    // Cup handle
    {
      points: genSpline([
        [325, 185], [365, 185], [365, 230], [318, 235]
      ], 16),
      color: '#64748B',
      duration: 450,
    },
    // Saucer dish
    {
      points: genSpline([
        [165, 265], [260, 275], [355, 265]
      ], 14),
      color: '#94A3B8',
      duration: 400,
    },
    // Aroma steam 1
    {
      points: genSpline([
        [230, 155], [225, 135], [235, 115]
      ], 10),
      color: '#CBD5E1',
      duration: 250,
    },
    // Aroma steam 2
    {
      points: genSpline([
        [260, 155], [265, 130], [255, 105]
      ], 10),
      color: '#CBD5E1',
      duration: 250,
    },
    // Aroma steam 3
    {
      points: genSpline([
        [290, 155], [285, 135], [295, 115]
      ], 10),
      color: '#CBD5E1',
      duration: 250,
    },
  ],

  // 13. 钻戒 (Diamond Ring)
  钻戒: [
    // Diamond gem facets
    {
      points: genSpline([
        [235, 150], [285, 150], [310, 175], [260, 215], [210, 175], [235, 150]
      ], 18),
      color: '#38BDF8',
      duration: 800,
    },
    // Diamond top facet line
    {
      points: genSpline([[210, 175], [310, 175]], 10),
      color: '#BAE6FD',
      duration: 250,
    },
    // Diamond facet downward lines
    {
      points: genSpline([[235, 150], [260, 215]], 10),
      color: '#0284C7',
      duration: 250,
    },
    {
      points: genSpline([[285, 150], [260, 215]], 10),
      color: '#0284C7',
      duration: 250,
    },
    // Gold ring loop
    {
      points: genSpline([
        [235, 205], [200, 235], [200, 275], [260, 305], [320, 275], [320, 235], [285, 205]
      ], 18),
      color: '#F59E0B',
      duration: 900,
    },
    // Sparkle star
    {
      points: genSpline([[325, 140], [325, 160]], 6),
      color: '#FDE047',
      duration: 150,
    },
    {
      points: genSpline([[315, 150], [335, 150]], 6),
      color: '#FDE047',
      duration: 150,
    },
  ],

  // 14. 兔子 (Rabbit)
  兔子: [
    // Head outline
    {
      points: genSpline([
        [220, 190], [260, 175], [300, 190], [320, 230], [305, 275], [260, 290], [215, 275], [200, 230], [220, 190]
      ], 18),
      color: '#475569',
      duration: 900,
    },
    // Left ear
    {
      points: genSpline([
        [225, 190], [205, 115], [225, 95], [240, 115], [245, 180]
      ], 16),
      color: '#475569',
      duration: 550,
    },
    // Left ear pink inside
    {
      points: genSpline([
        [220, 165], [218, 125], [230, 115], [235, 155]
      ], 10),
      color: '#FDA4AF',
      duration: 300,
    },
    // Right ear
    {
      points: genSpline([
        [275, 180], [280, 115], [295, 95], [315, 115], [295, 190]
      ], 16),
      color: '#475569',
      duration: 550,
    },
    // Right ear pink inside
    {
      points: genSpline([
        [285, 155], [290, 115], [302, 125], [300, 165]
      ], 10),
      color: '#FDA4AF',
      duration: 300,
    },
    // Eyes
    {
      points: [[235, 225], [237, 227]],
      color: '#F43F5E',
      duration: 100,
    },
    {
      points: [[285, 225], [287, 227]],
      color: '#F43F5E',
      duration: 100,
    },
    // Pink nose
    {
      points: genSpline([[255, 245], [265, 245], [260, 252], [255, 245]], 6),
      color: '#FB7185',
      duration: 200,
    },
  ],

  // 15. 气球 (Balloon)
  气球: [
    // Balloon oval
    {
      points: genSpline([
        [260, 110], [315, 130], [335, 185], [310, 245], [265, 265], [255, 265], [210, 245], [185, 185], [205, 130], [260, 110]
      ], 18),
      color: '#EC4899',
      duration: 950,
    },
    // Balloon knot triangle
    {
      points: genSpline([
        [250, 265], [270, 265], [260, 275], [250, 265]
      ], 8),
      color: '#BE185D',
      duration: 200,
    },
    // Wavy string
    {
      points: genSpline([
        [260, 275], [255, 295], [268, 315], [258, 335], [262, 355]
      ], 14),
      color: '#94A3B8',
      duration: 500,
    },
    // Highlight reflection
    {
      points: genSpline([
        [220, 155], [225, 180]
      ], 8),
      color: '#FCE7F3',
      duration: 200,
    },
  ],

  // 16. 荷包蛋 (Fried Egg)
  荷包蛋: [
    // Irregular egg white outline
    {
      points: genSpline([
        [170, 195], [205, 140], [280, 135], [345, 160], [365, 220], [340, 270], [265, 285], [195, 270], [165, 225], [170, 195]
      ], 20),
      color: '#F1F5F9',
      duration: 1000,
    },
    // Egg yolk round center
    {
      points: genSpline([
        [260, 180], [290, 190], [300, 215], [285, 240], [255, 245], [230, 230], [225, 205], [240, 185], [260, 180]
      ], 16),
      color: '#F59E0B',
      duration: 750,
    },
    // Yolk highlight
    {
      points: genSpline([
        [245, 195], [255, 192], [262, 196]
      ], 8),
      color: '#FEF3C7',
      duration: 200,
    },
  ],
};

// -------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------

/**
 * Check if the target word has pre-drawn stroke data
 */
export function hasPreDrawData(word: string): boolean {
  if (!word) return false;
  const clean = word.trim();
  return Boolean(preDrawData[clean]);
}

/**
 * Retrieve stroke list for a given word
 */
export function getPreDrawData(word: string): StrokeData[] | null {
  if (!word) return null;
  const clean = word.trim();
  return preDrawData[clean] || null;
}

/**
 * Randomly pick a word from category or across all categories
 */
export function getRandomWord(categoryId?: string): { word: string; category: string; hints: string[] } {
  let catList = WORD_CATEGORIES;
  if (categoryId && categoryId !== 'all') {
    catList = WORD_CATEGORIES.filter((c) => c.id === categoryId);
    if (catList.length === 0) catList = WORD_CATEGORIES;
  }
  const randomCat = catList[Math.floor(Math.random() * catList.length)];
  const randomItem = randomCat.words[Math.floor(Math.random() * randomCat.words.length)];
  return {
    word: randomItem.text,
    category: randomCat.name,
    hints: randomItem.hints,
  };
}

/**
 * Find AI artist profile by character id or fallback to Lu Chen
 */
export function getAiArtistById(charId?: string): AiArtistCharacter {
  if (!charId) return AI_ARTISTS[0];
  const found = AI_ARTISTS.find((a) => a.id === charId);
  return found || AI_ARTISTS[0];
}
