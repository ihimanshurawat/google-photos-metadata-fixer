import React from 'react';
import { Layers, Loader2, Sparkles } from 'lucide-react';

export const CollatingScreen: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 animate-fade-in text-center max-w-xl mx-auto my-12">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Step 2 of 3: Collating & Matching Files
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            Scanning all extracted folders, resolving cross-archive metadata JSONs, and analyzing filenames for fallback timestamps...
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-indigo-300 font-medium">
          <Sparkles className="w-3.5 h-3.5" /> Multi-Pass Heuristic Matching
        </div>
        <div>Indexed across all 27 archives. The scan summary will appear in a moment.</div>
      </div>
    </div>
  );
};
