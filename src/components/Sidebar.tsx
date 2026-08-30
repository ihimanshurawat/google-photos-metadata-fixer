import React from 'react';
import { PlaySquare, Search, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface SidebarProps {
  currentStage: 'idle' | 'extracting' | 'collating' | 'scanned' | 'processing' | 'completed';
  onNavigate?: (targetStage: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentStage }) => {
  const isWelcomeActive = currentStage === 'idle' || currentStage === 'extracting' || currentStage === 'collating';
  const isScanActive = currentStage === 'scanned';
  const isProcessingActive = currentStage === 'processing';
  const isReportsActive = currentStage === 'completed';

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.warn('Window drag error:', err);
      }
    }
  };

  return (
    <nav aria-label="Sidebar Navigation" className="w-64 bg-[#0b1120] border-r border-slate-800 flex flex-col pt-16 pb-4 shrink-0 select-none">
      {/* Brand Header with Drag Handler */}
      <div
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="px-6 mb-6 cursor-default"
      >
        <div data-tauri-drag-region className="flex items-center gap-3">
          <img
            src="/app_icon.png"
            alt="App Icon"
            className="w-9 h-9 rounded-xl shadow-lg shadow-blue-500/20 object-cover border border-slate-700/60 pointer-events-none"
          />
          <div data-tauri-drag-region>
            <h1 data-tauri-drag-region className="font-bold text-xs text-slate-100 tracking-tight leading-snug">Google Photos Metadata Fixer</h1>
            <p data-tauri-drag-region className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mt-0.5">Fix Metadata Offline</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <ul className="flex flex-col gap-1 text-xs font-medium flex-1">
        {/* Welcome */}
        <li
          className={`flex items-center gap-3 px-6 py-3 transition-all duration-150 ${
            isWelcomeActive
              ? 'border-l-4 border-blue-500 bg-blue-600/10 text-blue-300 font-semibold'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 opacity-80'
          }`}
        >
          <PlaySquare className={`w-4 h-4 ${isWelcomeActive ? 'text-blue-400' : 'text-slate-400'}`} />
          <span>Welcome &amp; Selection</span>
        </li>

        {/* Scan & Analysis */}
        <li
          className={`flex items-center gap-3 px-6 py-3 transition-all duration-150 ${
            isScanActive
              ? 'border-l-4 border-blue-500 bg-blue-600/10 text-blue-300 font-semibold'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 opacity-80'
          }`}
        >
          <Search className={`w-4 h-4 ${isScanActive ? 'text-blue-400' : 'text-slate-400'}`} />
          <span>Scan &amp; Analysis</span>
        </li>

        {/* Processing */}
        <li
          className={`flex items-center gap-3 px-6 py-3 transition-all duration-150 ${
            isProcessingActive
              ? 'border-l-4 border-blue-500 bg-blue-600/10 text-blue-300 font-semibold'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 opacity-80'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isProcessingActive ? 'text-blue-400 animate-spin' : 'text-slate-400'}`} />
          <span>Processing</span>
        </li>

        {/* Reports / Complete */}
        <li
          className={`flex items-center gap-3 px-6 py-3 transition-all duration-150 ${
            isReportsActive
              ? 'border-l-4 border-blue-500 bg-blue-600/10 text-blue-300 font-semibold'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 opacity-80'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${isReportsActive ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>Reports &amp; Output</span>
        </li>
      </ul>

      {/* Sidebar Footer Info */}
      <div className="px-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
        <div className="font-mono">Google Photos Takeout</div>
        <div>100% Offline Processing</div>
      </div>
    </nav>
  );
};
