import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Sliders,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  CheckCircle2,
  HelpCircle,
  FileCode,
  Film,
  FileX,
  PlayCircle,
  FileText,
  FolderOpen,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Laptop,
} from 'lucide-react';
import { AppConfig, DiagnosticInfoDto } from '../types/takeout';
import { logUiEvent } from '../utils/logger';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'patterns' | 'extensions' | 'ignored' | 'logs'>('patterns');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New item inputs
  const [newPattern, setNewPattern] = useState<string>('');
  const [newExt, setNewExt] = useState<string>('');
  const [newIgnored, setNewIgnored] = useState<string>('');

  // Live Sandbox state
  const [testFilename, setTestFilename] = useState<string>('852925438_265324.jpg');
  const [testCandidates, setTestCandidates] = useState<string[]>([]);

  // Diagnostics state
  const [diagInfo, setDiagInfo] = useState<DiagnosticInfoDto | null>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [clearSuccess, setClearSuccess] = useState<boolean>(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await invoke<AppConfig>('get_app_config');
      setConfig(res);
    } catch (err) {
      console.error('Failed to load app config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      setDiagLoading(true);
      const res = await invoke<DiagnosticInfoDto>('get_diagnostic_info');
      setDiagInfo(res);
    } catch (err) {
      console.error('Failed to fetch diagnostics:', err);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchDiagnostics();
    logUiEvent('SETTINGS', 'OPENED', 'User opened Settings Modal');
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchDiagnostics();
      logUiEvent('SETTINGS', 'TAB_SWITCH', 'Switched to Diagnostic Logs tab');
    }
  }, [activeTab]);

  // Update live test candidates when testFilename or config changes
  useEffect(() => {
    if (!config || !testFilename.trim()) {
      setTestCandidates([]);
      return;
    }

    const runTest = async () => {
      try {
        const candidates = await invoke<string[]>('test_pattern_matching', {
          sampleFilename: testFilename.trim(),
          patterns: config.custom_json_patterns,
        });
        setTestCandidates(candidates);
      } catch (err) {
        console.error('Test pattern matching error:', err);
      }
    };

    const timeout = setTimeout(runTest, 100);
    return () => clearTimeout(timeout);
  }, [testFilename, config?.custom_json_patterns]);

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      await invoke('save_app_config', { config });
      logUiEvent('SETTINGS', 'SAVE_CONFIG', 'Saved updated configuration');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Failed to save config: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all match patterns and extensions to defaults?')) {
      return;
    }
    try {
      setLoading(true);
      const defaults = await invoke<AppConfig>('reset_app_config');
      setConfig(defaults);
      logUiEvent('SETTINGS', 'RESET_DEFAULTS', 'Reset all patterns and configs to default');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Failed to reset config: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogFolder = async () => {
    try {
      await invoke('open_log_directory');
      logUiEvent('DIAGNOSTICS', 'OPEN_LOG_FOLDER', diagInfo?.log_dir || 'OS log dir');
    } catch (err: any) {
      alert(`Failed to open log folder: ${err}`);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all diagnostic log files?')) return;
    try {
      await invoke('clear_diagnostic_logs');
      setClearSuccess(true);
      setTimeout(() => setClearSuccess(false), 2000);
      await fetchDiagnostics();
    } catch (err: any) {
      alert(`Failed to clear logs: ${err}`);
    }
  };

  const handleCopyLogs = async () => {
    if (!diagInfo || diagInfo.recent_logs.length === 0) return;
    try {
      await navigator.clipboard.writeText(diagInfo.recent_logs.join('\n'));
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
      logUiEvent('DIAGNOSTICS', 'COPY_LOGS', 'Copied diagnostic log lines to clipboard');
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  // Pattern actions
  const handleAddPattern = () => {
    if (!newPattern.trim() || !config) return;
    const pat = newPattern.trim();
    if (!config.custom_json_patterns.includes(pat)) {
      setConfig({
        ...config,
        custom_json_patterns: [pat, ...config.custom_json_patterns],
      });
      setNewPattern('');
    }
  };

  const handleRemovePattern = (idx: number) => {
    if (!config) return;
    const updated = [...config.custom_json_patterns];
    updated.splice(idx, 1);
    setConfig({ ...config, custom_json_patterns: updated });
  };

  // Extension actions
  const handleAddExt = () => {
    if (!newExt.trim() || !config) return;
    const ext = newExt.trim().toLowerCase().replace(/^\./, '');
    if (!config.custom_media_extensions.includes(ext)) {
      setConfig({
        ...config,
        custom_media_extensions: [...config.custom_media_extensions, ext],
      });
      setNewExt('');
    }
  };

  const handleRemoveExt = (extToRemove: string) => {
    if (!config) return;
    setConfig({
      ...config,
      custom_media_extensions: config.custom_media_extensions.filter((e) => e !== extToRemove),
    });
  };

  // Ignored file actions
  const handleAddIgnored = () => {
    if (!newIgnored.trim() || !config) return;
    const ign = newIgnored.trim().toLowerCase();
    if (!config.ignored_json_names.includes(ign)) {
      setConfig({
        ...config,
        ignored_json_names: [...config.ignored_json_names, ign],
      });
      setNewIgnored('');
    }
  };

  const handleRemoveIgnored = (ignToRemove: string) => {
    if (!config) return;
    setConfig({
      ...config,
      ignored_json_names: config.ignored_json_names.filter((ig) => ig !== ignToRemove),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700/90 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Application &amp; Pattern Settings
              </h3>
              <p className="text-xs text-slate-400">
                Configure sidecar matching templates, media formats, and diagnostic telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save & Clear success toasts */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings successfully saved to local persistent configuration!</span>
          </div>
        )}

        {clearSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Diagnostic log files cleared successfully from OS log directory!</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-[#0b1120] p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('patterns')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'patterns'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Patterns ({config?.custom_json_patterns.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('extensions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'extensions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Formats ({config?.custom_media_extensions.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('ignored')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'ignored'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileX className="w-3.5 h-3.5" />
            <span>Ignored ({config?.ignored_json_names.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Diagnostic Logs</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 italic text-xs">Loading configuration...</div>
          ) : activeTab === 'patterns' && config ? (
            /* TAB 1: JSON PATTERNS */
            <div className="space-y-4 text-xs">
              {/* Template variables pill bar */}
              <div className="p-3 bg-[#090d16] border border-slate-800 rounded-xl space-y-1.5">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-400" /> Supported Template Placeholders:
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px]">
                    {'{filename}'} = full filename
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px]">
                    {'{stem}'} = filename without ext
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px]">
                    {'{ext}'} = file extension
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px]">
                    {'{num}'} = duplicate number
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px]">
                    {'{base_stem}'} = stem without (1)
                  </span>
                </div>
              </div>

              {/* Add new pattern input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. {filename}.supplemental-metadata.json"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
                  className="flex-1 bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                />
                <button
                  onClick={handleAddPattern}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Pattern
                </button>
              </div>

              {/* Pattern List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {config.custom_json_patterns.map((pat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[10px] w-4">{idx + 1}.</span>
                      <span className="font-mono text-slate-200 font-medium">{pat}</span>
                    </div>
                    <button
                      onClick={() => handleRemovePattern(idx)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Remove pattern"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Interactive Live Pattern Sandbox */}
              <div className="p-4 bg-[#090d16] rounded-xl border border-blue-900/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-blue-400" /> Live Pattern Sandbox Tester
                  </span>
                  <span className="text-[11px] text-slate-400">Generates candidate JSONs in real-time</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs shrink-0">Sample Media:</span>
                  <input
                    type="text"
                    value={testFilename}
                    onChange={(e) => setTestFilename(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Generated Candidate Sidecars ({testCandidates.length}):
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                    {testCandidates.map((cand, idx) => (
                      <div key={idx} className="text-emerald-300 flex items-center gap-1.5 truncate">
                        <span className="text-slate-600 text-[10px]">{idx + 1}.</span>
                        <span>{cand}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'extensions' && config ? (
            /* TAB 2: EXTENSIONS */
            <div className="space-y-4 text-xs">
              <p className="text-slate-400 text-xs">
                Photos, RAW camera formats, and video extensions that the tool will detect and process.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. cr3, arw, nef, insv"
                  value={newExt}
                  onChange={(e) => setNewExt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExt()}
                  className="flex-1 bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                />
                <button
                  onClick={handleAddExt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Format
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-3 bg-[#090d16] rounded-xl border border-slate-800 max-h-64 overflow-y-auto">
                {config.custom_media_extensions.map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs"
                  >
                    <span>.{ext}</span>
                    <button
                      onClick={() => handleRemoveExt(ext)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : activeTab === 'ignored' && config ? (
            /* TAB 3: IGNORED FILES */
            <div className="space-y-4 text-xs">
              <p className="text-slate-400 text-xs">
                JSON files generated by Google Takeout that contain album info, comments, or settings rather than image metadata.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. print-subscriptions.json"
                  value={newIgnored}
                  onChange={(e) => setNewIgnored(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIgnored()}
                  className="flex-1 bg-[#090d16] border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                />
                <button
                  onClick={handleAddIgnored}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Ignore Rule
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {config.ignored_json_names.map((ign) => (
                  <div
                    key={ign}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#090d16] border border-slate-800/80 text-xs"
                  >
                    <span className="font-mono text-slate-300 font-medium">{ign}</span>
                    <button
                      onClick={() => handleRemoveIgnored(ign)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'logs' ? (
            /* TAB 4: DIAGNOSTIC LOGS & TELEMETRY */
            <div className="space-y-4 text-xs">
              {/* Privacy Guarantee Box */}
              <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Local Diagnostic Telemetry &amp; System Logs</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">100% Offline &amp; Private</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The app writes structured diagnostic events (page clicks, archive extraction, metadata matching, and stitching errors) directly to your operating system's standard log directory. Logs are automatically rotated and cleaned per run.
                </p>
              </div>

              {/* Comprehensive OS & System Hardware Specs Card */}
              {diagInfo?.system_details && (
                <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-blue-400" />
                      <span>Host System &amp; Environment Diagnostics</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      v{diagInfo.system_details.app_version}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Operating System</span>
                      <span className="font-semibold text-slate-100 font-mono text-[11px] truncate block">
                        {diagInfo.system_details.os_version}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono block">
                        {diagInfo.system_details.os_build}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Architecture &amp; Kernel</span>
                      <span className="font-semibold text-blue-300 font-mono text-[11px] truncate block">
                        {diagInfo.system_details.architecture}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono block truncate">
                        {diagInfo.system_details.kernel_version}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">Hardware &amp; Cores</span>
                      <span className="font-semibold text-slate-200 font-mono text-[11px] truncate block">
                        {diagInfo.system_details.hardware_model}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono block">
                        {diagInfo.system_details.cpu_cores} Logical Cores
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">System Memory</span>
                      <span className="font-semibold text-purple-300 font-mono text-[11px] truncate block">
                        {diagInfo.system_details.total_memory}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono block">
                        Active Allocations
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[10.5px] text-slate-400 mb-1">
                      <span>Standard OS Log Directory:</span>
                      <span className="font-mono text-blue-400 uppercase">{diagInfo.os_name}</span>
                    </div>
                    <div className="font-mono text-[10.5px] text-blue-300 break-all bg-black/40 p-2 rounded-lg border border-slate-800">
                      {diagInfo.log_dir}
                    </div>
                  </div>
                </div>
              )}

              {/* Control Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleOpenLogFolder}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Log Directory</span>
                </button>

                <button
                  onClick={handleCopyLogs}
                  disabled={!diagInfo || diagInfo.recent_logs.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{copiedLogs ? 'Copied to Clipboard!' : 'Copy Recent Logs'}</span>
                </button>

                <button
                  onClick={fetchDiagnostics}
                  disabled={diagLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs border border-rose-500/30 transition-colors cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear All Logs</span>
                </button>
              </div>

              {/* Log preview console */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold">Current Run Diagnostic Log ({diagInfo?.recent_logs.length || 0} lines):</span>
                  <span className="text-[10px] text-slate-500">Live stream</span>
                </div>
                <div className="h-44 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800/90 font-mono text-[10.5px] leading-relaxed text-slate-300 space-y-0.5 select-text">
                  {diagInfo && diagInfo.recent_logs.length > 0 ? (
                    diagInfo.recent_logs.map((line, idx) => {
                      const isError = line.includes('[ERROR');
                      const isWarn = line.includes('[WARN');
                      const isEvent = line.includes('[UI_EVENT') || line.includes('[SYSTEM');
                      return (
                        <div
                          key={idx}
                          className={`truncate ${
                            isError
                              ? 'text-rose-400 font-semibold'
                              : isWarn
                              ? 'text-amber-300'
                              : isEvent
                              ? 'text-blue-300'
                              : 'text-slate-300'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-slate-500 italic py-6 text-center">No logs generated for current run yet.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            {activeTab !== 'logs' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
