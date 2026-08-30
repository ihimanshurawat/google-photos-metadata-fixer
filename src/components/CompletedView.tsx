import React from 'react';
import {
  CheckCircle2,
  FolderOpen,
  RefreshCw,
  Clock,
  Images,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ProcessSummary } from '../types/takeout';

interface CompletedViewProps {
  summary: ProcessSummary;
  targetPath: string;
  onReset: () => void;
}

export const CompletedView: React.FC<CompletedViewProps> = ({
  summary,
  targetPath,
  onReset,
}) => {
  const handleOpenFolder = async () => {
    try {
      await invoke('open_path_in_finder', { path: targetPath });
    } catch (err) {
      console.error('Failed to open folder in Finder:', err);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-8 animate-fade-in text-center max-w-3xl mx-auto">
      {/* Success Hero Header matching Stitch Screen 4 */}
      <div className="space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Operation Complete</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Batch processing finished successfully. All selected metadata fields have been updated and clean media files exported.
        </p>
      </div>

      {/* Bento Stats Grid matching Stitch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {/* Total Processed */}
        <div className="bg-[#090d16] border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Images className="w-4 h-4" /> Total Processed
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{summary.total_files.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1">Files analyzed</div>
          </div>
        </div>

        {/* Successfully Fixed */}
        <div className="bg-[#090d16] border border-emerald-900/30 p-5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <CheckCheck className="w-4 h-4" /> Successfully Fixed
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300 font-mono">{summary.successful.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-500/80 mt-1">Metadata updated &amp; clean</div>
          </div>
        </div>

        {/* Skipped / Errors */}
        <div className="bg-[#090d16] border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Skipped / As-Is
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{summary.skipped.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1">Copied cleanly as-is</div>
          </div>
        </div>
      </div>

      <div className="p-3.5 bg-[#090d16] border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Elapsed Execution Time: <strong className="text-slate-200 font-mono">{summary.elapsed_seconds}s</strong>
        </span>
        <span className="font-mono text-blue-300 truncate max-w-sm">{targetPath}</span>
      </div>

      {/* Action Buttons matching Stitch */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" /> Open Output Folder
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Start New Batch
        </button>
      </div>
    </div>
  );
};
