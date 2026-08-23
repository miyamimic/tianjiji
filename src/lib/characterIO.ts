import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ShadingType } from 'docx';
import JSZip from 'jszip';
import type { Character, InstinctBase, SpeechFilter } from '../data/types';
import { 
  loadCharAvatar, 
  loadCharVisualDesc, 
  loadCharMinBubbles, 
  loadCharGomokuRank,
  saveCharacterEdit,
  saveCharAvatar,
  saveCharVisualDesc,
  saveCharMinBubbles,
  saveCharGomokuRank
} from './customStore';

/**
 * Utility to download blob in browser
 */
export function downloadFile(content: Blob | string, filename: string, mimeType: string = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export Character to JSON
 */
export function exportCharacterToJson(char: Character): void {
  const avatar = loadCharAvatar(char.character_id);
  const visualDesc = loadCharVisualDesc(char.character_id);
  const minBubbles = loadCharMinBubbles(char.character_id);
  const gomokuRank = loadCharGomokuRank(char.character_id);

  const payload = {
    version: '2.0',
    exported_at: new Date().toISOString(),
    character: {
      ...char,
      _extra: {
        avatar,
        visual_desc: visualDesc,
        min_bubbles: minBubbles,
        gomoku_rank: gomokuRank
      }
    }
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `${char.name.replace(/[\\/:*?"<>|]/g, '_')}_角色档案.json`, 'application/json;charset=utf-8');
}

/**
 * 2. Export All Characters to JSON Bundle
 */
export function exportAllCharactersToJson(characters: Character[]): void {
  const bundle = characters.map(char => {
    const avatar = loadCharAvatar(char.character_id);
    const visualDesc = loadCharVisualDesc(char.character_id);
    const minBubbles = loadCharMinBubbles(char.character_id);
    const gomokuRank = loadCharGomokuRank(char.character_id);

    return {
      ...char,
      _extra: {
        avatar,
        visual_desc: visualDesc,
        min_bubbles: minBubbles,
        gomoku_rank: gomokuRank
      }
    };
  });

  const payload = {
    version: '2.0',
    type: 'character_bundle',
    exported_at: new Date().toISOString(),
    total_characters: bundle.length,
    characters: bundle
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `角色全套档案合集_${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8');
}

/**
 * 3. Export Character to Word (.docx) Document
 */
export async function exportCharacterToDocx(char: Character): Promise<void> {
  const visualDesc = loadCharVisualDesc(char.character_id);
  const minBubbles = loadCharMinBubbles(char.character_id);
  const gomokuRank = loadCharGomokuRank(char.character_id);
  const customPrompt = (char as any).custom_system_prompt || '';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: `角色核心档案 Dossier · ${char.name}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 150 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `生成时间：${new Date().toLocaleString('zh-CN')} | 导出系统：Roleplay Engine 灵犀风铃`,
                italics: true,
                color: '666666',
                size: 20,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // Section 1: Basic Table
          new Paragraph({
            text: '一、基础属性与系统参数 (Basic Properties)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 120 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell('角色姓名', true, 25),
                  createTableCell(char.name, false, 25),
                  createTableCell('角色唯一ID', true, 25),
                  createTableCell(char.character_id, false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell('直觉防御机制', true, 25),
                  createTableCell(getInstinctLabel(char.core.instinct_base), false, 25),
                  createTableCell('语言语气风格', true, 25),
                  createTableCell(getSpeechFilterLabel(char.core.speech_filter), false, 25),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell('单次最少气泡', true, 25),
                  createTableCell(`${minBubbles} 个气泡`, false, 25),
                  createTableCell('五子棋棋力段位', true, 25),
                  createTableCell(gomokuRank.toUpperCase(), false, 25),
                ],
              }),
            ],
          }),

          // Section 2: Core Values
          new Paragraph({
            text: '二、核心特质与价值观 (Core Persona Values)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '核心价值观标签：', bold: true }),
              new TextRun({ text: char.core.values.join('、') || '无' }),
            ],
            spacing: { after: 120 },
          }),

          // Section 3: Speech Patterns & Catchphrases
          new Paragraph({
            text: '三、言语表达与口癖约束 (Speech & Dialogue Patterns)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '常用口癖 / 习惯用语：', bold: true }),
              new TextRun({ text: char.speech.catchphrases.join('、') || '无特别口癖' }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '严禁言语 / 违禁词句：', bold: true, color: 'B91C1C' }),
              new TextRun({ text: char.speech.forbidden_phrases.join('、') || '无' }),
            ],
            spacing: { after: 120 },
          }),

          // Section 4: Action Tendencies
          new Paragraph({
            text: '四、肢体动作与触碰倾向 (Action Tendencies & Boundaries)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '掌控/靠近动作：', bold: true }),
              new TextRun({ text: char.action_tendency.control_actions.join('、') || '无' }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '肢体触碰/互动动作：', bold: true }),
              new TextRun({ text: char.action_tendency.touch_actions.join('、') || '无' }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '禁止动作/人设禁忌：', bold: true, color: 'B91C1C' }),
              new TextRun({ text: char.action_tendency.forbidden_actions.join('、') || '无' }),
            ],
            spacing: { after: 120 },
          }),

          // Section 5: Multimodal Visual Appearance
          new Paragraph({
            text: '五、AI 多模态视觉形象描述 (Visual Appearance Perception)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: visualDesc ? visualDesc : '（未配置独立立绘视觉特征，使用基础角色设定）' }),
            ],
            spacing: { after: 120 },
          }),

          // Section 6: Background Threads
          new Paragraph({
            text: '六、潜意识背景思绪 (Background Threads)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          }),
          ...char.background_threads.active.map(
            (t) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${t.content} `, bold: true }),
                  new TextRun({ text: `(持续剩余: ${t.remaining_turns} 轮)`, color: '888888', italics: true }),
                ],
                spacing: { after: 60 },
              })
          ),

          // Section 7: Custom System Prompt Instructions
          ...(customPrompt
            ? [
                new Paragraph({
                  text: '七、专属自定义系统提示词 (Custom System Prompt Directives)',
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 120 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: customPrompt, font: 'Courier New' })],
                  spacing: { after: 150 },
                }),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadFile(blob, `${char.name.replace(/[\\/:*?"<>|]/g, '_')}_角色档案.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

function createTableCell(text: string, isHeader: boolean = false, widthPercent: number = 25): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: isHeader
      ? { type: ShadingType.SOLID, color: 'F3F4F6', fill: 'F3F4F6' }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: isHeader,
            size: 20,
          }),
        ],
        spacing: { before: 80, after: 80 },
      }),
    ],
  });
}

function getInstinctLabel(instinct: InstinctBase): string {
  const map: Record<InstinctBase, string> = {
    attack: '进击/侵略 (Attack)',
    avoid: '回避/防备 (Avoid)',
    freeze: '僵直/隐忍 (Freeze)',
    fawn: '讨好/迎合 (Fawn)',
    observe: '静默/审视 (Observe)',
  };
  return map[instinct] || instinct;
}

function getSpeechFilterLabel(filter: SpeechFilter): string {
  const map: Record<SpeechFilter, string> = {
    rough: '粗粝不羁 (Rough)',
    gentle: '温和含蓄 (Gentle)',
    formal: '克制正式 (Formal)',
    casual: '随性日常 (Casual)',
  };
  return map[filter] || filter;
}

/**
 * 4. Parse & Import Character from JSON String
 */
export function importCharacterFromJson(jsonContent: string): { importedCount: number; characters: Character[] } {
  const parsed = JSON.parse(jsonContent);
  const targetList: any[] = [];

  if (parsed.characters && Array.isArray(parsed.characters)) {
    targetList.push(...parsed.characters);
  } else if (parsed.character && typeof parsed.character === 'object') {
    targetList.push(parsed.character);
  } else if (Array.isArray(parsed)) {
    targetList.push(...parsed);
  } else if (parsed.name && (parsed.core || parsed.character_id)) {
    targetList.push(parsed);
  } else {
    throw new Error('无效的角色档案 JSON 格式！');
  }

  const savedList: Character[] = [];

  for (const raw of targetList) {
    if (!raw.name) continue;
    const charId = raw.character_id || `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    const newChar: Character = {
      character_id: charId,
      name: raw.name,
      core: {
        values: Array.isArray(raw.core?.values) ? raw.core.values : ['专属设定', '独立个性'],
        instinct_base: raw.core?.instinct_base || 'observe',
        speech_filter: raw.core?.speech_filter || 'casual',
      },
      emotion: raw.emotion || {
        current: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
        baseline: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
        inertia: { anger: 0.6, fear: 0.6, joy: 0.5, sadness: 0.6, desire: 0.5, warmth: 0.5 },
        triggers: [
          { keywords: ['不行', '做不到'], delta: { anger: 0.3, desire: 0.2 } },
          { keywords: ['乖', '听话'], delta: { warmth: 0.3, desire: 0.2 } },
        ],
      },
      background_threads: raw.background_threads || {
        active: [{ content: '初次相识，静静注视着你的一举一动', remaining_turns: 3 }],
      },
      memory: raw.memory || { anchors: [] },
      action_tendency: raw.action_tendency || {
        control_actions: ['注视着你', '缓步靠近'],
        touch_actions: ['指尖轻触', '轻按手背'],
        forbidden_actions: ['粗暴伤害'],
        control_affinity: 0.5,
        touch_affinity: 0.6,
      },
      speech: raw.speech || {
        catchphrases: ['嗯', '过来'],
        forbidden_phrases: ['对不起嘛', '求求你'],
      },
    };

    if (raw.custom_system_prompt) {
      (newChar as any).custom_system_prompt = raw.custom_system_prompt;
    }

    saveCharacterEdit(newChar);

    if (raw._extra) {
      if (raw._extra.avatar) saveCharAvatar(charId, raw._extra.avatar);
      if (raw._extra.visual_desc) saveCharVisualDesc(charId, raw._extra.visual_desc);
      if (raw._extra.min_bubbles) saveCharMinBubbles(charId, raw._extra.min_bubbles);
      if (raw._extra.gomoku_rank) saveCharGomokuRank(charId, raw._extra.gomoku_rank);
    }

    savedList.push(newChar);
  }

  return {
    importedCount: savedList.length,
    characters: savedList,
  };
}

/**
 * 5. Parse & Import Character from Word (.docx) or Text File
 */
export async function importCharacterFromDocxOrText(file: File): Promise<Character> {
  let fullText = '';

  if (file.name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('无效的 DOCX 文件，未找到文档正文！');
    }
    const docXmlText = await docXmlFile.async('text');
    // Extract text from <w:t> tags
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, 'text/xml');
    const textNodes = xmlDoc.getElementsByTagName('w:t');
    const parts: string[] = [];
    for (let i = 0; i < textNodes.length; i++) {
      parts.push(textNodes[i].textContent || '');
    }
    fullText = parts.join(' ');
  } else {
    fullText = await file.text();
  }

  // Parse extracted text to extract character fields
  return parseTextToCharacter(fullText, file.name);
}

function parseTextToCharacter(rawText: string, fallbackFilename: string): Character {
  let name = fallbackFilename.replace(/\.(docx|json|txt)$/i, '').replace(/_角色档案|_档案/g, '').trim();

  // Try extracting Name
  const nameMatch = rawText.match(/(?:角色姓名|姓名|Name|角色核心档案 Dossier ·)\s*[:：·]?\s*([^\s,，|]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }

  // Extract Core Values
  let values: string[] = ['专属设定', '独立个性'];
  const valuesMatch = rawText.match(/(?:核心特质|核心价值观|特质)\s*[:：]?\s*([^\n\r]+)/i);
  if (valuesMatch && valuesMatch[1]) {
    values = valuesMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  // Extract Catchphrases
  let catchphrases: string[] = ['嗯', '过来'];
  const catchMatch = rawText.match(/(?:常用口癖|口癖|习惯用语)\s*[:：]?\s*([^\n\r]+)/i);
  if (catchMatch && catchMatch[1]) {
    catchphrases = catchMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  // Extract Forbidden phrases
  let forbidden_phrases: string[] = ['对不起嘛', '求求你'];
  const forbidMatch = rawText.match(/(?:严禁言语|违禁词句|禁止言语)\s*[:：]?\s*([^\n\r]+)/i);
  if (forbidMatch && forbidMatch[1]) {
    forbidden_phrases = forbidMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  // Extract Actions
  let control_actions: string[] = ['注视着你', '缓步靠近'];
  const controlMatch = rawText.match(/(?:掌控\/靠近动作|靠近动作|掌控动作)\s*[:：]?\s*([^\n\r]+)/i);
  if (controlMatch && controlMatch[1]) {
    control_actions = controlMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  let touch_actions: string[] = ['指尖轻触', '轻按手背'];
  const touchMatch = rawText.match(/(?:肢体触碰\/互动动作|触碰动作|互动动作)\s*[:：]?\s*([^\n\r]+)/i);
  if (touchMatch && touchMatch[1]) {
    touch_actions = touchMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  let forbidden_actions: string[] = ['粗暴伤害'];
  const forbidActionMatch = rawText.match(/(?:禁止动作\/人设禁忌|禁止动作|动作禁忌)\s*[:：]?\s*([^\n\r]+)/i);
  if (forbidActionMatch && forbidActionMatch[1]) {
    forbidden_actions = forbidActionMatch[1].split(/[、,，\s]/).map(s => s.trim()).filter(Boolean);
  }

  // Extract Instinct
  let instinct: InstinctBase = 'observe';
  if (/进击|侵略|attack/i.test(rawText)) instinct = 'attack';
  else if (/回避|防备|avoid/i.test(rawText)) instinct = 'avoid';
  else if (/僵直|隐忍|freeze/i.test(rawText)) instinct = 'freeze';
  else if (/讨好|迎合|fawn/i.test(rawText)) instinct = 'fawn';

  // Extract Speech filter
  let speechFilter: SpeechFilter = 'casual';
  if (/粗粝|rough/i.test(rawText)) speechFilter = 'rough';
  else if (/温和|gentle/i.test(rawText)) speechFilter = 'gentle';
  else if (/克制|正式|formal/i.test(rawText)) speechFilter = 'formal';

  const charId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const character: Character = {
    character_id: charId,
    name: name || '导入角色',
    core: {
      values: values.length > 0 ? values : ['专属设定', '独立个性'],
      instinct_base: instinct,
      speech_filter: speechFilter,
    },
    emotion: {
      current: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      baseline: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      inertia: { anger: 0.6, fear: 0.6, joy: 0.5, sadness: 0.6, desire: 0.5, warmth: 0.5 },
      triggers: [
        { keywords: ['不行', '做不到'], delta: { anger: 0.3, desire: 0.2 } },
        { keywords: ['乖', '听话'], delta: { warmth: 0.3, desire: 0.2 } },
      ],
    },
    background_threads: {
      active: [{ content: `已从《${fallbackFilename || '档案'}》成功导入人设`, remaining_turns: 3 }],
    },
    memory: { anchors: [] },
    action_tendency: {
      control_actions,
      touch_actions,
      forbidden_actions,
      control_affinity: 0.5,
      touch_affinity: 0.6,
    },
    speech: {
      catchphrases,
      forbidden_phrases,
    },
  };

  saveCharacterEdit(character);
  return character;
}
