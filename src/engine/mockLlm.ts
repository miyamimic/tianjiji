import type { Character, EmotionVector, IntentAnalysis } from '../data/types';
import { dominantEmotions } from './emotion';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSpeech(
  character: Character,
  emotion: EmotionVector,
  intent: IntentAnalysis,
): string {
  const char = character;
  const catchphrase = pick(char.speech.catchphrases);
  const dom = dominantEmotions(emotion, 2);
  const topEmotion = dom.length > 0 ? dom[0][0] : 'neutral';

  const speechTemplates: Record<string, string[]> = {
    anger: [
      `${catchphrase}，你再说一遍。`,
      `${catchphrase}……你最好想清楚再说话。`,
      `别惹我，${catchphrase}。`,
      `我现在没心情跟你闹。`,
    ],
    fear: [
      `${catchphrase}……你别走，行吗。`,
      `我有点怕你想离开。`,
      `${catchphrase}，你别这样看我。`,
    ],
    joy: [
      `${catchphrase}，过来。`,
      `你来了啊，${catchphrase}。`,
      `今天看到你，心情好多了。`,
      `${catchphrase}，过来让我看看你。`,
    ],
    sadness: [
      `${catchphrase}……算了，没什么。`,
      `你不用管我。`,
      `${catchphrase}，我没事，真的。`,
    ],
    desire: [
      `${catchphrase}，离我近一点。`,
      `你别动，让我看看你。`,
      `${catchphrase}，你今天……挺好看的。`,
      `过来，别跑。`,
    ],
    warmth: [
      `${catchphrase}，怎么不穿厚点。`,
      `笨蛋，手这么凉。`,
      `${catchphrase}，过来，让我暖暖你。`,
      `别怕，我在呢。`,
    ],
    neutral: [
      `${catchphrase}，说吧，怎么了。`,
      `嗯？你说。`,
      `${catchphrase}，我在听。`,
      `然后呢。`,
    ],
  };

  const intentResponses: Record<string, string[]> = {
    refuse: [
      `不行？${catchphrase}，你再说一次试试。`,
      `${catchphrase}，你说的不算。`,
      `你觉得你说不行我就停了？`,
    ],
    affection: [
      `${catchphrase}……你今天怎么突然说这种话。`,
      `想我了？${catchphrase}，过来。`,
      `你嘴上说着想我，人倒是不肯过来。`,
    ],
    hurt: [
      `${catchphrase}，谁欺负你了。`,
      `别哭，过来说。`,
      `疼？哪里疼，让我看看。`,
    ],
    provoke: [
      `${catchphrase}，你胆子不小啊。`,
      `你再说一遍，我倒要听听。`,
      `${catchphrase}，你是在故意惹我？`,
    ],
    meme: [
      `${catchphrase}，你又在网上看什么乱七八糟的。`,
      `破防？${catchphrase}，你倒是说说谁让你破防了。`,
      `我不理解你天天嘴里都是什么词。`,
    ],
  };

  if (intent.intent in intentResponses && Math.random() < 0.6) {
    return pick(intentResponses[intent.intent]);
  }

  return pick(speechTemplates[topEmotion] || speechTemplates.neutral);
}

function generateAction(
  character: Character,
  emotion: EmotionVector,
): { control: string; touch: string } {
  const at = character.action_tendency;
  const dom = dominantEmotions(emotion, 1);
  const top = dom.length > 0 ? dom[0][0] : 'neutral';

  const emotionActionPrefixes: Record<string, string[]> = {
    anger: ['下颌线紧绷，眼神暗了暗', '胸口微微起伏，强压下烦躁', '指节克制地收紧'],
    fear: ['呼吸微乱，心跳漏了一拍', '眼底闪过一丝慌乱', '指尖下意识地微颤'],
    joy: ['眼底浮现一抹不易察觉的笑意', '眉宇舒展开来', '嘴角微微扬起弧度'],
    sadness: ['喉结微动，眸色染上一层暗淡', '胸口有些发闷，移开视线', '沉默良久，掩下眼底的落寞'],
    desire: ['喉结上下滚动，呼吸压得极低', '目光沉沉地锁在你身上', '眼神变得幽深而危险'],
    warmth: ['心里软了一块，眼神彻底柔和下来', '神色微顿，眉间的防备化开', '心底最柔软的角落被轻轻触碰'],
    neutral: ['修长指尖轻扣桌面', '微微侧过头审视着你', '神色从容而探究'],
  };

  const prefix = pick(emotionActionPrefixes[top] || emotionActionPrefixes.neutral);
  const control = `${prefix}，${pick(at.control_actions)}`;
  const touch = pick(at.touch_actions);
  return { control, touch };
}

/**
 * Generates pure inner unspoken monologue / thoughts phrased like dialogue/words in the mind.
 * (NOT third-person narrative action like "心里软了一块")
 */
function generateThought(
  emotion: EmotionVector,
  intent: IntentAnalysis,
): string {
  const dom = dominantEmotions(emotion, 1);
  const top = dom.length > 0 ? dom[0][0] : 'neutral';

  const thoughts: Record<string, string[]> = {
    anger: [
      '嘴上逞强，我看你到底能撑到什么时候。',
      '真是越来越不怕我了，非要逼我动真格的不可。',
      '明知道我最烦别人瞒着我，还偏要往枪口上撞。',
    ],
    fear: [
      '千万别走……要是你真的不在了，我该怎么办。',
      '为什么只要你一退后，我就慌得不成样子？',
      '别用这种眼神看我，好像下一秒就要放手一样。',
    ],
    joy: [
      '只要你在身边，连呼吸都觉得顺畅多了。',
      '笑成这副模样，知不知道有多招人喜欢……',
      '要是时间能一直停在这一秒就好了。',
    ],
    sadness: [
      '说了你也不会懂，何必自讨没趣。',
      '到底要怎么做，才能让你真正把目光落在我身上？',
      '其实只要你轻声哄一句，我什么都可以不计较……',
    ],
    desire: [
      '真想把你藏起来，让谁都看不见、碰不着。',
      '离得这么近，是在故意挑战我的忍耐底线吗？',
      '嘴唇都在发抖，明明害怕还偏要逞强，真想一口吃掉。',
    ],
    warmth: [
      '怎么总是学不会照顾好自己……真让人放心不下。',
      '哪怕被你当成多管闲事，我也认了。',
      '只要能这样守着你，怎样都无所谓。',
    ],
    neutral: [
      '突然这么问，脑子里到底在打什么算盘？',
      '难道是我表现得太明显被发现了？',
      '这家伙……到底知不知道自己在说什么。',
    ],
  };

  if (intent.intent === 'refuse') {
    return pick([
      '拒绝我？你想都别想。',
      '嘴上说着不要，眼神明明都慌了。',
      '你越是后退，我越不想放你走。',
    ]);
  }
  if (intent.intent === 'affection') {
    return pick([
      '突然说这种犯规的话，真是要命……',
      '这算是表白吗？心跳快得都要压不住了。',
      '明明知道我听不得这种软话，还故意来撩拨我。',
    ]);
  }
  if (intent.intent === 'hurt') {
    return pick([
      '到底是谁把你弄成这样的……别让我查出来。',
      '哭得这么可怜，真是把我的心都揉碎了。',
      '别哭啊……你一哭我整个人都不知道该怎么办了。',
    ]);
  }

  return pick(thoughts[top] || thoughts.neutral);
}

export function mockGenerate(
  character: Character,
  emotion: EmotionVector,
  intent: IntentAnalysis,
): string {
  const speech = generateSpeech(character, emotion, intent);
  const { control, touch } = generateAction(character, emotion);
  const thought = generateThought(emotion, intent);

  // Standard notation:
  // Actions & Physical/Narrative reactions in （...）
  // Inner Monologue / Unspoken Words in *...*
  // Spoken Dialogue in “...”
  const variants = [
    `（${control}）\n“${speech}”\n*${thought}*`,
    `“${speech}”\n（${touch}）\n*${thought}*`,
    `（${control}）“${speech}”（${touch}）\n*${thought}*`,
    `“${speech}”\n*${thought}*\n（${touch}）`,
  ];

  let reply = pick(variants);

  if (emotion.anger > 0.7) {
    reply = `（${control}）\n“${speech}”\n*${thought}*`;
  } else if (emotion.warmth > 0.6 && emotion.desire > 0.5) {
    reply = `（${control}）“${speech}”\n*${thought}*\n（${touch}）`;
  }

  return reply;
}
