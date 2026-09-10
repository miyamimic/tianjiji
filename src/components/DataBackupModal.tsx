import React, { useState, useEffect, useRef } from 'react';
import '@react95/fonts/sans-serif/8pt';
import { 
  Download, 
  Upload, 
  Database,
  Info,
  Check,
  X,
  AlertTriangle,
  CheckCircle2
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

// ================= CUSTOM RETRO SYSTEM ICONS =================

const FileCabinetIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* 3D Drawer Cabinet Outline */}
    <rect x="6" y="4" width="20" height="24" fill="#ffdf70" stroke="#000" strokeWidth="1.5" />
    {/* Divider lines between drawers */}
    <line x1="6" y1="14" x2="26" y2="14" stroke="#000" strokeWidth="1.5" />
    <line x1="6" y1="21" x2="26" y2="21" stroke="#000" strokeWidth="1.5" />
    {/* Drawer handles */}
    <rect x="12" y="8" width="8" height="2" fill="#fff" stroke="#000" strokeWidth="1" />
    <rect x="12" y="16" width="8" height="2" fill="#fff" stroke="#000" strokeWidth="1" />
    <rect x="12" y="23" width="8" height="2" fill="#fff" stroke="#000" strokeWidth="1" />
  </svg>
);

const ChatsFolderIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Retro Yellow Manila Folder */}
    <path d="M4 6V26H28V10H16L12 6H4Z" fill="#ffdf70" stroke="#000" strokeWidth="1.5" />
    {/* Paper sticking out slightly */}
    <rect x="8" y="13" width="16" height="9" fill="#fff" stroke="#000" strokeWidth="1" />
    <line x1="11" y1="16" x2="16" y2="16" stroke="#000" strokeWidth="1" />
    <line x1="11" y1="19" x2="21" y2="19" stroke="#000" strokeWidth="1" />
  </svg>
);

const CardsExportIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Personal Card Layout */}
    <rect x="4" y="6" width="24" height="20" fill="#fff" stroke="#000" strokeWidth="1.5" />
    <rect x="6" y="8" width="20" height="4" fill="#0000a8" />
    {/* Character avatar silhouette */}
    <circle cx="10" cy="18" r="3" fill="#00aaaa" stroke="#000" strokeWidth="1" />
    <path d="M6 24C6 21 8 21 10 21C12 21 14 21 14 24" fill="#00aaaa" stroke="#000" strokeWidth="1" />
    {/* Information lines */}
    <line x1="16" y1="16" x2="23" y2="16" stroke="#000" strokeWidth="1" />
    <line x1="16" y1="19" x2="21" y2="19" stroke="#000" strokeWidth="1" />
    <line x1="16" y1="22" x2="24" y2="22" stroke="#000" strokeWidth="1" />
  </svg>
);

const PromptPresetsIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Spiral binder notebook */}
    <rect x="8" y="4" width="18" height="24" fill="#fff" stroke="#000" strokeWidth="1.5" />
    {/* Spiral rings */}
    <circle cx="6" cy="8" r="1.5" fill="#d4d4d4" stroke="#000" strokeWidth="1" />
    <line x1="6" y1="8" x2="9" y2="8" stroke="#000" strokeWidth="1.2" />
    <circle cx="6" cy="14" r="1.5" fill="#d4d4d4" stroke="#000" strokeWidth="1" />
    <line x1="6" y1="14" x2="9" y2="14" stroke="#000" strokeWidth="1.2" />
    <circle cx="6" cy="20" r="1.5" fill="#d4d4d4" stroke="#000" strokeWidth="1" />
    <line x1="6" y1="20" x2="9" y2="20" stroke="#000" strokeWidth="1.2" />
    <circle cx="6" cy="26" r="1.5" fill="#d4d4d4" stroke="#000" strokeWidth="1" />
    <line x1="6" y1="26" x2="9" y2="26" stroke="#000" strokeWidth="1.2" />
    {/* Writing lines */}
    <line x1="12" y1="10" x2="22" y2="10" stroke="#0000a8" strokeWidth="1" />
    <line x1="12" y1="15" x2="20" y2="15" stroke="#000" strokeWidth="0.8" />
    <line x1="12" y1="20" x2="24" y2="20" stroke="#000" strokeWidth="0.8" />
  </svg>
);

const ControlPanelIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Retro gray computer case with CRT display */}
    <rect x="4" y="4" width="24" height="18" fill="#d4d4d4" stroke="#000" strokeWidth="1.5" rx="1" />
    {/* Blue CRT screen */}
    <rect x="7" y="7" width="18" height="12" fill="#0000a8" stroke="#000" strokeWidth="1" />
    {/* Outer stand */}
    <path d="M11 22L13 26H19L21 22H11Z" fill="#a0a0a0" stroke="#000" strokeWidth="1.5" />
    {/* Dynamic CRT lines inside screen */}
    <line x1="9" y1="10" x2="23" y2="10" stroke="#00ffff" strokeWidth="1" opacity="0.4" />
    <line x1="9" y1="14" x2="18" y2="14" stroke="#00ffff" strokeWidth="1" opacity="0.4" />
  </svg>
);

const FloppyDiskIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Classic 3.5" Blue Floppy Disk */}
    <path d="M4 4H24L28 8V28H4V4Z" fill="#0000a8" stroke="#000" strokeWidth="1.5" />
    {/* White sliding sticker label */}
    <rect x="8" y="15" width="16" height="13" fill="#fff" stroke="#000" strokeWidth="1.2" />
    <line x1="10" y1="18" x2="22" y2="18" stroke="#ff00ff" strokeWidth="1.5" />
    <line x1="10" y1="22" x2="19" y2="22" stroke="#000" strokeWidth="1" />
    {/* Shutter gate */}
    <rect x="10" y="4" width="10" height="8" fill="#c0c0c0" stroke="#000" strokeWidth="1.2" />
    <rect x="12" y="6" width="2" height="4" fill="#000" />
  </svg>
);

const PrinterIcon = () => (
  <svg className="w-14 h-14 select-none pointer-events-none" viewBox="0 0 32 32" fill="none">
    {/* Printer device */}
    <rect x="6" y="11" width="20" height="13" fill="#d4d4d4" stroke="#000" strokeWidth="1.5" />
    {/* Upper paper slot */}
    <rect x="10" y="4" width="12" height="7" fill="#fff" stroke="#000" strokeWidth="1.2" />
    {/* Bottom paper feed output */}
    <rect x="9" y="19" width="14" height="10" fill="#fff" stroke="#000" strokeWidth="1.2" />
    <line x1="12" y1="22" x2="20" y2="22" stroke="#000" strokeWidth="1" />
    <line x1="12" y1="25" x2="18" y2="25" stroke="#000" strokeWidth="1" />
    {/* Action indicator lamps */}
    <circle cx="22" cy="15" r="1" fill="#00ff00" />
  </svg>
);

interface Props {
  currentCharacterId: string;
  onDataImported?: () => void;
  onClose?: () => void;
}

export default function DataBackupModal({ currentCharacterId, onDataImported, onClose }: Props) {
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

  // Export States
  const [exportingZip, setExportingZip] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Import / Inspect States
  const [inspecting, setInspecting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [inspectionReport, setInspectionReport] = useState<ImportInspectionReport | null>(null);
  const [importResult, setImportResult] = useState<ImportExecuteResult | null>(null);

  // Import Configuration Options State
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importChars, setImportChars] = useState(true);
  const [importChats, setImportChats] = useState(true);
  const [importMemories, setImportMemories] = useState(true);
  const [importSettings, setImportSettings] = useState(true);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  // Statistics Modal state
  const [showStatsModal, setShowStatsModal] = useState(false);

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
    } catch (err: any) {
      alert(`导出备份失败: ${err.message || String(err)}`);
    } finally {
      setExportingZip(false);
    }
  };

  // Handle File Input Select for Inspection
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

      // Pre-select all detected character IDs in report
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

  // Execute Import
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
      setInspectionReport(null); // Close the options report popup on success
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
    <div className="w-full h-full min-h-[460px] bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black flex flex-col relative shadow-[2px_2px_0px_#000] text-black font-mono text-xs select-none">
      
      {/* Hidden File Input Picker for Floppy disk interaction */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".zip,.json,.docx,.txt"
        className="hidden"
      />

      {/* Title Bar */}
      <div className="h-7 bg-white border-b border-black flex items-center justify-between px-2 select-none shrink-0">
        <div 
          onDoubleClick={onClose}
          className="w-4 h-4 bg-[#c0c0c0] border border-black flex items-center justify-center shrink-0 cursor-pointer"
          title="控制菜单 (双击关闭)"
        >
          <div className="w-2.5 h-1 bg-black" />
        </div>
        
        <span className="flex-1 text-center font-bold text-black tracking-wide text-[16px] sm:text-[18px]" style={{ fontFamily: "'R95 Sans Serif 8pt', sans-serif", WebkitFontSmoothing: "none" }}>
          Backup
        </span>
        
        {/* Close button (叉掉按钮) */}
        <div 
          onClick={onClose}
          className="w-4 h-4 bg-[#c0c0c0] border border-black flex items-center justify-center text-[10px] font-bold shrink-0 hover:bg-red-600 hover:text-white active:bg-black active:text-white cursor-pointer select-none"
          title="关闭"
        >
          ✕
        </div>
      </div>

      {/* Window Menu Bar (Underlined hotkeys) */}
      <div className="h-6 bg-[#c0c0c0] border-b border-black px-3.5 flex items-center gap-5 text-[15px] sm:text-[16px] font-bold text-black shrink-0" style={{ fontFamily: "'R95 Sans Serif 8pt', sans-serif", WebkitFontSmoothing: "none" }}>
        <span className="cursor-default"><span className="underline">F</span>ile</span>
        <span className="cursor-default"><span className="underline">O</span>ptions</span>
        <span className="cursor-default"><span className="underline">W</span>indow</span>
        <span className="cursor-default"><span className="underline">H</span>elp</span>
      </div>

      {/* Client Area (Pure solid white background, thick retro frame inset) */}
      <div className="flex-1 p-5 bg-white border-2 border-t-black border-l-black border-b-white border-r-white m-1.5 overflow-y-auto">
        
        {/* Retro Desktop-like Desktop Icon Grid - 4 or more columns horizontally and vertically */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-y-8 gap-x-3 text-center justify-items-center">
          
          {/* Icon 1: Export Full ZIP */}
          <div 
            onDoubleClick={handleExportFullZip}
            onClick={handleExportFullZip}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击打包导出系统全量备份"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <FileCabinetIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              打包备份.ZIP
            </span>
          </div>

          {/* Icon 2: Export All Chats */}
          <div 
            onDoubleClick={exportAllCharactersChatsToJson}
            onClick={exportAllCharactersChatsToJson}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击导出全部历史对话"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <ChatsFolderIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              全部对话.JSON
            </span>
          </div>

          {/* Icon 3: Export Current Character Card */}
          <div 
            onDoubleClick={() => exportSingleCharacterCard(currentChar)}
            onClick={() => exportSingleCharacterCard(currentChar)}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title={`导出当前角色 [${currentChar.name}] 人设档案`}
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <CardsExportIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2 truncate">
              {currentChar.name}档案.JSON
            </span>
          </div>

          {/* Icon 4: Export Prompt Presets */}
          <div 
            onDoubleClick={exportPromptPresetsToJson}
            onClick={exportPromptPresetsToJson}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击导出自定义提示词方案"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <PromptPresetsIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              提示预设.JSON
            </span>
          </div>

          {/* Icon 5: Export System Settings */}
          <div 
            onDoubleClick={exportSettingsToJson}
            onClick={exportSettingsToJson}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击导出系统规则与拦截设置"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <ControlPanelIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              系统规则.JSON
            </span>
          </div>

          {/* Icon 6: Floppy Disk - Import Restore */}
          <div 
            onDoubleClick={() => fileInputRef.current?.click()}
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击选择文件恢复本地数据库"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <FloppyDiskIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              数据恢复
            </span>
          </div>

          {/* Icon 7: Storage stats (Printer) */}
          <div 
            onDoubleClick={() => setShowStatsModal(true)}
            onClick={() => setShowStatsModal(true)}
            className="group flex flex-col items-center gap-1 cursor-pointer p-1.5 rounded hover:bg-[#0000a8] hover:text-white transition-all select-none"
            title="双击或点击查看本地数据库存容量"
          >
            <div className="w-16 h-16 flex items-center justify-center animate-none">
              <PrinterIcon />
            </div>
            <span className="text-[9px] font-bold tracking-tight leading-tight max-w-[85px] sm:max-w-[95px] break-all sm:break-normal line-clamp-2">
              存储统计
            </span>
          </div>

        </div>

        {/* Quick instructions inside white pane */}
        <div className="mt-10 pt-4 text-[10px] text-gray-500 space-y-1">
          <div>• 双击或点击上方图标执行对应备份/恢复操作。支持一排展示 4 个及以上图标的微调布局。</div>
          <div>• 本地数据存储于浏览器沙盒，导出可多份独立备份并随时通过 [数据恢复] 导回。</div>
        </div>
      </div>

      {/* Hidden Loading/Inspecting State Banner */}
      {inspecting && (
        <div className="absolute inset-x-2 bottom-2 bg-yellow-100 border border-black p-2 text-[10.5px] text-black shadow-md z-40 flex items-center gap-2">
          <span>⌛ 正在对所选备份文件进行多层数据校验与自愈预检...</span>
        </div>
      )}

      {/* Hidden Exporting State Banner */}
      {exportingZip && (
        <div className="absolute inset-x-2 bottom-2 bg-yellow-100 border border-black p-2 text-[10.5px] text-black shadow-md z-40 flex items-center gap-2 animate-pulse">
          <span>⌛ 正在进行本地 IndexedDB 分卷提取并合并压缩，请稍候...</span>
        </div>
      )}

      {/* Export Success Alerts */}
      {exportSuccessMsg && (
        <div className="absolute inset-x-2 bottom-2 bg-emerald-100 border border-black p-2 text-[10.5px] text-emerald-900 shadow-md z-40 flex items-center justify-between">
          <span>✓ {exportSuccessMsg}</span>
          <button onClick={() => setExportSuccessMsg(null)} className="font-bold underline text-[9px] cursor-pointer">确定</button>
        </div>
      )}

      {/* ==================== MODAL DIALOG: STORAGE STATISTICS ==================== */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-80 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black p-1 shadow-lg text-black font-mono">
            {/* Modal Title Bar - NO MINUS BUTTONS */}
            <div className="h-5 bg-[#0000a8] text-white px-2 font-bold text-xs flex items-center justify-between">
              <span>存储属性</span>
              <button 
                onClick={() => setShowStatsModal(false)}
                className="w-3.5 h-3.5 bg-[#c0c0c0] text-black border border-black flex items-center justify-center text-[8px] font-bold"
              >
                ✕
              </button>
            </div>
            
            {/* Dialog Client Area */}
            <div className="p-3 bg-[#c0c0c0] text-[11px] space-y-2">
              <div className="bg-white p-2 border-2 border-t-black border-l-black border-b-white border-r-white space-y-1.5">
                <div className="font-bold text-gray-700 pb-1 border-b border-gray-200">本地 IndexedDB 统计:</div>
                <div className="flex justify-between">
                  <span>角色档案数:</span>
                  <span className="font-bold">{stats.loading ? '...' : stats.charCount} 位</span>
                </div>
                <div className="flex justify-between">
                  <span>对话消息数:</span>
                  <span className="font-bold">{stats.loading ? '...' : stats.msgCount} 条</span>
                </div>
                <div className="flex justify-between">
                  <span>多版高情绪记忆:</span>
                  <span className="font-bold">{stats.loading ? '...' : stats.memoryCount} 条</span>
                </div>
              </div>

              <div className="text-[9.5px] text-gray-600 leading-tight">
                * 本地存储已开启 IndexDb 扩容引擎，免除 localStorage 5MB 限制，纯本地安全运行。
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-1">
                <button 
                  onClick={() => setShowStatsModal(false)}
                  className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white text-xs font-bold font-mono shadow-[1px_1px_0px_#000] cursor-pointer"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL DIALOG: INSPECTION & IMPORT OPTIONS ==================== */}
      {inspectionReport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black p-1 shadow-lg text-black font-mono">
            {/* Modal Title Bar - NO MINUS BUTTON AS DIRECTED */}
            <div className="h-5 bg-[#0000a8] text-white px-2 font-bold text-xs flex items-center justify-between">
              <span>恢复数据包设置</span>
              <button 
                onClick={() => setInspectionReport(null)}
                className="w-3.5 h-3.5 bg-[#c0c0c0] text-black border border-black flex items-center justify-center text-[8px] font-bold"
              >
                ✕
              </button>
            </div>

            {/* Dialog Contents */}
            <div className="p-3 space-y-3 text-[11px]">
              
              {/* Inspection report summary */}
              <div className="bg-white p-2.5 border-2 border-t-black border-l-black border-b-white border-r-white space-y-1.5">
                <div className="font-bold text-[#0000a8]">数据预检成功: {inspectionReport.fileName}</div>
                <div>文件尺寸: {(inspectionReport.fileSize / 1024).toFixed(1)} KB</div>
                <div>预检测得: <b>{inspectionReport.totalCharacters}</b> 位角色 · <b>{inspectionReport.totalMessages}</b> 条对话 · <b>{inspectionReport.totalMemories}</b> 条动态记忆</div>
              </div>

              {/* Warnings and Auto-repairs if any */}
              {inspectionReport.autoRepairs.length > 0 && (
                <div className="bg-white p-2 border-2 border-t-black border-l-black border-b-white border-r-white text-amber-900 text-[10px] max-h-20 overflow-y-auto space-y-0.5">
                  <div className="font-bold text-amber-800">✓ 智能容错：</div>
                  {inspectionReport.autoRepairs.map((r, idx) => (
                    <div key={idx}>[{r.target}]: {r.action}</div>
                  ))}
                </div>
              )}

              {/* Form Option: Mode Merge vs Overwrite */}
              <div className="space-y-1.5">
                <div className="font-bold">选择数据注入模式:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-start gap-2 bg-white p-2 border-2 border-t-black border-l-black border-b-white border-r-white cursor-pointer">
                    <input 
                      type="radio" 
                      name="importMode" 
                      checked={importMode === 'merge'} 
                      onChange={() => setImportMode('merge')} 
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-[#0000a8]">追加合并 (推荐)</div>
                      <div className="text-[10px] text-gray-500">保留本地记录，仅增量安全合并</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 bg-white p-2 border-2 border-t-black border-l-black border-b-white border-r-white cursor-pointer">
                    <input 
                      type="radio" 
                      name="importMode" 
                      checked={importMode === 'overwrite'} 
                      onChange={() => setImportMode('overwrite')} 
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-red-700">完全覆盖替换</div>
                      <div className="text-[10px] text-gray-500">清空当前角色原记录并完全覆写</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Form Checkboxes for modules */}
              <div className="space-y-1">
                <div className="font-bold">选择需要恢复的模块:</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 bg-white p-2 border-2 border-t-black border-l-black border-b-white border-r-white">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={importChars} onChange={(e) => setImportChars(e.target.checked)} />
                    <span>角色档案 ({inspectionReport.totalCharacters})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={importChats} onChange={(e) => setImportChats(e.target.checked)} />
                    <span>对话条数 ({inspectionReport.totalMessages})</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={importMemories} onChange={(e) => setImportMemories(e.target.checked)} />
                    <span>动态记忆 ({inspectionReport.totalMemories})</span>
                  </label>
                  {inspectionReport.settings && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={importSettings} onChange={(e) => setImportSettings(e.target.checked)} />
                      <span>系统配置方案</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Selective List Box of characters */}
              {(inspectionReport.characters.length > 0 || inspectionReport.chats.length > 0) && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center font-bold">
                    <span>选择注入范围:</span>
                    <div className="flex gap-2 text-[10px]">
                      <button 
                        type="button" 
                        onClick={() => {
                          const allIds = new Set<string>();
                          inspectionReport.characters.forEach((c) => allIds.add(c.character.character_id));
                          inspectionReport.chats.forEach((c) => allIds.add(c.characterId));
                          setSelectedCharIds(Array.from(allIds));
                        }}
                        className="underline text-[#0000a8]"
                      >
                        全选
                      </button>
                      <span>|</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedCharIds([])}
                        className="underline text-gray-600"
                      >
                        清空
                      </button>
                    </div>
                  </div>

                  {/* Retro White Listbox */}
                  <div className="bg-white border-2 border-t-black border-l-black border-b-white border-r-white p-1.5 max-h-24 overflow-y-auto space-y-1">
                    {(() => {
                      const charItemsMap = new Map<string, { id: string; name: string; msgs: number }>();
                      inspectionReport.characters.forEach((c) => {
                        charItemsMap.set(c.character.character_id, {
                          id: c.character.character_id,
                          name: c.character.name,
                          msgs: 0,
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
                          });
                        }
                      });

                      return Array.from(charItemsMap.values()).map((item) => {
                        const isSelected = selectedCharIds.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center justify-between text-[10.5px] cursor-pointer hover:bg-gray-100 px-1">
                            <div className="flex items-center gap-1.5">
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
                              />
                              <span>「{item.name}」</span>
                            </div>
                            {item.msgs > 0 && <span className="text-gray-500 text-[9px]">({item.msgs}条对话)</span>}
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Action trigger buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-400">
                <button
                  type="button"
                  onClick={() => setInspectionReport(null)}
                  className="px-4 py-1.5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
                >
                  放弃
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={executing}
                  className="px-5 py-1.5 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white font-bold text-[#0000a8]"
                >
                  {executing ? '⌛ 正在注入...' : '确定恢复 (OK)'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL DIALOG: RESTORE RESULT REPORT ==================== */}
      {importResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-80 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black p-1 shadow-lg text-black font-mono">
            {/* Title Bar */}
            <div className="h-5 bg-[#0000a8] text-white px-2 font-bold text-xs flex items-center justify-between">
              <span>恢复数据包结果</span>
              <button 
                onClick={() => setImportResult(null)}
                className="w-3.5 h-3.5 bg-[#c0c0c0] text-black border border-black flex items-center justify-center text-[8px] font-bold"
              >
                ✕
              </button>
            </div>
            
            {/* Report Content */}
            <div className="p-3 space-y-2.5 text-[11px]">
              <div className="bg-white p-2.5 border-2 border-t-black border-l-black border-b-white border-r-white space-y-1.5">
                <div className={`font-bold ${importResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                  {importResult.success ? '✓ 数据库恢复导入成功！' : '✕ 数据恢复失败'}
                </div>
                <div className="text-gray-700 leading-normal">
                  {importResult.message}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <button 
                  onClick={() => setImportResult(null)}
                  className="px-4 py-1 bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white text-xs font-bold font-mono shadow-[1px_1px_0px_#000]"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
