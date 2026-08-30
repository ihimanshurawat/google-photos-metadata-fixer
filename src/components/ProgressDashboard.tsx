import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  StopCircle,
} from 'lucide-react';
import { ProgressPayload, ExtractionProgressPayload } from '../types/takeout';

interface ProgressDashboardProps {
  progress: ProgressPayload | null;
  extractionProgress: ExtractionProgressPayload | null;
  onCancel: () => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  progress,
  onCancel,
}) => {
  const percent = progress ? Math.round(progress.percentage) : 0;
  const etaMinutes = progress ? Math.floor(progress.eta_seconds / 60) : 0;
  const etaSeconds = progress ? progress.eta_seconds % 60 : 0;
  const formattedEta = `${String(etaMinutes).padStart(2, '0')}:${String(etaSeconds).padStart(2, '0')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title & Stop Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Processing Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Embedding EXIF, GPS, and timestamp metadata directly into media files.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          <StopCircle className="w-4 h-4" /> Stop
        </button>
      </div>

      {/* Bento Grid Layout matching Stitch Design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress Card (Spans 2 cols) */}
        <div className="col-span-1 lg:col-span-2 bg-[#0f172a] rounded-xl border border-slate-800 p-6 flex flex-col justify-center space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-200">Overall Completion</span>
            <span className="font-mono text-blue-400 font-bold text-lg">{percent}%</span>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 shadow-lg shadow-blue-500/30"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Estimated time remaining: <strong className="text-slate-200 font-mono">{formattedEta}</strong>
            </span>
            <span>
              <strong className="text-slate-200 font-mono">{progress?.processed || 0}</strong> / {progress?.total || 0} files
            </span>
          </div>

          {progress?.current_file && (
            <div className="text-[11px] text-slate-500 font-mono truncate pt-1 border-t border-slate-800/60">
              Processing: <span className="text-blue-300">{progress.current_file}</span>
            </div>
          )}
        </div>

        {/* Status Counters (Spans 1 col) */}
        <div className="col-span-1 grid grid-rows-3 gap-3">
          <div className="bg-[#0f172a] rounded-xl p-3.5 border border-slate-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-slate-200">Completed</span>
            </div>
            <span className="font-mono font-bold text-emerald-400">{progress?.processed || 0}</span>
          </div>

          <div className="bg-[#0f172a] rounded-xl p-3.5 border border-slate-800 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-slate-200">Throughput Speed</span>
            </div>
            <span className="font-mono font-bold text-amber-300">
              {progress?.speed_items_sec || 0} <span className="text-[11px] font-normal text-slate-500">items/s</span>
            </span>
          </div>

          <div className="bg-rose-500/10 rounded-xl p-3.5 border border-rose-500/20 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="font-medium text-rose-300">Errors</span>
            </div>
            <span className="font-mono font-bold text-rose-400">0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
