import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HardDrive, Trash2, FolderOpen, RefreshCw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { StorageInfo } from '../types/takeout';

interface StorageManagerModalProps {
  outputDir: string | null;
  onClose: () => void;
  onPurgedReset?: () => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  outputDir,
  onClose,
  onPurgedReset,
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [purging, setPurging] = useState<boolean>(false);
  const [purgedMessage, setPurgedMessage] = useState<string | null>(null);

  const fetchStorageInfo = async () => {
    try {
      setLoading(true);
      const res = await invoke<StorageInfo>('get_storage_status', {
        outputDir,
      });
      setStorageInfo(res);
    } catch (err) {
      console.error('Failed to get storage status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageInfo();
  }, [outputDir]);

  const handlePurge = async () => {
    try {
      setPurging(true);
      const freedBytes = await invoke<number>('purge_storage_caches', {
        outputDir,
      });
      const freedGb = (freedBytes / (1024 * 1024 * 1024)).toFixed(2);
      setPurgedMessage(`Successfully purged ${freedGb} GB of temporary cache! Resetting back to file selection...`);
      await fetchStorageInfo();

      // Trigger automatic state reset back to selection step
      if (onPurgedReset) {
        setTimeout(() => {
          onPurgedReset();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      alert(`Purge failed: ${err}`);
    } finally {
      setPurging(false);
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_path_in_finder', { path });
    } catch (err) {
      console.error('Failed to open path:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Storage & Temp Cache Manager
              </h3>
              <p className="text-xs text-slate-400">
                Inspect and purge temporary Takeout decompression caches to free disk space.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {purgedMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{purgedMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium">Temporary Cache Disk Usage</div>
              <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">
                {storageInfo?.formatted_total_size || '0 B'}
              </div>
            </div>
            <button
              onClick={fetchStorageInfo}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
              title="Refresh cache calculation"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Active Temporary Staging Paths ({storageInfo?.staging_paths.length || 0})
            </div>

            {storageInfo?.staging_paths.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 text-xs text-slate-500 text-center">
                ✨ No leftover temporary extraction cache on your disk. All temporary storage is 100% clean!
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {storageInfo?.staging_paths.map((path, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-slate-300 truncate max-w-xs">{path}</span>
                    <button
                      onClick={() => handleOpenFolder(path)}
                      className="p-1.5 rounded hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      title="Open in Finder"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {storageInfo?.has_cache && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Purging temporary caches will delete all extracted files and automatically return you to Step 1 (Source Selection).
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handlePurge}
            disabled={!storageInfo?.has_cache || purging}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              storageInfo?.has_cache
                ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {purging ? 'Purging Cache...' : 'Purge All Temporary Cache Now'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
