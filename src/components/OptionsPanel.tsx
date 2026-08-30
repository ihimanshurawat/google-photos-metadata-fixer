import React from 'react';
import {
  Calendar,
  MapPin,
  FileText,
  Clock,
  Play,
  Sliders,
  FolderTree,
  Folder,
  CalendarDays,
} from 'lucide-react';
import { ProcessOptions, FolderStructureMode } from '../types/takeout';
import { logUiEvent } from '../utils/logger';

interface OptionsPanelProps {
  options: ProcessOptions;
  onChangeOptions: (opts: ProcessOptions) => void;
  onStartProcessing: () => void;
  totalMatchedCount: number;
  isProcessing: boolean;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({
  options,
  onChangeOptions,
  onStartProcessing,
  totalMatchedCount,
  isProcessing,
}) => {
  const toggle = (key: keyof ProcessOptions) => {
    const newVal = !options[key];
    onChangeOptions({
      ...options,
      [key]: newVal,
    });
    logUiEvent('UI_ACTION', 'TOGGLE_OPTION', `${key}: ${newVal}`);
  };

  const handleStructureChange = (mode: FolderStructureMode) => {
    onChangeOptions({
      ...options,
      folder_structure: mode,
      organize_by_date: mode === 'date',
    });
    logUiEvent('UI_ACTION', 'SELECT_OPTIONS_FOLDER_STRUCTURE', mode);
  };

  const currentStructure = options.folder_structure || (options.organize_by_date ? 'date' : 'preserve');

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            Metadata Stitching Configuration
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Target: <strong className="text-blue-300 font-mono">{totalMatchedCount.toLocaleString()}</strong> ready media items
        </span>
      </div>

      {/* Grid of Toggle Switches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Stitch Taken Date */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-semibold text-slate-200">Stitch Photo Taken Date</div>
              <div className="text-[11px] text-slate-400">Embed into EXIF DateTimeOriginal</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={options.stitch_date}
            onChange={() => toggle('stitch_date')}
            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
        </label>

        {/* Stitch GPS Location */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-semibold text-slate-200">Stitch GPS Coordinates</div>
              <div className="text-[11px] text-slate-400">Embed Latitude, Longitude, Altitude</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={options.stitch_gps}
            onChange={() => toggle('stitch_gps')}
            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
        </label>

        {/* Stitch Descriptions */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-amber-400" />
            <div>
              <div className="font-semibold text-slate-200">Stitch Title &amp; Description</div>
              <div className="text-[11px] text-slate-400">Embed captions into IPTC/XMP</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={options.stitch_description}
            onChange={() => toggle('stitch_description')}
            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
        </label>

        {/* Sync Filesystem Dates */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-[#090d16] border border-slate-800/80 hover:border-slate-700 cursor-pointer transition-colors">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-purple-400" />
            <div>
              <div className="font-semibold text-slate-200">Sync Filesystem Timestamps</div>
              <div className="text-[11px] text-slate-400">Update file creation &amp; modification date</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={options.sync_file_timestamps}
            onChange={() => toggle('sync_file_timestamps')}
            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
        </label>
      </div>

      {/* Directory Structure Mode Selector */}
      <div className="space-y-2.5 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <FolderTree className="w-4 h-4 text-blue-400" />
          <span>Output Directory Layout</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          {/* Preserve Google Photos Structure */}
          <div
            onClick={() => handleStructureChange('preserve')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              currentStructure === 'preserve'
                ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
                : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 font-semibold">
              <FolderTree className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Preserve Google Folders</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Keeps original Google Photos albums &amp; year folders intact. Fixes photos in their folders.
            </p>
          </div>

          {/* Chronological YYYY/MM */}
          <div
            onClick={() => handleStructureChange('date')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              currentStructure === 'date'
                ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
                : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 font-semibold">
              <CalendarDays className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Organize by Date</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Groups all media into <code className="text-purple-300">YYYY/MM</code> subdirectories (e.g. 2023/08).
            </p>
          </div>

          {/* Flat Single Directory */}
          <div
            onClick={() => handleStructureChange('flat')}
            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              currentStructure === 'flat'
                ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
                : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5 font-semibold">
              <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Flat Directory</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Places all stitched media in a single destination folder with no subdirectories.
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer matching Stitch Screen 2 */}
      <div className="pt-4 border-t border-slate-800 flex justify-end items-center">
        <button
          onClick={onStartProcessing}
          disabled={isProcessing}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-8 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Start Processing
        </button>
      </div>
    </div>
  );
};
