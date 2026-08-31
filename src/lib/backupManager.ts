// High-Tolerance, Per-File Local Backup & Import/Export Engine for Tianjiji
// Strictly avoids single giant JSON blobs; handles corrupt chunks with graceful isolation and auto-repair.

import JSZip from 'jszip';
import type { 
  Character, 
  ChatMessage, 
  MessageSegment,
  DynamicMemory, 
  EmotionVector, 
  BackgroundThread, 
  TriggeredAnchor,
  InstinctBase,
  SpeechFilter,
  EmotionKey
} from '../data/types';
import { 
  idbLoadAllChatSessions, 
  idbLoadAllCharacters, 
  idbLoadAllDynamicMemories, 
  idbGetAllSettings,
  idbSaveChatSession,
  idbSaveCharacter,
  idbSaveDynamicMemories,
  idbSetSetting,
  idbLoadChatSession,
  idbLoadDynamicMemories,
  idbSaveGameMatch,
  idbSaveIntimacyMilestone,
  idbLoadGameMatches,
  idbLoadIntimacyMilestones,
  type DBChatSession,
  type DBCharacterExtra
} from './idb';
import { 
  loadSavedCharacters, 
  loadPromptPresets, 
  loadPromptLayers, 
  loadUserPromptProfile, 
  loadUserVisualDesc,
  loadSensitiveWords,
  loadCharAvatar,
  loadCharVisualDesc,
  loadCharMinBubbles,
  loadCharGomokuRank,
  saveCharacterEdit,
  saveCharAvatar,
  saveCharVisualDesc,
  saveCharMinBubbles,
  saveCharGomokuRank,
  savePromptPresets,
  savePromptLayers,
  saveUserPromptProfile,
  saveUserVisualDesc,
  saveSensitiveWords,
  type PromptPreset,
  type PromptLayer,
  type SensitiveWordRule
} from './customStore';
import { loadLlmConfig, type LlmConfig } from './llm';
import { downloadFile } from './characterIO';
import { MOCK_CHARACTERS } from '../data/characters';

export interface BackupManifest {
  app: 'tianjiji';
  version: '2.0.0';
  exported_at: string;
  character_count: number;
  total_messages: number;
  total_memories: number;
  files: string[];
}

export interface CharacterCardExport {
  version: string;
  exported_at: string;
  character: Character;
  extra?: DBCharacterExtra;
}

export interface ChatHistoryExport {
  version: string;
  exported_at: string;
  characterId: string;
  characterName: string;
  messages: ChatMessage[];
  emotion?: EmotionVector;
  backgroundThreads?: BackgroundThread[];
  triggeredAnchors?: TriggeredAnchor[];
}

export interface DynamicMemoriesExport {
  version: string;
  exported_at: string;
  characterId: string;
  memories: DynamicMemory[];
}

// -------------------------------------------------------------
// 1. Granular & Full ZIP Export Engine
// -------------------------------------------------------------

/**
 * Exports a full, modular ZIP backup containing separate files for each character, chat, memory, and settings.
 */
export async function exportFullBackupZip(): Promise<void> {
  const zip = new JSZip();

  // 1. Gather all data
  const { characters, extras } = await idbLoadAllCharacters();
  const allSessions = await idbLoadAllChatSessions();
  const allMemories = await idbLoadAllDynamicMemories();
  const promptPresets = loadPromptPresets();
  const promptLayers = loadPromptLayers();
  const userProfile = loadUserPromptProfile();
  const userVisualDesc = loadUserVisualDesc();
  const sensitiveWords = loadSensitiveWords();
  const gameMatches = await idbLoadGameMatches();
  const intimacyMilestones = await idbLoadIntimacyMilestones();

  // Strip API keys for security
  const llmConfig = loadLlmConfig();
  const sanitizedLlmConfig: LlmConfig = {
    ...llmConfig,
    apiKey: '', // SECURITY: Always strip secret key on export!
  };

  const fileList: string[] = [];
  let totalMessagesCount = 0;
  let totalMemoriesCount = 0;

  // 2. Characters Directory (characters/{id}.json)
  const charFolder = zip.folder('characters');
  for (const char of characters) {
    const extra: DBCharacterExtra = extras[char.character_id] || {
      avatar: loadCharAvatar(char.character_id) || undefined,
      visual_desc: loadCharVisualDesc(char.character_id) || undefined,
      min_bubbles: loadCharMinBubbles(char.character_id) || undefined,
      gomoku_rank: loadCharGomokuRank(char.character_id) || undefined,
      custom_system_prompt: (char as any).custom_system_prompt || undefined,
    };

    const charCardPayload: CharacterCardExport = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      character: char,
      extra,
    };

    const filename = `${sanitizeFilename(char.name)}_${char.character_id}.json`;
    charFolder?.file(filename, JSON.stringify(charCardPayload, null, 2));
    fileList.push(`characters/${filename}`);
  }

  // 3. Chats Directory (chats/{id}.json)
  const chatFolder = zip.folder('chats');
  for (const session of allSessions) {
    if (!session || !session.characterId) continue;
    const count = session.messages ? session.messages.length : 0;
    totalMessagesCount += count;

    const charName = session.characterName || characters.find((c) => c.character_id === session.characterId)?.name || '角色';
    const chatPayload: ChatHistoryExport = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      characterId: session.characterId,
      characterName: charName,
      messages: session.messages || [],
      emotion: session.emotion,
      backgroundThreads: session.backgroundThreads,
      triggeredAnchors: session.triggeredAnchors,
    };

    const filename = `${sanitizeFilename(charName)}_${session.characterId}.json`;
    chatFolder?.file(filename, JSON.stringify(chatPayload, null, 2));
    fileList.push(`chats/${filename}`);
  }

  // 4. Memories Directory (memories/{id}.json)
  const memoryFolder = zip.folder('memories');
  for (const [charId, mems] of Object.entries(allMemories)) {
    if (!Array.isArray(mems) || mems.length === 0) continue;
    totalMemoriesCount += mems.length;

    const charName = characters.find((c) => c.character_id === charId)?.name || '角色';
    const memoryPayload: DynamicMemoriesExport = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      characterId: charId,
      memories: mems,
    };

    const filename = `${sanitizeFilename(charName)}_${charId}.json`;
    memoryFolder?.file(filename, JSON.stringify(memoryPayload, null, 2));
    fileList.push(`memories/${filename}`);
  }

  // 5. Settings Directory
  const settingsFolder = zip.folder('settings');
  
  settingsFolder?.file('llm_config.json', JSON.stringify(sanitizedLlmConfig, null, 2));
  fileList.push('settings/llm_config.json');

  settingsFolder?.file('prompt_presets.json', JSON.stringify(promptPresets, null, 2));
  fileList.push('settings/prompt_presets.json');

  settingsFolder?.file('prompt_layers.json', JSON.stringify(promptLayers, null, 2));
  fileList.push('settings/prompt_layers.json');

  settingsFolder?.file('user_profile.json', JSON.stringify({
    user_prompt_profile: userProfile,
    user_visual_desc: userVisualDesc,
  }, null, 2));
  fileList.push('settings/user_profile.json');

  settingsFolder?.file('sensitive_words.json', JSON.stringify(sensitiveWords, null, 2));
  fileList.push('settings/sensitive_words.json');

  // 6. Games Directory
  if (gameMatches.length > 0 || intimacyMilestones.length > 0) {
    const gamesFolder = zip.folder('games');
    gamesFolder?.file('game_records.json', JSON.stringify({
      matches: gameMatches,
      milestones: intimacyMilestones,
    }, null, 2));
    fileList.push('games/game_records.json');
  }

  // 7. Root Manifest
  const manifest: BackupManifest = {
    app: 'tianjiji',
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    character_count: characters.length,
    total_messages: totalMessagesCount,
    total_memories: totalMemoriesCount,
    files: fileList,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Generate ZIP blob and download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(blob, `天机机_全量数据备份_${dateStr}.zip`, 'application/zip');
}

/**
 * Exports all characters' chat histories to a single bundle or multi-character JSON
 */
export async function exportAllCharactersChatsToJson(): Promise<void> {
  const allSessions = await idbLoadAllChatSessions();
  const characters = loadSavedCharacters();
  
  const chatsPayload: Record<string, ChatHistoryExport> = {};
  let totalMsgs = 0;

  for (const session of allSessions) {
    if (!session || !session.characterId) continue;
    const charName = characters.find((c) => c.character_id === session.characterId)?.name || session.characterName || '角色';
    chatsPayload[session.characterId] = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      characterId: session.characterId,
      characterName: charName,
      messages: session.messages || [],
      emotion: session.emotion,
      backgroundThreads: session.backgroundThreads,
      triggeredAnchors: session.triggeredAnchors,
    };
    totalMsgs += session.messages?.length || 0;
  }

  const payload = {
    app: 'tianjiji',
    version: '2.0.0',
    type: 'all_character_chats',
    exported_at: new Date().toISOString(),
    character_count: Object.keys(chatsPayload).length,
    total_messages: totalMsgs,
    chats: chatsPayload,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(jsonStr, `天机机_全角色聊天记录_${dateStr}.json`);
}

/**
 * Exports a single character's chat history to JSON
 */
export async function exportCharacterChatToJson(characterId: string, characterName?: string): Promise<void> {
  const session = await idbLoadChatSession(characterId);
  const name = characterName || session?.characterName || '角色';
  const payload: ChatHistoryExport = {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    characterId,
    characterName: name,
    messages: session?.messages || [],
    emotion: session?.emotion,
    backgroundThreads: session?.backgroundThreads,
    triggeredAnchors: session?.triggeredAnchors,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `${sanitizeFilename(name)}_聊天记录_${new Date().toISOString().slice(0, 10)}.json`);
}

/**
 * Exports a single character's card (dossier + avatar + extra settings) to JSON
 */
export function exportSingleCharacterCard(char: Character): void {
  const avatar = loadCharAvatar(char.character_id);
  const visualDesc = loadCharVisualDesc(char.character_id);
  const minBubbles = loadCharMinBubbles(char.character_id);
  const gomokuRank = loadCharGomokuRank(char.character_id);

  const payload: CharacterCardExport = {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    character: char,
    extra: {
      avatar,
      visual_desc: visualDesc,
      min_bubbles: minBubbles,
      gomoku_rank: gomokuRank,
      custom_system_prompt: (char as any).custom_system_prompt,
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `${sanitizeFilename(char.name)}_角色档案.json`);
}

/**
 * Exports prompt presets to JSON
 */
export function exportPromptPresetsToJson(): void {
  const presets = loadPromptPresets();
  const jsonStr = JSON.stringify({ presets, exported_at: new Date().toISOString() }, null, 2);
  downloadFile(jsonStr, `提示词预设方案合集_${new Date().toISOString().slice(0, 10)}.json`);
}

/**
 * Exports settings and rules to JSON
 */
export function exportSettingsToJson(): void {
  const llmConfig = loadLlmConfig();
  const sanitizedLlm: LlmConfig = { ...llmConfig, apiKey: '' };
  const payload = {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    llm_config: sanitizedLlm,
    user_prompt_profile: loadUserPromptProfile(),
    user_visual_desc: loadUserVisualDesc(),
    prompt_layers: loadPromptLayers(),
    prompt_presets: loadPromptPresets(),
    sensitive_words: loadSensitiveWords(),
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `天机机_系统配置与方案_${new Date().toISOString().slice(0, 10)}.json`);
}

function sanitizeFilename(name: string): string {
  return (name || 'unnamed').replace(/[\\/:*?"<>|]/g, '_').trim();
}

// -------------------------------------------------------------
// 2. High-Tolerance Normalization & Multi-Format Parser
// -------------------------------------------------------------

export interface ParsedCharacterItem {
  character: Character;
  extra?: DBCharacterExtra;
  sourceFile?: string;
  warnings: string[];
}

export interface ParsedChatItem {
  characterId: string;
  characterName: string;
  messages: ChatMessage[];
  emotion?: EmotionVector;
  backgroundThreads?: BackgroundThread[];
  triggeredAnchors?: TriggeredAnchor[];
  sourceFile?: string;
  warnings: string[];
}

export interface ParsedMemoryItem {
  characterId: string;
  characterName?: string;
  memories: DynamicMemory[];
  sourceFile?: string;
  warnings: string[];
}

export interface ParsedSettingsBundle {
  llmConfig?: Partial<LlmConfig>;
  promptPresets?: PromptPreset[];
  promptLayers?: PromptLayer[];
  userPromptProfile?: string;
  userVisualDesc?: string;
  sensitiveWords?: SensitiveWordRule[];
  sourceFile?: string;
  warnings: string[];
}

export interface ImportInspectionReport {
  fileName: string;
  fileSize: number;
  isZip: boolean;
  manifest?: BackupManifest;
  characters: ParsedCharacterItem[];
  chats: ParsedChatItem[];
  memories: ParsedMemoryItem[];
  settings?: ParsedSettingsBundle;
  gameRecords?: {
    matchesCount: number;
    milestonesCount: number;
  };
  totalMessages: number;
  totalCharacters: number;
  totalMemories: number;
  errors: Array<{ file?: string; message: string }>;
  autoRepairs: Array<{ target: string; action: string }>;
}

/**
 * Inspects and dry-runs an uploaded file (ZIP, JSON, TXT, DOCX) without writing to storage.
 */
export async function inspectImportFile(file: File): Promise<ImportInspectionReport> {
  const report: ImportInspectionReport = {
    fileName: file.name,
    fileSize: file.size,
    isZip: file.name.toLowerCase().endsWith('.zip'),
    characters: [],
    chats: [],
    memories: [],
    totalMessages: 0,
    totalCharacters: 0,
    totalMemories: 0,
    errors: [],
    autoRepairs: [],
  };

  try {
    if (report.isZip) {
      await inspectZipFile(file, report);
    } else if (file.name.toLowerCase().endsWith('.json')) {
      const text = await file.text();
      inspectSingleJsonText(text, file.name, report);
    } else if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.txt')) {
      await inspectDocxOrTextFile(file, report);
    } else {
      report.errors.push({
        file: file.name,
        message: '不支持的文件类型，请上传 .zip 备份包、.json 记录文件或 .docx / .txt 角色卡！',
      });
    }
  } catch (err: any) {
    report.errors.push({
      file: file.name,
      message: `文件解包或预检失败: ${err.message || String(err)}`,
    });
  }

  // Calculate totals
  report.totalCharacters = report.characters.length;
  report.totalMessages = report.chats.reduce((acc, c) => acc + c.messages.length, 0);
  report.totalMemories = report.memories.reduce((acc, m) => acc + m.memories.length, 0);

  return report;
}

/**
 * Internal helper for ZIP archives
 */
async function inspectZipFile(file: File, report: ImportInspectionReport): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Read manifest if present
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    try {
      const manifestText = await manifestFile.async('text');
      report.manifest = JSON.parse(manifestText);
    } catch {
      report.autoRepairs.push({ target: 'manifest.json', action: '清单文件损坏，已自动切换为无清单全盘扫描模式' });
    }
  }

  // 2. Iterate through all files in ZIP
  const entries = Object.keys(zip.files);

  for (const path of entries) {
    const zipEntry = zip.file(path);
    if (!zipEntry || zipEntry.dir) continue;

    const lowerPath = path.toLowerCase();

    // Skip OS junk files
    if (lowerPath.includes('__macosx') || lowerPath.endsWith('.ds_store') || lowerPath.endsWith('thumbs.db')) {
      continue;
    }

    try {
      const contentText = await zipEntry.async('text');

      if (lowerPath.startsWith('characters/') || lowerPath.includes('character')) {
        parseAndAddCharacter(contentText, path, report);
      } else if (lowerPath.startsWith('chats/') || lowerPath.includes('chat') || lowerPath.includes('history')) {
        parseAndAddChat(contentText, path, report);
      } else if (lowerPath.startsWith('memories/') || lowerPath.includes('memory')) {
        parseAndAddMemory(contentText, path, report);
      } else if (lowerPath.startsWith('settings/') || lowerPath.includes('preset') || lowerPath.includes('config')) {
        parseAndAddSettings(contentText, path, report);
      } else if (lowerPath.endsWith('.json')) {
        // Generic fallback inspection for unorganized JSON files in root
        inspectSingleJsonText(contentText, path, report);
      }
    } catch (err: any) {
      report.errors.push({
        file: path,
        message: `解析文件失败: ${err.message || '格式错误'} (已自动跳过此坏块，不影响其他数据)`,
      });
    }
  }
}

/**
 * Inspects a single JSON text with deep multi-shape tolerance
 */
export function inspectSingleJsonText(text: string, sourceName: string, report: ImportInspectionReport): void {
  try {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try auto-fixing relaxed JSON (trailing commas, unquoted keys, etc.)
      const cleaned = cleanRelaxedJson(text);
      parsed = JSON.parse(cleaned);
      report.autoRepairs.push({ target: sourceName, action: '检测到松散 JSON 语法，已自动剔除多余尾随逗号与特殊格式' });
    }

    if (!parsed) return;

    // Check if it's a character card or bundle
    if (parsed.character || (parsed.name && (parsed.core || parsed.character_id || parsed.values)) || (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.core)) {
      parseAndAddCharacter(text, sourceName, report);
    } 
    // Check if it's chat history
    else if (parsed.messages || (Array.isArray(parsed) && (parsed[0]?.role || parsed[0]?.content || parsed[0]?.text))) {
      parseAndAddChat(text, sourceName, report);
    }
    // Check if it's dynamic memories
    else if (parsed.memories || (Array.isArray(parsed) && parsed[0]?.topic_keywords)) {
      parseAndAddMemory(text, sourceName, report);
    }
    // Check if it's presets / settings
    else if (parsed.presets || parsed.prompt_presets || parsed.prompt_layers || parsed.user_prompt_profile || parsed.llm_config || parsed.sensitive_words) {
      parseAndAddSettings(text, sourceName, report);
    }
    // Try universal loose scanner
    else {
      let matchedAny = false;
      if (parsed.characters && Array.isArray(parsed.characters)) {
        parseAndAddCharacter(text, sourceName, report);
        matchedAny = true;
      }
      if (parsed.chats && Array.isArray(parsed.chats)) {
        parseAndAddChat(text, sourceName, report);
        matchedAny = true;
      }
      if (!matchedAny) {
        report.errors.push({ file: sourceName, message: '未识别到已知的数据结构（角色、对话、记忆或配置）' });
      }
    }
  } catch (err: any) {
    report.errors.push({ file: sourceName, message: `JSON 解析异常: ${err.message}` });
  }
}

/**
 * Inspects a docx or text file
 */
async function inspectDocxOrTextFile(file: File, report: ImportInspectionReport): Promise<void> {
  try {
    let fullText = '';
    if (file.name.toLowerCase().endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file('word/document.xml');
      if (!docXmlFile) {
        throw new Error('未找到 DOCX 文档正文');
      }
      const docXmlText = await docXmlFile.async('text');
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

    const normalized = normalizeCharacterObject({}, fullText, file.name);
    report.characters.push({
      character: normalized.char,
      extra: normalized.extra,
      sourceFile: file.name,
      warnings: normalized.warnings,
    });
    report.autoRepairs.push({
      target: file.name,
      action: `已从文档中提取出角色「${normalized.char.name}」的核心人设属性`,
    });
  } catch (err: any) {
    report.errors.push({ file: file.name, message: `文档解析失败: ${err.message}` });
  }
}

// -------------------------------------------------------------
// Tolerant Parsing Sub-Routines
// -------------------------------------------------------------

function parseAndAddCharacter(jsonStr: string, sourceFile: string, report: ImportInspectionReport): void {
  try {
    const raw = JSON.parse(cleanRelaxedJson(jsonStr));
    const items: any[] = [];

    if (Array.isArray(raw)) {
      items.push(...raw);
    } else if (raw.characters && Array.isArray(raw.characters)) {
      items.push(...raw.characters);
    } else if (raw.character && typeof raw.character === 'object') {
      items.push(raw);
    } else if (raw.name || raw.char_name || raw.character_name) {
      items.push(raw);
    }

    for (const item of items) {
      const normalized = normalizeCharacterObject(item, '', sourceFile);
      report.characters.push({
        character: normalized.char,
        extra: normalized.extra,
        sourceFile,
        warnings: normalized.warnings,
      });
      if (normalized.warnings.length > 0) {
        report.autoRepairs.push({
          target: `${normalized.char.name} (${sourceFile})`,
          action: normalized.warnings.join('; '),
        });
      }
    }
  } catch (err: any) {
    report.errors.push({ file: sourceFile, message: `角色卡解析异常: ${err.message}` });
  }
}

function normalizeCharacterObject(raw: any, rawDocText: string = '', sourceFile: string = ''): {
  char: Character;
  extra: DBCharacterExtra;
  warnings: string[];
} {
  const warnings: string[] = [];
  const target = raw.character || raw;
  const extraSrc = raw.extra || target._extra || target.extra || {};

  // 1. Name normalization
  let name = (
    target.name ||
    target.char_name ||
    target.character_name ||
    target.charName ||
    target.characterName ||
    target.title ||
    target.label ||
    ''
  ).trim();

  if (!name && rawDocText) {
    const nameMatch = rawDocText.match(/(?:角色姓名|姓名|Name|角色核心档案 Dossier ·)\s*[:：·]?\s*([^\s,，|]+)/i);
    if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();
  }

  if (!name) {
    name = sourceFile ? sourceFile.replace(/\.(json|docx|txt)$/i, '').replace(/.*[\\/]/, '') : '导入角色';
    warnings.push('未发现标准姓名，已使用文件名作为角色名');
  }

  // 2. Character ID
  const charId = (
    target.character_id ||
    target.char_id ||
    target.id ||
    target.charId ||
    `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  ).trim();

  // 3. Values / Personality
  let values: string[] = ['专属设定', '独立个性'];
  const rawValues = target.core?.values || target.values || target.personality || target.traits || target.core_values;
  if (Array.isArray(rawValues)) {
    values = rawValues.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof rawValues === 'string' && rawValues.trim()) {
    values = rawValues.split(/[、,，\n/]+/).map((v) => v.trim()).filter(Boolean);
    warnings.push('将字符串格式特质自动切分为标签列表');
  } else if (rawDocText) {
    const valMatch = rawDocText.match(/(?:核心特质|核心价值观|特质)\s*[:：]?\s*([^\n\r]+)/i);
    if (valMatch && valMatch[1]) {
      values = valMatch[1].split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean);
    }
  }

  // 4. Instinct
  let instinct: InstinctBase = 'observe';
  const rawInstinct = target.core?.instinct_base || target.instinct_base || target.instinct || target.defense_mechanism;
  if (typeof rawInstinct === 'string') {
    const lower = rawInstinct.toLowerCase();
    if (/attack|攻|侵略/i.test(lower)) instinct = 'attack';
    else if (/avoid|避|防备|逃/i.test(lower)) instinct = 'avoid';
    else if (/freeze|僵|隐忍/i.test(lower)) instinct = 'freeze';
    else if (/fawn|讨好|迎合/i.test(lower)) instinct = 'fawn';
    else if (/observe|审视|观察|静默/i.test(lower)) instinct = 'observe';
  }

  // 5. Speech Tone
  let speechFilter: SpeechFilter = 'casual';
  const rawFilter = target.core?.speech_filter || target.speech_filter || target.tone || target.style;
  if (typeof rawFilter === 'string') {
    const lower = rawFilter.toLowerCase();
    if (/rough|粗/i.test(lower)) speechFilter = 'rough';
    else if (/gentle|温/i.test(lower)) speechFilter = 'gentle';
    else if (/formal|正|克制/i.test(lower)) speechFilter = 'formal';
    else if (/casual|随性|日常/i.test(lower)) speechFilter = 'casual';
  }

  // 6. Catchphrases & Forbidden Phrases
  let catchphrases: string[] = ['嗯', '过来'];
  let forbidden_phrases: string[] = ['对不起嘛', '求求你'];
  const rawCatch = target.speech?.catchphrases || target.catchphrases || target.catch_phrases;
  if (Array.isArray(rawCatch)) catchphrases = rawCatch.map((c) => String(c).trim()).filter(Boolean);
  else if (typeof rawCatch === 'string' && rawCatch.trim()) {
    catchphrases = rawCatch.split(/[、,，\n]+/).map((c) => c.trim()).filter(Boolean);
  }

  const rawForbid = target.speech?.forbidden_phrases || target.forbidden_phrases || target.banned_words;
  if (Array.isArray(rawForbid)) forbidden_phrases = rawForbid.map((c) => String(c).trim()).filter(Boolean);
  else if (typeof rawForbid === 'string' && rawForbid.trim()) {
    forbidden_phrases = rawForbid.split(/[、,，\n]+/).map((c) => c.trim()).filter(Boolean);
  }

  // 7. Action Tendencies
  const act = target.action_tendency || target.actions || {};
  const control_actions = normalizeStringArray(act.control_actions || target.control_actions, ['注视着你', '缓步靠近']);
  const touch_actions = normalizeStringArray(act.touch_actions || target.touch_actions, ['指尖轻触', '轻按手背']);
  const forbidden_actions = normalizeStringArray(act.forbidden_actions || target.forbidden_actions, ['粗暴伤害']);

  // 8. Custom system prompt
  const custom_system_prompt = (
    target.custom_system_prompt ||
    target.custom_prompt ||
    target.system_prompt ||
    target.systemPrompt ||
    target.prompt ||
    ''
  ).trim();

  // 9. Extra fields
  const avatar = extraSrc.avatar || target.avatar || target.avatar_url || target.image || target.portrait || '';
  const visual_desc = extraSrc.visual_desc || target.visual_desc || target.visualDesc || '';
  const min_bubbles = extraSrc.min_bubbles || target.min_bubbles || 1;
  const gomoku_rank = extraSrc.gomoku_rank || target.gomoku_rank || 'gold';

  const char: Character = {
    character_id: charId,
    name,
    core: {
      values: values.length > 0 ? values : ['专属设定', '独立个性'],
      instinct_base: instinct,
      speech_filter: speechFilter,
    },
    emotion: target.emotion || {
      current: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      baseline: { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
      inertia: { anger: 0.6, fear: 0.6, joy: 0.5, sadness: 0.6, desire: 0.5, warmth: 0.5 },
      triggers: [
        { keywords: ['不行', '做不到'], delta: { anger: 0.3, desire: 0.2 } },
        { keywords: ['乖', '听话'], delta: { warmth: 0.3, desire: 0.2 } },
      ],
    },
    background_threads: target.background_threads || {
      active: [{ content: '初次相识，静静注视着你的一举一动', remaining_turns: 3 }],
    },
    memory: target.memory || { anchors: [] },
    action_tendency: {
      control_actions,
      touch_actions,
      forbidden_actions,
      control_affinity: act.control_affinity ?? 0.5,
      touch_affinity: act.touch_affinity ?? 0.6,
    },
    speech: {
      catchphrases,
      forbidden_phrases,
    },
  };

  if (custom_system_prompt) {
    (char as any).custom_system_prompt = custom_system_prompt;
  }

  const extra: DBCharacterExtra = {
    avatar: avatar || undefined,
    visual_desc: visual_desc || undefined,
    min_bubbles: typeof min_bubbles === 'number' ? min_bubbles : 1,
    gomoku_rank: typeof gomoku_rank === 'string' ? gomoku_rank : 'gold',
    custom_system_prompt: custom_system_prompt || undefined,
  };

  return { char, extra, warnings };
}

function parseAndAddChat(jsonStr: string, sourceFile: string, report: ImportInspectionReport): void {
  try {
    const raw = JSON.parse(cleanRelaxedJson(jsonStr));
    const savedChars = loadSavedCharacters();

    // Check if this is a multi-character chat bundle (e.g. { type: 'all_character_chats', chats: { char_001: { messages: [...] } } })
    if (raw.chats && typeof raw.chats === 'object' && !Array.isArray(raw.chats)) {
      for (const [cId, sessionRaw] of Object.entries(raw.chats)) {
        if (!sessionRaw || typeof sessionRaw !== 'object') continue;
        const subJson = JSON.stringify(sessionRaw);
        parseAndAddChat(subJson, `${sourceFile}#${cId}`, report);
      }
      return;
    }

    const rawMessages: any[] = [];
    const warnings: string[] = [];

    let characterId = (raw.characterId || raw.character_id || raw.charId || raw.cid || '').trim();
    let characterName = (raw.characterName || raw.character_name || raw.char_name || raw.name || '').trim();

    // If characterName was provided but characterId is not, try finding matching saved character
    if (characterName && !characterId) {
      const matchedChar = savedChars.find(
        (c) => c.name.toLowerCase() === characterName.toLowerCase() ||
               c.character_id.toLowerCase() === characterName.toLowerCase()
      );
      if (matchedChar) {
        characterId = matchedChar.character_id;
        characterName = matchedChar.name;
        warnings.push(`根据角色姓名「${characterName}」自动匹配角色 ID: ${characterId}`);
      }
    }

    // If characterId is provided, try finding characterName
    if (characterId && !characterName) {
      const matchedChar = savedChars.find((c) => c.character_id === characterId);
      if (matchedChar) {
        characterName = matchedChar.name;
      }
    }

    // If characterId is still missing, try inferring from filename (e.g., 陆沉_char_001.json or char_001_聊天记录.json)
    if (!characterId) {
      const match = sourceFile.match(/(?:chats\/|chat_)?(?:.*_)?([a-zA-Z0-9_-]+)\.json(?:#.*)?$/i);
      if (match && match[1]) {
        const candidateId = match[1];
        const matchedChar = savedChars.find((c) => c.character_id === candidateId || c.name === candidateId);
        if (matchedChar) {
          characterId = matchedChar.character_id;
          characterName = matchedChar.name;
          warnings.push(`从文件名「${sourceFile}」识别对应角色「${characterName}」(${characterId})`);
        } else {
          characterId = candidateId;
          warnings.push(`从文件名自动推断关联角色 ID: ${characterId}`);
        }
      } else {
        characterId = savedChars[0]?.character_id || MOCK_CHARACTERS[0].character_id;
        characterName = savedChars[0]?.name || MOCK_CHARACTERS[0].name;
        warnings.push(`未指定角色 ID，已自动关联至默认角色「${characterName}」`);
      }
    }

    if (Array.isArray(raw)) {
      rawMessages.push(...raw);
    } else if (raw.messages && Array.isArray(raw.messages)) {
      rawMessages.push(...raw.messages);
    } else if (raw.chats && Array.isArray(raw.chats)) {
      rawMessages.push(...raw.chats);
    } else if (raw.history && Array.isArray(raw.history)) {
      rawMessages.push(...raw.history);
    } else if (raw.conversation && Array.isArray(raw.conversation)) {
      rawMessages.push(...raw.conversation);
    } else if (raw.dialogue && Array.isArray(raw.dialogue)) {
      rawMessages.push(...raw.dialogue);
    }

    const messages: ChatMessage[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const rm = rawMessages[i];
      if (!rm) continue;

      // Role normalization
      let role: 'user' | 'character' = 'character';
      const rawRole = (rm.role || rm.sender || rm.author || rm.type || '').toLowerCase();
      if (/user|human|player|master|me|我|主控|玩家/i.test(rawRole)) role = 'user';
      else if (/character|char|assistant|ai|bot|model|npc|角色|对方/i.test(rawRole)) role = 'character';
      else if (i % 2 === 0) role = 'user'; // alternating fallback

      // Content normalization
      let content = (rm.content || rm.text || rm.message || rm.msg || rm.body || rm.reply || rm.dialogue || '').trim();
      let thought = rm.thought || rm.inner_thought || rm.mind || rm.innerThought || '';

      // If thought is embedded inside content as *...*, extract it gracefully
      if (!thought && content.startsWith('*') && content.includes('*')) {
        const endStar = content.indexOf('*', 1);
        if (endStar !== -1) {
          thought = content.slice(1, endStar).trim();
          content = content.slice(endStar + 1).trim();
        }
      }

      const id = rm.id || rm.message_id || `msg_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const timestamp = parseTimestamp(rm.timestamp || rm.time || rm.created_at || rm.createdAt, Date.now() - (rawMessages.length - i) * 1000);

      const segments: MessageSegment[] = Array.isArray(rm.segments) && rm.segments.length > 0
        ? rm.segments
        : [{ type: 'speech', text: content }];

      const msg: ChatMessage = {
        id,
        role,
        content,
        segments,
        timestamp,
        character_id: rm.character_id || rm.characterId,
        snapshot: rm.snapshot,
        llmError: rm.llmError || rm.error,
        sticker: rm.sticker,
        presetId: rm.presetId,
        presetName: rm.presetName,
        versions: rm.versions,
        currentVersionIndex: rm.currentVersionIndex,
      };

      messages.push(msg);
    }

    if (messages.length > 0) {
      report.chats.push({
        characterId,
        characterName: characterName || '角色',
        messages,
        emotion: raw.emotion,
        backgroundThreads: raw.backgroundThreads,
        triggeredAnchors: raw.triggeredAnchors,
        sourceFile,
        warnings,
      });
    }
  } catch (err: any) {
    report.errors.push({ file: sourceFile, message: `对话记录解析异常: ${err.message}` });
  }
}

function parseAndAddMemory(jsonStr: string, sourceFile: string, report: ImportInspectionReport): void {
  try {
    const raw = JSON.parse(cleanRelaxedJson(jsonStr));
    let characterId = raw.characterId || raw.character_id || raw.charId || '';
    const rawList: any[] = Array.isArray(raw) ? raw : (raw.memories && Array.isArray(raw.memories)) ? raw.memories : [];

    if (!characterId) {
      const match = sourceFile.match(/(?:memories\/|memory_)?([a-zA-Z0-9_-]+)\.json$/i);
      if (match && match[1]) characterId = match[1];
      else characterId = MOCK_CHARACTERS[0].character_id;
    }

    const memories: DynamicMemory[] = [];
    for (const rm of rawList) {
      if (!rm) continue;
      const mem: DynamicMemory = {
        id: rm.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        created_at: parseTimestamp(rm.created_at || rm.timestamp, Date.now()),
        emotion_type: normalizeEmotionKey(rm.emotion_type || rm.emotion || 'warmth'),
        intensity: Math.max(1, Math.min(5, Math.round(Number(rm.intensity) || 3))),
        topic_keywords: Array.isArray(rm.topic_keywords) ? rm.topic_keywords : typeof rm.topic_keywords === 'string' ? rm.topic_keywords.split(/[,，\s]+/) : ['沉淀记忆'],
        user_trigger_summary: rm.user_trigger_summary || rm.trigger || '',
        character_reaction_summary: rm.character_reaction_summary || rm.reaction || rm.summary || '',
        importance: typeof rm.importance === 'number' ? rm.importance : 0.8,
      };
      memories.push(mem);
    }

    if (memories.length > 0) {
      report.memories.push({
        characterId,
        memories,
        sourceFile,
        warnings: [],
      });
    }
  } catch (err: any) {
    report.errors.push({ file: sourceFile, message: `记忆解析异常: ${err.message}` });
  }
}

function parseAndAddSettings(jsonStr: string, sourceFile: string, report: ImportInspectionReport): void {
  try {
    const raw = JSON.parse(cleanRelaxedJson(jsonStr));
    const bundle: ParsedSettingsBundle = {
      sourceFile,
      warnings: [],
    };

    if (raw.llm_config || raw.api_url || raw.model) {
      bundle.llmConfig = raw.llm_config || raw;
    }
    if (raw.prompt_presets || raw.presets || (Array.isArray(raw) && raw[0]?.layers)) {
      bundle.promptPresets = raw.prompt_presets || raw.presets || raw;
    }
    if (raw.prompt_layers || (Array.isArray(raw) && raw[0]?.role && raw[0]?.type)) {
      bundle.promptLayers = raw.prompt_layers || raw;
    }
    if (raw.user_prompt_profile || raw.user_profile) {
      bundle.userPromptProfile = raw.user_prompt_profile || raw.user_profile;
    }
    if (raw.user_visual_desc) {
      bundle.userVisualDesc = raw.user_visual_desc;
    }
    if (raw.sensitive_words || (Array.isArray(raw) && raw[0]?.word && raw[0]?.category)) {
      bundle.sensitiveWords = raw.sensitive_words || raw;
    }

    report.settings = {
      ...(report.settings || {}),
      ...bundle,
      warnings: [...(report.settings?.warnings || []), ...bundle.warnings],
    };
  } catch (err: any) {
    report.errors.push({ file: sourceFile, message: `设置解析异常: ${err.message}` });
  }
}

// -------------------------------------------------------------
// 3. Execution Engine: Committing Inspected Data to Storage
// -------------------------------------------------------------

export interface ImportOptions {
  mode: 'merge' | 'overwrite';
  importCharacters: boolean;
  importChats: boolean;
  importMemories: boolean;
  importSettings: boolean;
  selectedCharacterIds?: string[];
}

export interface ImportExecuteResult {
  success: boolean;
  importedCharactersCount: number;
  importedMessagesCount: number;
  importedMemoriesCount: number;
  importedSettingsCount: number;
  message: string;
}

/**
 * Commits the approved inspection report into IndexedDB and in-memory stores.
 */
export async function executeImport(
  report: ImportInspectionReport,
  options: ImportOptions
): Promise<ImportExecuteResult> {
  let charCount = 0;
  let msgCount = 0;
  let memCount = 0;
  let settingsCount = 0;

  try {
    // 1. Commit Characters
    if (options.importCharacters && report.characters.length > 0) {
      for (const item of report.characters) {
        if (options.selectedCharacterIds && !options.selectedCharacterIds.includes(item.character.character_id)) {
          continue;
        }
        await idbSaveCharacter(item.character, item.extra);
        saveCharacterEdit(item.character);
        if (item.extra?.avatar) saveCharAvatar(item.character.character_id, item.extra.avatar);
        if (item.extra?.visual_desc) saveCharVisualDesc(item.character.character_id, item.extra.visual_desc);
        if (item.extra?.min_bubbles) saveCharMinBubbles(item.character.character_id, item.extra.min_bubbles);
        if (item.extra?.gomoku_rank) saveCharGomokuRank(item.character.character_id, item.extra.gomoku_rank as any);
        charCount++;
      }
    }

    // 2. Commit Chats
    if (options.importChats && report.chats.length > 0) {
      for (const chat of report.chats) {
        if (options.selectedCharacterIds && !options.selectedCharacterIds.includes(chat.characterId)) {
          continue;
        }

        if (options.mode === 'merge') {
          // Merge and deduplicate with existing session
          const existing = await idbLoadChatSession(chat.characterId);
          const existingMsgs = existing?.messages || [];
          const existingIds = new Set(existingMsgs.map((m) => m.id));
          const mergedMsgs = [...existingMsgs];

          for (const newMsg of chat.messages) {
            if (!existingIds.has(newMsg.id)) {
              mergedMsgs.push(newMsg);
              existingIds.add(newMsg.id);
            }
          }
          // Sort chronologically
          mergedMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          const mergedSession: DBChatSession = {
            characterId: chat.characterId,
            characterName: chat.characterName,
            emotion: chat.emotion || existing?.emotion || { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
            backgroundThreads: chat.backgroundThreads || existing?.backgroundThreads || [],
            triggeredAnchors: chat.triggeredAnchors || existing?.triggeredAnchors || [],
            messages: mergedMsgs,
            updatedAt: Date.now(),
          };

          await idbSaveChatSession(mergedSession);
          msgCount += (mergedMsgs.length - existingMsgs.length) || chat.messages.length;
        } else {
          // Overwrite mode
          const session: DBChatSession = {
            characterId: chat.characterId,
            characterName: chat.characterName,
            emotion: chat.emotion || { anger: 0.1, fear: 0.1, joy: 0.3, sadness: 0.1, desire: 0.3, warmth: 0.3 },
            backgroundThreads: chat.backgroundThreads || [],
            triggeredAnchors: chat.triggeredAnchors || [],
            messages: chat.messages,
            updatedAt: Date.now(),
          };

          await idbSaveChatSession(session);
          msgCount += chat.messages.length;
        }
      }
    }

    // 3. Commit Dynamic Memories
    if (options.importMemories && report.memories.length > 0) {
      for (const memItem of report.memories) {
        if (options.selectedCharacterIds && !options.selectedCharacterIds.includes(memItem.characterId)) {
          continue;
        }

        if (options.mode === 'merge') {
          const existing = await idbLoadDynamicMemories(memItem.characterId);
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...existing];
          for (const m of memItem.memories) {
            if (!existingIds.has(m.id)) {
              merged.push(m);
              existingIds.add(m.id);
            }
          }
          await idbSaveDynamicMemories(memItem.characterId, merged);
          memCount += memItem.memories.length;
        } else {
          await idbSaveDynamicMemories(memItem.characterId, memItem.memories);
          memCount += memItem.memories.length;
        }
      }
    }

    // 4. Commit Settings
    if (options.importSettings && report.settings) {
      const s = report.settings;
      if (s.promptPresets && s.promptPresets.length > 0) {
        savePromptPresets(s.promptPresets);
        settingsCount++;
      }
      if (s.promptLayers && s.promptLayers.length > 0) {
        savePromptLayers(s.promptLayers);
        settingsCount++;
      }
      if (s.userPromptProfile) {
        saveUserPromptProfile(s.userPromptProfile);
        settingsCount++;
      }
      if (s.userVisualDesc) {
        saveUserVisualDesc(s.userVisualDesc);
        settingsCount++;
      }
      if (s.sensitiveWords && s.sensitiveWords.length > 0) {
        saveSensitiveWords(s.sensitiveWords);
        settingsCount++;
      }
    }

    // Dispatch global events so UI updates reactively
    window.dispatchEvent(new CustomEvent('rp_engine_storage_reloaded'));
    window.dispatchEvent(new CustomEvent('rp_engine_prompt_presets_changed'));
    window.dispatchEvent(new CustomEvent('rp_engine_prompt_layers_changed'));

    return {
      success: true,
      importedCharactersCount: charCount,
      importedMessagesCount: msgCount,
      importedMemoriesCount: memCount,
      importedSettingsCount: settingsCount,
      message: `导入成功！已导入 ${charCount} 位角色、${msgCount} 条对话记录、${memCount} 条动态记忆。`,
    };
  } catch (err: any) {
    return {
      success: false,
      importedCharactersCount: charCount,
      importedMessagesCount: msgCount,
      importedMemoriesCount: memCount,
      importedSettingsCount: settingsCount,
      message: `导入中断: ${err.message || '未知错误'}`,
    };
  }
}

// -------------------------------------------------------------
// Helper Utilities
// -------------------------------------------------------------

function cleanRelaxedJson(text: string): string {
  if (!text) return '{}';
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove multi-line comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // remove single-line comments
    .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
    .trim();
}

function normalizeStringArray(input: any, fallback: string[]): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  if (typeof input === 'string' && input.trim()) {
    return input.split(/[、,，\n/]+/).map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

function parseTimestamp(raw: any, fallback: number): number {
  if (typeof raw === 'number' && !isNaN(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function normalizeEmotionKey(key: string): EmotionKey {
  const map: Record<string, EmotionKey> = {
    anger: 'anger',
    fear: 'fear',
    joy: 'joy',
    sadness: 'sadness',
    desire: 'desire',
    warmth: 'warmth',
    怒: 'anger',
    惧: 'fear',
    喜: 'joy',
    悲: 'sadness',
    欲: 'desire',
    温: 'warmth',
  };
  return map[key] || 'warmth';
}
