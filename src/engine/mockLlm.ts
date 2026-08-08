import type { Character, EmotionVector, IntentAnalysis, MessageSegment } from '../data/types';
import { describeEmotion, dominantEmotions } from './emotion';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
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
  const control = pick(at.control_actions);
  const touch = pick(at.touch_actions);
  return { control, touch };
}

function generateThought(
  emotion: EmotionVector,
  intent: IntentAnalysis,
): string {
  const dom = dominantEmotions(emotion, 1);
  const top = dom.length > 0 ? dom[0][0] : 'neutral';

  const thoughts: Record<string, string[]> = {
    anger: ['眼神暗了暗', '下颌线绷紧了', '手指攥了一下'],
    fear: ['心跳漏了一拍', '呼吸微乱', '指尖不自觉地收紧'],
    joy: ['嘴角微不可察地弯了一下', '眼底有了点温度', '心里松了松'],
    sadness: ['沉默了一会儿', '移开了视线', '喉结动了动'],
    desire: ['目光沉了沉', '喉结滚了一下', '呼吸压低了'],
    warmth: ['目光柔和下来', '动作放轻了', '心里软了一块'],
    neutral: ['垂下眼想了想', '微微偏了偏头', '抿了一下唇'],
  };

  if (intent.intent === 'refuse') return pick(['没打算松手', '不打算让你走', '更想按住了']);
  if (intent.intent === 'affection') return pick(['心里被挠了一下', '有点没防住', '耳朵有点热']);

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

  const emotionDesc = describeEmotion(emotion);

  const variants = [
    `*${control}*\n${speech}\n（${thought}）`,
    `${speech}\n*${touch}*\n（${thought}）`,
    `*${control}*，${speech}\n*${touch}*\n（${thought}）`,
    `${speech}\n（${thought}）\n*${touch}*`,
  ];

  let reply = pick(variants);

  if (emotion.anger > 0.7) {
    reply = `*${control}*\n${speech}\n（${thought}）`;
  } else if (emotion.warmth > 0.6 && emotion.desire > 0.5) {
    reply = `${speech}\n*${touch}*\n（${thought}）\n*${control}*`;
  }

  return reply;
}
