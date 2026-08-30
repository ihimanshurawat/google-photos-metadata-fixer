import React from 'react';
import { HardDrive, HelpCircle, ShieldCheck, Sparkles, Sliders } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SystemStatus } from '../types/takeout';

interface HeaderProps {
  status: SystemStatus | null;
  onOpenHelp: () => void;
  onOpenStorage: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenHelp,
  onOpenStorage,
  onOpenSettings,
}) => {
  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      const target = e.target as HTMLElement;
      if (!target.closest('button, input, a, select')) {
        try {
          await getCurrentWindow().startDragging();
        } catch (err) {
          console.warn('Window drag not available:', err);
        }
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      className="h-16 bg-[#0f172a] border-b border-slate-800 flex justify-between items-center px-8 shrink-0 z-20 select-none cursor-default"
    >
      <div data-tauri-drag-region className="flex items-center gap-3">
        <span data-tauri-drag-region className="font-bold text-sm text-slate-100 tracking-tight">Google Photos Metadata Fixer</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Sparkles className="w-3 h-3" /> v1.0.0
        </span>
      </div>

      <div className="flex items-center gap-3">
        {status && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Engine:</span>
            {status.exiftool_available ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> ExifTool
              </span>
            ) : (
              <span className="flex items-center gap-1 text-blue-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Native Rust
              </span>
            )}
          </div>
        )}

        <button
          onClick={onOpenStorage}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Inspect & Purge Temporary Cache Storage"
        >
          <HardDrive className="w-3.5 h-3.5 text-blue-400" />
          <span>Storage Cache</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Match Patterns & Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenHelp}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="About & Instructions"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
