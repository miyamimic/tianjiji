import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileArchive, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Layers, 
  MessageSquare, 
  Users, 
  Brain, 
  Sliders, 
  RefreshCw, 
  Sparkles, 
  ArrowRight,
  Database,
  Info,
  Check,
  X
} from 'lucide-react';
import { 
  exportFullBackupZip, 
  exportAllCharactersChatsToJson,
  exportCharacterChatToJson, 
  exportSingleCharacterCard, 
  exportPromptPresetsToJson, 
  exportSettingsToJson,
  inspectImportFile,
  executeImport,
  type ImportInspectionReport,
  type ImportOptions,
  type ImportExecuteResult
} from '../lib/backupManager';
import { 
  idbLoadAllChatSessions, 
  idbLoadAllCharacters, 
  idbLoadAllDynamicMemories 
} from '../lib/idb';
import { getCharacterById, MOCK_CHARACTERS } from '../data/characters';
import { LinePuppyMascot, StardewPixelFlower } from './FrenchLacePuppyElements';

interface Props {
  currentCharacterId: string;
  onDataImported?: () => void;
}

export default function DataBackupModal({ currentCharacterId, onDataImported }: Props) {
  // Storage Stats State
  const [stats, setStats] = useState<{
    charCount: number;
    msgCount: number;
    memoryCount: number;
    loading: boolean;
  }>({
    charCount: 0,
    msgCount: 0,
    memoryCount: 0,
    loading: true,
  });

  // Export Loading State
  const [exportingZip, setExportingZip] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Import Workflow State
  const [inspecting, setInspecting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [inspectionReport, setInspectionReport] = useState<ImportInspectionReport | null>(null);
  const [importResult, setImportResult] = useState<ImportExecuteResult | null>(null);

  // Import Options State
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importChars, setImportChars] = useState(true);
  const [importChats, setImportChats] = useState(true);
  const [importMemories, setImportMemories] = useState(true);
  const [importSettings, setImportSettings] = useState(true);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentChar = getCharacterById(currentCharacterId) ?? MOCK_CHARACTERS[0];

  // Refresh Storage Stats
  const refreshStats = async () => {
    try {
      setStats((s) => ({ ...s, loading: true }));
      const { characters } = await idbLoadAllCharacters();
      const sessions = await idbLoadAllChatSessions();
      const memories = await idbLoadAllDynamicMemories();

      let totalMsgs = 0;
      for (const sess of sessions) {
        if (sess && Array.isArray(sess.messages)) {
          totalMsgs += sess.messages.length;
        }
      }

      let totalMems = 0;
      for (const mList of Object.values(memories)) {
        if (Array.isArray(mList)) {
          totalMems += mList.length;
        }
      }

      setStats({
        charCount: characters.length,
        msgCount: totalMsgs,
        memoryCount: totalMems,
        loading: false,
      });
    } catch {
      setStats((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    refreshStats();
  }, [currentCharacterId]);

  // Handle Full Zip Export
  const handleExportFullZip = async () => {
    try {
      setExportingZip(true);
      setExportSuccessMsg(null);
      await exportFullBackupZip();
      setExportSuccessMsg('全量分文件 ZIP 备份包已成功生成并下载！');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`导出备份失败: ${err.message || String(err)}`);
    } finally {
      setExportingZip(false);
    }
  };

  // Handle File Drop / Select for Inspection (Dry Run)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    try {
      setInspecting(true);
      setImportResult(null);
      setInspectionReport(null);

      const report = await inspectImportFile(file);
      setInspectionReport(report);

      // Pre-select all detected character IDs
      const detectedIds = new Set<string>();
      report.characters.forEach((c) => detectedIds.add(c.character.character_id));
      report.chats.forEach((c) => detectedIds.add(c.characterId));
      report.memories.forEach((m) => detectedIds.add(m.characterId));
      setSelectedCharIds(Array.from(detectedIds));
    } catch (err: any) {
      alert(`文件预检失败: ${err.message || String(err)}`);
    } finally {
      setInspecting(false);
    }
  };

  // Handle Commit / Execute Import
  const handleExecuteImport = async () => {
    if (!inspectionReport) return;

    try {
      setExecuting(true);
      const options: ImportOptions = {
        mode: importMode,
        importCharacters: importChars,
        importChats: importChats,
        importMemories: importMemories,
        importSettings: importSettings,
        selectedCharacterIds: selectedCharIds.length > 0 ? selectedCharIds : undefined,
      };

      const result = await executeImport(inspectionReport, options);
      setImportResult(result);
      if (result.success) {
        await refreshStats();
        if (onDataImported) onDataImported();
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        importedCharactersCount: 0,
        importedMessagesCount: 0,
        importedMemoriesCount: 0,
        importedSettingsCount: 0,
        message: `导入失败: ${err.message || String(err)}`,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 text-[#4a3e3d] font-serif">
      {/* Overview & IndexedDB Storage Banner */}
      <div className="rounded-2xl border border-[#f2d0d9] bg-gradient-to-br from-[#fff7f9] to-[#fcedf1]/60 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-white border border-[#f2d0d9] flex items-center justify-center text-[#e07a93] shadow-xs shrink-0">
              <Database className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#732641]">本地 IndexedDB 高容量存储与数据安全</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e07a93]/10 text-[#8a3854] border border-[#e07a93]/20">
                  突破 5MB 限制 · 纯本地无云端
                </span>
              </div>
              <p className="text-xs text-[#8c7377] mt-0.5">
                所有对话记录、多版本回复与高情绪记忆均在浏览器本地 IndexedDB 存储，支持高容忍度独立分文件导入与导出。
              </p>
            </div>
          </div>

          {/* Quick Storage Stats */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto bg-white/80 px-3 py-2 rounded-xl border border-[#f2d0d9] text-xs">
            <div className="text-center px-2">
              <div className="text-[10px] text-[#998380]">角色档案</div>
              <div className="font-bold text-[#732641]">{stats.loading ? '...' : stats.charCount}</div>
            </div>
            <div className="w-px h-6 bg-[#f2d0d9]" />
            <div className="text-center px-2">
              <div className="text-[10px] text-[#998380]">历史对话条数</div>
              <div className="font-bold text-[#e07a93]">{stats.loading ? '...' : stats.msgCount}</div>
            </div>
            <div className="w-px h-6 bg-[#f2d0d9]" />
            <div className="text-center px-2">
              <div className="text-[10px] text-[#998380]">沉淀记忆</div>
              <div className="font-bold text-[#5c4046]">{stats.loading ? '...' : stats.memoryCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Export Section vs Import Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ========================================================================= */}
        {/* 1. EXPORT SECTION */}
        {/* ========================================================================= */}
        <div className="space-y-4 rounded-2xl border border-[#f2d0d9] bg-white p-4.5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#f5dce3] pb-2.5">
              <div className="flex items-center gap-2">
                <FileArchive className="size-4 text-[#e07a93]" />
                <h4 className="text-xs font-bold text-[#732641] tracking-wide">数据导出 · 分文件安全打包</h4>
              </div>
              <span className="text-[11px] text-[#998380]">自动脱敏 API Key</span>
            </div>

            {/* Primary Action: Full Modular ZIP Backup */}
            <div className="p-3.5 rounded-xl border border-[#f5dce3] bg-[#fffafb] space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#4a3e3d] flex items-center gap-1.5">
                    <span>全量分文件 ZIP 完整备份包</span>
                    <Sparkles className="size-3.5 text-[#e07a93]" />
                  </div>
                  <p className="text-[11px] text-[#8c7377] mt-0.5 leading-relaxed">
                    严格分文件打包所有角色（<code>characters/*.json</code>）、全部对话（<code>chats/*.json</code>）、记忆沉淀（<code>memories/*.json</code>）及提示词预设方案。杜绝单 JSON 大包坏块风险。
                  </p>
                </div>
              </div>

              <button
                onClick={handleExportFullZip}
                disabled={exportingZip}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#e07a93] to-[#d66580] hover:from-[#d66580] hover:to-[#c4536e] active:scale-[0.99] text-white text-xs font-bold shadow-md shadow-[#e07a93]/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {exportingZip ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>正在打包分文件数据...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    <span>导出全量 ZIP 备份包（推荐）</span>
                  </>
                )}
              </button>

              {exportSuccessMsg && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in-0">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Secondary Granular Export Actions */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold text-[#8a3854]">或导出指定单项数据：</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Export All Characters Chats */}
                <button
                  onClick={() => exportAllCharactersChatsToJson()}
                  className="p-2.5 text-left rounded-xl border border-[#f2d0d9] bg-white hover:bg-[#fcedf1]/60 hover:border-[#e07a93] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#4a3e3d] group-hover:text-[#8a3854] truncate flex items-center gap-1">
                      <span>全部角色聊天记录</span>
                      <Sparkles className="size-3 text-[#e07a93]" />
                    </div>
                    <div className="text-[10px] text-[#998380]">一键导出所有角色全部历史对话</div>
                  </div>
                  <Download className="size-3.5 text-[#998380] group-hover:text-[#e07a93] shrink-0 ml-1" />
                </button>

                {/* Export Current Char Chat */}
                <button
                  onClick={() => exportCharacterChatToJson(currentChar.character_id, currentChar.name)}
                  className="p-2.5 text-left rounded-xl border border-[#f2d0d9] bg-white hover:bg-[#fcedf1]/60 hover:border-[#e07a93] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#4a3e3d] group-hover:text-[#8a3854] truncate">
                      「{currentChar.name}」单人聊天
                    </div>
                    <div className="text-[10px] text-[#998380]">仅导出当前角色历史与分支</div>
                  </div>
                  <Download className="size-3.5 text-[#998380] group-hover:text-[#e07a93] shrink-0 ml-1" />
                </button>

                {/* Export Current Char Card */}
                <button
                  onClick={() => exportSingleCharacterCard(currentChar)}
                  className="p-2.5 text-left rounded-xl border border-[#f2d0d9] bg-white hover:bg-[#fcedf1]/60 hover:border-[#e07a93] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#4a3e3d] group-hover:text-[#8a3854] truncate">
                      「{currentChar.name}」人设卡
                    </div>
                    <div className="text-[10px] text-[#998380]">核心档案与外观配置</div>
                  </div>
                  <Download className="size-3.5 text-[#998380] group-hover:text-[#e07a93] shrink-0 ml-1" />
                </button>

                {/* Export Prompt Presets */}
                <button
                  onClick={() => exportPromptPresetsToJson()}
                  className="p-2.5 text-left rounded-xl border border-[#f2d0d9] bg-white hover:bg-[#fcedf1]/60 hover:border-[#e07a93] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#4a3e3d] group-hover:text-[#8a3854] truncate">
                      提示词方案预设库
                    </div>
                    <div className="text-[10px] text-[#998380]">全部自定义预设方案</div>
                  </div>
                  <Download className="size-3.5 text-[#998380] group-hover:text-[#e07a93] shrink-0 ml-1" />
                </button>

                {/* Export System Settings */}
                <button
                  onClick={() => exportSettingsToJson()}
                  className="p-2.5 text-left rounded-xl border border-[#f2d0d9] bg-white hover:bg-[#fcedf1]/60 hover:border-[#e07a93] transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-semibold text-[#4a3e3d] group-hover:text-[#8a3854] truncate">
                      全局人设与拦截词典
                    </div>
                    <div className="text-[10px] text-[#998380]">脱敏系统规则包</div>
                  </div>
                  <Download className="size-3.5 text-[#998380] group-hover:text-[#e07a93] shrink-0 ml-1" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-[#998380] flex items-center gap-1.5 border-t border-[#f5dce3]/60">
            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span>导出格式为标规范化 JSON / ZIP，换电脑或清缓存随时无损导回。</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. IMPORT SECTION */}
        {/* ========================================================================= */}
        <div className="space-y-4 rounded-2xl border border-[#f2d0d9] bg-white p-4.5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#f5dce3] pb-2.5">
              <div className="flex items-center gap-2">
                <Upload className="size-4 text-[#e07a93]" />
                <h4 className="text-xs font-bold text-[#732641] tracking-wide">数据导入 · 高容忍度解析</h4>
              </div>
              <span className="text-[11px] text-[#998380]">支持 .zip / .json / .docx / .txt</span>
            </div>

            {/* File Drag & Drop Target */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip,.json,.docx,.txt"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-[#f2d0d9] hover:border-[#e07a93] bg-[#fffafb] hover:bg-[#fff5f7] rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all group select-none"
            >
              <div className="size-10 rounded-full bg-[#fcedf1] group-hover:bg-[#fbdde4] text-[#e07a93] flex items-center justify-center mx-auto mb-2 transition-colors">
                <Upload className="size-5" />
              </div>
              <div className="text-xs font-bold text-[#4a3e3d] group-hover:text-[#8a3854]">
                点击选择文件 或 拖拽文件至此区域
              </div>
              <p className="text-[11px] text-[#998380] mt-1 leading-relaxed">
                全量备份 ZIP、单角色聊天 JSON、手改角色卡 JSON / DOCX 均可自动识别与容错修复
              </p>
            </div>

            {inspecting && (
              <div className="p-3 bg-[#fcedf1]/60 rounded-xl border border-[#f2d0d9] flex items-center justify-center gap-2 text-xs text-[#8a3854]">
                <RefreshCw className="size-3.5 animate-spin" />
                <span>正在执行多层结构深度预检与字段自愈识别...</span>
              </div>
            )}
          </div>

          <div className="pt-2 text-[10px] text-[#998380] flex items-center gap-1.5 border-t border-[#f5dce3]/60">
            <Info className="size-3.5 text-[#e07a93] shrink-0" />
            <span>智能容错引擎：即使修改了字段名或格式不规范，系统也会全力抢救接住，不漏数据。</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DRY-RUN INSPECTION REPORT & EXECUTION PANEL */}
      {/* ========================================================================= */}
      {inspectionReport && (
        <div className="rounded-2xl border-2 border-[#e07a93] bg-white p-5 shadow-lg space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
          {/* Inspection Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#f2d0d9] pb-3">
            <div className="flex items-center gap-2">
              <LinePuppyMascot size={24} variant="sparkle" />
              <div>
                <div className="text-xs font-bold text-[#732641]">
                  预检就绪：{inspectionReport.fileName} ({(inspectionReport.fileSize / 1024).toFixed(1)} KB)
                </div>
                <div className="text-[11px] text-[#8c7377]">
                  预检发现：{inspectionReport.totalCharacters} 位角色 · {inspectionReport.totalMessages} 条对话记录 · {inspectionReport.totalMemories} 条动态记忆
                </div>
              </div>
            </div>

            <button
              onClick={() => setInspectionReport(null)}
              className="text-[#998380] hover:text-[#4a3e3d] text-xs px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
          </div>

          {/* Auto Repairs & Non-fatal Warning Notices */}
          {inspectionReport.autoRepairs.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1 text-xs">
              <div className="font-bold text-amber-800 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-600 shrink-0" />
                <span>智能容错引擎自动适配与修复：</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-900/80 space-y-0.5">
                {inspectionReport.autoRepairs.map((r, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-amber-950">[{r.target}]</span>: {r.action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Isolated Non-Fatal Errors */}
          {inspectionReport.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 space-y-1 text-xs">
              <div className="font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                <span>坏块隔离提示（以下损坏内容已自动跳过，不影响正常数据导入）：</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-red-900/80 space-y-0.5">
                {inspectionReport.errors.map((e, idx) => (
                  <li key={idx}>
                    {e.file && <span className="font-medium text-red-950">[{e.file}]: </span>}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Import Scope Options */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-bold text-[#4a3e3d]">选择导入模式与内容：</div>

            {/* Mode: Merge vs Overwrite */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                  importMode === 'merge'
                    ? 'border-[#e07a93] bg-[#fff5f7]'
                    : 'border-[#f2d0d9] bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-0.5 text-[#e07a93] focus:ring-[#e07a93]"
                />
                <div>
                  <div className="font-bold text-[#732641]">增量合并并去重（推荐）</div>
                  <div className="text-[11px] text-[#8c7377] mt-0.5">
                    保留当前已有记录，仅将新导入的聊天消息和记忆追加并按时序排列，避免丢失既有对话。
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                  importMode === 'overwrite'
                    ? 'border-[#e07a93] bg-[#fff5f7]'
                    : 'border-[#f2d0d9] bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'overwrite'}
                  onChange={() => setImportMode('overwrite')}
                  className="mt-0.5 text-[#e07a93] focus:ring-[#e07a93]"
                />
                <div>
                  <div className="font-bold text-[#732641]">完全覆盖替换</div>
                  <div className="text-[11px] text-[#8c7377] mt-0.5">
                    用导入文件中的记录完全替换当前角色会话状态。
                  </div>
                </div>
              </label>
            </div>

            {/* Item Checkboxes */}
            <div className="flex flex-wrap gap-4 pt-1 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importChars}
                  onChange={(e) => setImportChars(e.target.checked)}
                  className="rounded text-[#e07a93] focus:ring-[#e07a93]"
                />
                <span className="font-medium text-[#4a3e3d]">角色档案 ({inspectionReport.totalCharacters})</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importChats}
                  onChange={(e) => setImportChats(e.target.checked)}
                  className="rounded text-[#e07a93] focus:ring-[#e07a93]"
                />
                <span className="font-medium text-[#4a3e3d]">对话聊天记录 ({inspectionReport.totalMessages} 条)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importMemories}
                  onChange={(e) => setImportMemories(e.target.checked)}
                  className="rounded text-[#e07a93] focus:ring-[#e07a93]"
                />
                <span className="font-medium text-[#4a3e3d]">动态沉淀记忆 ({inspectionReport.totalMemories})</span>
              </label>

              {inspectionReport.settings && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importSettings}
                    onChange={(e) => setImportSettings(e.target.checked)}
                    className="rounded text-[#e07a93] focus:ring-[#e07a93]"
                  />
                  <span className="font-medium text-[#4a3e3d]">提示词预设方案与系统规则</span>
                </label>
              )}
            </div>

            {/* Granular Character Selective Checkboxes if multiple characters or single character chat */}
            {(inspectionReport.characters.length > 0 || inspectionReport.chats.length > 0) && (
              <div className="p-3 bg-[#fffafb] rounded-xl border border-[#f5dce3] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#732641]">选择需要导入的角色及聊天范围：</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = new Set<string>();
                        inspectionReport.characters.forEach((c) => allIds.add(c.character.character_id));
                        inspectionReport.chats.forEach((c) => allIds.add(c.characterId));
                        setSelectedCharIds(Array.from(allIds));
                      }}
                      className="text-[#e07a93] hover:underline cursor-pointer"
                    >
                      全选
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCharIds([])}
                      className="text-[#998380] hover:underline cursor-pointer"
                    >
                      清空
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {(() => {
                    const charItemsMap = new Map<string, { id: string; name: string; msgs: number; hasCard: boolean }>();
                    inspectionReport.characters.forEach((c) => {
                      charItemsMap.set(c.character.character_id, {
                        id: c.character.character_id,
                        name: c.character.name,
                        msgs: 0,
                        hasCard: true,
                      });
                    });
                    inspectionReport.chats.forEach((ch) => {
                      const prev = charItemsMap.get(ch.characterId);
                      if (prev) {
                        prev.msgs += ch.messages.length;
                      } else {
                        charItemsMap.set(ch.characterId, {
                          id: ch.characterId,
                          name: ch.characterName,
                          msgs: ch.messages.length,
                          hasCard: false,
                        });
                      }
                    });

                    return Array.from(charItemsMap.values()).map((item) => {
                      const isSelected = selectedCharIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#e07a93] bg-[#fff0f4] text-[#732641] font-semibold shadow-2xs'
                              : 'border-[#f2d0d9] bg-white text-[#786b6a] hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCharIds((prev) => [...prev, item.id]);
                                } else {
                                  setSelectedCharIds((prev) => prev.filter((id) => id !== item.id));
                                }
                              }}
                              className="rounded text-[#e07a93] focus:ring-[#e07a93]"
                            />
                            <span className="truncate">「{item.name}」</span>
                          </div>
                          {item.msgs > 0 && (
                            <span className="text-[10px] text-[#e07a93] px-1.5 py-0.5 rounded bg-white border border-[#f5dce3] shrink-0">
                              {item.msgs} 条
                            </span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Action Commit Button */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#f2d0d9]">
            <button
              onClick={() => setInspectionReport(null)}
              className="px-4 py-2 rounded-xl text-xs text-[#998380] hover:text-[#4a3e3d] hover:bg-gray-100 transition-colors"
            >
              放弃导入
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={executing}
              className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#e07a93] to-[#d66580] hover:from-[#d66580] hover:to-[#c4536e] active:scale-95 text-white text-xs font-bold shadow-md shadow-[#e07a93]/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {executing ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>正在安全写入 IndexedDB...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>确认执行导入并恢复数据</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. IMPORT COMPLETION BANNER */}
      {/* ========================================================================= */}
      {importResult && (
        <div
          className={`rounded-2xl border p-4 text-xs animate-in fade-in-0 flex items-start gap-3 ${
            importResult.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {importResult.success ? (
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 flex-1">
            <div className="font-bold text-sm">{importResult.success ? '数据导入恢复成功！' : '导入未完全成功'}</div>
            <p className="leading-relaxed">{importResult.message}</p>
          </div>
          <button
            onClick={() => setImportResult(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
