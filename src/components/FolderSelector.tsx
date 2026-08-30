import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Folder,
  FileArchive,
  HardDrive,
  FolderCheck,
  CheckCircle2,
  Lock,
  History,
  MapPin,
  ArrowRight,
  Sparkles,
  Archive,
  FolderTree,
  CalendarDays,
} from 'lucide-react';
import { ZipFileInfo, FolderStructureMode } from '../types/takeout';

import { logUiEvent } from '../utils/logger';

interface FolderSelectorProps {
  sourceDir: string;
  onSelectSource: (dir: string) => void;
  outputDir: string | null;
  onSelectOutput: (dir: string | null) => void;
  folderStructure: FolderStructureMode;
  onChangeFolderStructure: (mode: FolderStructureMode) => void;
  onStartScan: () => void;
  isScanning: boolean;
  inputMode: 'folder' | 'zip';
  onChangeInputMode: (mode: 'folder' | 'zip') => void;
  zipFiles: ZipFileInfo[];
  onSetZipFiles: (files: ZipFileInfo[]) => void;
  onStartZipExtractAndScan: () => void;
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  sourceDir,
  onSelectSource,
  outputDir,
  onSelectOutput,
  folderStructure,
  onChangeFolderStructure,
  onStartScan,
  isScanning,
  inputMode,
  onChangeInputMode,
  zipFiles,
  onSetZipFiles,
  onStartZipExtractAndScan,
}) => {
  const handlePickSourceFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_folder', {
        title: 'Select Google Photos Takeout Folder',
      });
      if (selected) {
        onSelectSource(selected);
        logUiEvent('UI_ACTION', 'SELECT_SOURCE_FOLDER', selected);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  const handlePickOutput = async () => {
    try {
      const selected = await invoke<string | null>('select_folder', {
        title: 'Select Destination Output Folder',
      });
      if (selected) {
        onSelectOutput(selected);
        logUiEvent('UI_ACTION', 'SELECT_DESTINATION_FOLDER', selected);
      }
    } catch (err) {
      console.error('Error selecting output directory:', err);
    }
  };

  const handlePickZipFolder = async () => {
    try {
      const folder = await invoke<string | null>('select_folder', {
        title: 'Select Folder Containing Takeout ZIP Files',
      });
      if (folder) {
        const detected = await invoke<ZipFileInfo[]>('detect_zips_in_folder', {
          folderPath: folder,
        });
        if (detected.length > 0) {
          onSetZipFiles(detected);
          logUiEvent('UI_ACTION', 'DETECT_ZIP_FOLDER', `Found ${detected.length} archives in ${folder}`);
        } else {
          alert('No .zip files were found in the selected folder.');
        }
      }
    } catch (err) {
      console.error('Error selecting zip folder:', err);
    }
  };

  const handlePickIndividualZips = async () => {
    try {
      const files = await invoke<string[]>('select_zip_files');
      if (files && files.length > 0) {
        const fileInfos: ZipFileInfo[] = files.map((f) => {
          const name = f.split(/[/\\]/).pop() || f;
          return {
            file_name: name,
            path: f,
            size_bytes: 0,
            formatted_size: 'Selected',
          };
        });
        onSetZipFiles(fileInfos);
        logUiEvent('UI_ACTION', 'SELECT_INDIVIDUAL_ZIPS', `Selected ${fileInfos.length} archive files`);
      }
    } catch (err) {
      console.error('Error picking zip files:', err);
    }
  };

  const totalZipBytes = zipFiles.reduce((acc, z) => acc + z.size_bytes, 0);
  const formattedTotalZipSize =
    totalZipBytes > 0
      ? `${(totalZipBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${zipFiles.length} archives`;

  const handleStructureClick = (mode: FolderStructureMode) => {
    onChangeFolderStructure(mode);
    logUiEvent('UI_ACTION', 'SELECT_FOLDER_STRUCTURE', mode);
  };

  const handleInputModeClick = (mode: 'folder' | 'zip') => {
    onChangeInputMode(mode);
    logUiEvent('UI_ACTION', 'SWITCH_INPUT_MODE', mode);
  };

  const renderStructureSelector = () => (
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <FolderTree className="w-4 h-4 text-blue-400" />
        <span>Folder Organization Mode:</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
        {/* Preserve Google Photos */}
        <div
          onClick={() => handleStructureClick('preserve')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            folderStructure === 'preserve'
              ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
              : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1 font-semibold">
            <FolderTree className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Preserve Google Folders</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Keeps original album/year folders intact and fixes photos inside them.
          </p>
        </div>

        {/* Organize by Date */}
        <div
          onClick={() => handleStructureClick('date')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            folderStructure === 'date'
              ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
              : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1 font-semibold">
            <CalendarDays className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Organize by Date</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Groups photos into <code className="text-purple-300">YYYY/MM</code> subfolders.
          </p>
        </div>

        {/* Flat Folder */}
        <div
          onClick={() => handleStructureClick('flat')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            folderStructure === 'flat'
              ? 'bg-blue-600/15 border-blue-500 text-blue-200 shadow-sm'
              : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1 font-semibold">
            <Folder className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Flat Directory</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Places all media in one single destination folder without subfolders.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto py-2">
      {/* Hero Welcome Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          Welcome to Google Photos Metadata Fixer
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Restore original timestamps and location data to your Google Takeout photos. Select your unzipped Takeout folder or multi-part ZIP archives below.
        </p>
      </div>

      {/* Main Mode Toggle Tabs */}
      <div className="flex bg-[#0f172a] p-1.5 rounded-xl border border-slate-800 max-w-md mx-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => handleInputModeClick('folder')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all cursor-pointer ${
            inputMode === 'folder'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Extracted Folder</span>
        </button>

        <button
          type="button"
          onClick={() => handleInputModeClick('zip')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all cursor-pointer ${
            inputMode === 'zip'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Raw ZIP Archives</span>
        </button>
      </div>

      {/* Main Selection Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        {inputMode === 'folder' ? (
          /* Mode 1: Extracted Folder */
          <div className="space-y-6">
            {/* Drop Zone Box */}
            <div
              onClick={handlePickSourceFolder}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl bg-[#090d16]/70 p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer group text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center mb-4 text-blue-400 transition-colors">
                <Folder className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                Select Google Takeout Folder
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Choose the directory containing your unzipped Google Photos Takeout media and <code className="text-blue-300">.supplemental-metadata.json</code> files.
              </p>
              <button
                type="button"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors pointer-events-none flex items-center gap-2"
              >
                <Folder className="w-3.5 h-3.5" /> Browse Folder
              </button>
            </div>

            {sourceDir && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Selected Path:</span>
                <span className="font-mono text-blue-300 truncate max-w-lg font-medium">{sourceDir}</span>
              </div>
            )}

            {/* Destination Mode */}
            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" /> Destination Folder (Optional)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Save to a separate output folder, or leave empty to update in-place.
                  </p>
                </div>

                <button
                  onClick={handlePickOutput}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <FolderCheck className="w-3.5 h-3.5" /> {outputDir ? 'Change Destination' : 'Choose Destination'}
                </button>
              </div>

              {outputDir && (
                <div className="space-y-3 p-3.5 bg-[#090d16] rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-mono text-slate-300">
                    <span className="truncate max-w-md">{outputDir}</span>
                    <button
                      onClick={() => onSelectOutput(null)}
                      className="text-xs text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear (Use In-Place)
                    </button>
                  </div>

                  {renderStructureSelector()}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={onStartScan}
                disabled={!sourceDir || isScanning}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer text-xs"
              >
                {isScanning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning Directory...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Scan &amp; Analyze Takeout Folder
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Mode 2: Raw ZIP Archives */
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={handlePickZipFolder}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl bg-[#090d16]/70 p-6 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center mb-3 text-blue-400">
                  <Folder className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-200 mb-1">
                  Folder with ZIP Files
                </h4>
                <p className="text-[11px] text-slate-400">
                  Select folder containing all <code className="text-blue-300">takeout-*.zip</code>
                </p>
              </div>

              <div
                onClick={handlePickIndividualZips}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl bg-[#090d16]/70 p-6 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 text-indigo-400">
                  <FileArchive className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-200 mb-1">
                  Individual .ZIP Files
                </h4>
                <p className="text-[11px] text-slate-400">
                  Select specific archive volumes
                </p>
              </div>
            </div>

            {/* Detected Archive List */}
            {zipFiles.length > 0 && (
              <div className="space-y-2.5 bg-[#090d16] p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Detected {zipFiles.length} Archive(s) ({formattedTotalZipSize})
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">Ready for extraction</span>
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                  {zipFiles.map((zip, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]"
                    >
                      <span className="text-slate-200 truncate max-w-sm flex items-center gap-2">
                        <FileArchive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        {zip.file_name}
                      </span>
                      <span className="text-slate-400 shrink-0">{zip.formatted_size}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Destination Selector (Required for ZIPs) */}
            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" /> Output Destination Folder (Required)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Only stitched photos and videos will be saved here. No JSON files will be kept!
                  </p>
                </div>

                <button
                  onClick={handlePickOutput}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <FolderCheck className="w-3.5 h-3.5" /> {outputDir ? 'Change Destination' : 'Choose Destination'}
                </button>
              </div>

              {outputDir && (
                <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 text-xs font-mono text-slate-300 truncate">
                  {outputDir}
                </div>
              )}

              {/* Directory structure selector for ZIP extraction */}
              {renderStructureSelector()}
            </div>

            {/* Action */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={onStartZipExtractAndScan}
                disabled={zipFiles.length === 0 || !outputDir || isScanning}
                className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all cursor-pointer text-xs"
              >
                <Sparkles className="w-4 h-4" />
                Decompress &amp; Scan Takeout Archives ({zipFiles.length} Zips)
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Bento Feature Cards matching Stitch Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Lock className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-slate-100">100% Local Processing</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your photos never leave your device. All metadata extraction and EXIF fixing happens locally in native Rust for complete privacy.
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <History className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-slate-100">Preserve Timeline</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Accurately pairs <code className="text-blue-300">.supplemental-metadata.json</code> files and filename timestamps to restore original dates.
          </p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <MapPin className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs text-slate-100">Restore Locations</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Recovers lost GPS coordinates (latitude, longitude, altitude) from Google's metadata and writes them directly into image EXIF data.
          </p>
        </div>
      </div>
    </div>
  );
};
