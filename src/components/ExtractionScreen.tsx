import React from 'react';
import { Archive, Zap, HardDrive, FileText, XCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { ExtractionProgressPayload } from '../types/takeout';

interface ExtractionScreenProps {
  progress: ExtractionProgressPayload | null;
  onCancel: () => void;
}

export const ExtractionScreen: React.FC<ExtractionScreenProps> = ({ progress, onCancel }) => {
  const percent = progress ? Math.round(progress.overall_percentage) : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Step 1 of 3: Decompressing Takeout ZIP Archives
              </h2>
              <p className="text-xs text-slate-400">
                Extracting and consolidating split archives into a temporary staging workspace.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          <XCircle className="w-4 h-4" /> Cancel Extraction
        </button>
      </div>

      {/* Global Progress Bar */}
      <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            Overall Extraction: {progress?.formatted_bytes_extracted || '0 B'} of {progress?.formatted_total_bytes || '--'}
          </span>
          <span className="text-indigo-400 font-bold font-mono text-sm">{percent}%</span>
        </div>

        <div className="h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300 shadow-lg shadow-indigo-500/50"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
          <span>
            Processing Archive <strong className="text-slate-300 font-mono">{progress?.current_zip_index || 1}</strong> of <strong className="text-slate-300 font-mono">{progress?.total_zips || 1}</strong>: <code className="text-purple-300">{progress?.current_zip_name || 'Initializing...'}</code>
          </span>
          <span>{progress?.files_extracted || 0} files extracted</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Decompression Speed</div>
            <div className="text-sm font-bold text-slate-200">
              {progress?.speed_mb_sec || 0} <span className="text-xs font-normal text-slate-500">MB/s</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Total Archives</div>
            <div className="text-sm font-bold text-slate-200">
              {progress ? `${progress.current_zip_index} / ${progress.total_zips}` : '--'} <span className="text-xs font-normal text-slate-500">ZIPs</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="text-[11px] text-slate-400">Current Extracting Entry</div>
            <div className="text-xs font-mono text-slate-300 font-medium truncate">
              {progress?.current_file || 'Reading files...'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          Heavy decompression is running smoothly on a background thread. Once all archives are extracted, the app will automatically collate and analyze all media files in Step 2.
        </span>
      </div>
    </div>
  );
};
