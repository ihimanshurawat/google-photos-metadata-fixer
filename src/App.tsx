import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FolderSelector } from './components/FolderSelector';
import { ExtractionScreen } from './components/ExtractionScreen';
import { CollatingScreen } from './components/CollatingScreen';
import { ScanSummary } from './components/ScanSummary';
import { OptionsPanel } from './components/OptionsPanel';
import { ProgressDashboard } from './components/ProgressDashboard';
import { LogViewer } from './components/LogViewer';
import { PreviewModal } from './components/PreviewModal';
import { CompletedView } from './components/CompletedView';
import { StorageManagerModal } from './components/StorageManagerModal';
import { SettingsModal } from './components/SettingsModal';
import {
  ScanResponse,
  ProcessOptions,
  ProgressPayload,
  ExtractionProgressPayload,
  ExtractionCompletePayload,
  LogEntry,
  ProcessSummary as IProcessSummary,
  SystemStatus,
  MediaPairDto,
  ZipFileInfo,
  FolderStructureMode,
} from './types/takeout';
import { BookOpen, ShieldCheck, X } from 'lucide-react';

import { logUiEvent } from './utils/logger';

export function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [inputMode, setInputMode] = useState<'folder' | 'zip'>('folder');
  const [sourceDir, setSourceDir] = useState<string>('');
  const [zipFiles, setZipFiles] = useState<ZipFileInfo[]>([]);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<FolderStructureMode>('preserve');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [_stagingPath, setStagingPath] = useState<string | null>(null);

  const [options, setOptions] = useState<ProcessOptions>({
    stitch_date: true,
    stitch_gps: true,
    stitch_description: true,
    stitch_tags: true,
    sync_file_timestamps: true,
    delete_json_after: false,
    dry_run: false,
    output_dir: null,
    organize_by_date: false,
    folder_structure: 'preserve',
    source_root: null,
  });

  const [stage, setStage] = useState<'idle' | 'extracting' | 'collating' | 'scanned' | 'processing' | 'completed'>('idle');
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgressPayload | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [completedSummary, setCompletedSummary] = useState<IProcessSummary | null>(null);

  const [previewItem, setPreviewItem] = useState<MediaPairDto | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showStorage, setShowStorage] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Sync outputDir and folderStructure into options
  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      output_dir: outputDir,
      folder_structure: folderStructure,
      organize_by_date: folderStructure === 'date',
    }));
  }, [outputDir, folderStructure]);

  // Initial system check & background event listeners
  useEffect(() => {
    logUiEvent('APP', 'MOUNT', 'Frontend UI initialized');
    const fetchStatus = async () => {
      try {
        const res = await invoke<SystemStatus>('check_system_status');
        setSystemStatus(res);
      } catch (err) {
        console.warn('System status error:', err);
      }
    };
    fetchStatus();

    let unlistenExtract: (() => void) | undefined;
    let unlistenExtractComplete: (() => void) | undefined;
    let unlistenExtractError: (() => void) | undefined;
    let unlistenScanComplete: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenExtract = await listen<ExtractionProgressPayload>('extract-progress', (event) => {
        setExtractionProgress(event.payload);
      });

      unlistenExtractComplete = await listen<ExtractionCompletePayload>('extract-complete', async (event) => {
        setStagingPath(event.payload.staging_dir);
        setExtractionProgress(null);
        setStage('collating');
        logUiEvent('EXTRACTION', 'COMPLETE', `Extracted ${event.payload.total_files_extracted} files in ${event.payload.elapsed_seconds}s`);
        try {
          await invoke('collate_and_scan', {
            sourcePath: event.payload.staging_dir,
          });
        } catch (scanErr: any) {
          alert(`Collation scan failed: ${scanErr}`);
          setStage('idle');
        }
      });

      unlistenExtractError = await listen<string>('extract-error', (event) => {
        logUiEvent('EXTRACTION', 'ERROR', event.payload);
        alert(`Extraction failed: ${event.payload}`);
        setStage('idle');
      });

      unlistenScanComplete = await listen<ScanResponse>('scan-complete', (event) => {
        setScanData(event.payload);
        setIsScanning(false);
        setStage('scanned');
        logUiEvent('SCAN', 'COMPLETE', `Matched: ${event.payload.summary.matched_pairs}, Total: ${event.payload.summary.total_media}`);
      });

      unlistenProgress = await listen<ProgressPayload>('process-progress', (event) => {
        setProgress(event.payload);
      });

      unlistenLog = await listen<LogEntry>('process-log', (event) => {
        setLogs((prev) => [...prev, event.payload]);
      });

      unlistenComplete = await listen<IProcessSummary>('process-complete', (event) => {
        setCompletedSummary(event.payload);
        setStage('completed');
        logUiEvent('BATCH', 'COMPLETE', `Processed: ${event.payload.processed}/${event.payload.total_files}, Failed: ${event.payload.failed}`);
      });
    };

    setupListeners();

    return () => {
      if (unlistenExtract) unlistenExtract();
      if (unlistenExtractComplete) unlistenExtractComplete();
      if (unlistenExtractError) unlistenExtractError();
      if (unlistenScanComplete) unlistenScanComplete();
      if (unlistenProgress) unlistenProgress();
      if (unlistenLog) unlistenLog();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  const handleStartFolderScan = async () => {
    if (!sourceDir) return;
    try {
      setIsScanning(true);
      setStage('collating');
      logUiEvent('UI_ACTION', 'START_FOLDER_SCAN', sourceDir);
      await invoke('collate_and_scan', {
        sourcePath: sourceDir,
      });
    } catch (err: any) {
      logUiEvent('SCAN', 'ERROR', `${err}`);
      alert(`Scan failed: ${err}`);
      setIsScanning(false);
      setStage('idle');
    }
  };

  const handleStartZipExtraction = async () => {
    if (zipFiles.length === 0 || !outputDir) return;
    try {
      setLogs([]);
      setProgress(null);
      setExtractionProgress(null);
      setStage('extracting');
      logUiEvent('UI_ACTION', 'START_ZIP_EXTRACTION', `${zipFiles.length} archives to ${outputDir}`);

      const paths = zipFiles.map((z) => z.path);
      await invoke('start_zip_extraction', {
        zipPaths: paths,
        outputDir,
      });
    } catch (err: any) {
      logUiEvent('EXTRACTION', 'INIT_ERROR', `${err}`);
      alert(`Could not start ZIP extraction: ${err}`);
      setStage('idle');
    }
  };

  const handleStartProcessing = async () => {
    if (!scanData) return;
    try {
      setLogs([]);
      setProgress(null);
      setStage('processing');
      logUiEvent('UI_ACTION', 'START_BATCH_PROCESS', JSON.stringify({
        matched: scanData.summary.matched_pairs,
        folder_structure: options.folder_structure,
      }));

      await invoke('start_batch_process', {
        options,
      });
    } catch (err: any) {
      logUiEvent('BATCH', 'INIT_ERROR', `${err}`);
      alert(`Processing error: ${err}`);
      setStage('scanned');
    }
  };

  const handleCancel = async () => {
    try {
      logUiEvent('UI_ACTION', 'CANCEL_BATCH', 'User cancelled active operation');
      await invoke('cancel_batch_process');
      await invoke('cleanup_staging');
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleReset = async () => {
    try {
      logUiEvent('UI_ACTION', 'RESET_TO_START', 'User reset workflow');
      await invoke('cleanup_staging');
    } catch (err) {
      console.error('Cleanup failed:', err);
    }
    setStage('idle');
    setScanData(null);
    setProgress(null);
    setExtractionProgress(null);
    setLogs([]);
    setCompletedSummary(null);
    setStagingPath(null);
    setIsScanning(false);
  };

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 font-sans overflow-hidden select-none">
      {/* Persistent Left Sidebar Navigation */}
      <Sidebar currentStage={stage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Navigation Bar */}
        <Header
          status={systemStatus}
          onOpenHelp={() => setShowHelp(true)}
          onOpenStorage={() => setShowStorage(true)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto p-8 max-w-[1440px] w-full mx-auto">
          {stage === 'idle' && (
            <FolderSelector
              sourceDir={sourceDir}
              onSelectSource={setSourceDir}
              outputDir={outputDir}
              onSelectOutput={setOutputDir}
              folderStructure={folderStructure}
              onChangeFolderStructure={setFolderStructure}
              onStartScan={handleStartFolderScan}
              isScanning={isScanning}
              inputMode={inputMode}
              onChangeInputMode={setInputMode}
              zipFiles={zipFiles}
              onSetZipFiles={setZipFiles}
              onStartZipExtractAndScan={handleStartZipExtraction}
            />
          )}

          {stage === 'extracting' && (
            <ExtractionScreen
              progress={extractionProgress}
              onCancel={handleCancel}
            />
          )}

          {stage === 'collating' && (
            <CollatingScreen />
          )}

          {stage === 'scanned' && scanData && (
            <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
              <ScanSummary
                scanData={scanData}
                onPreviewItem={(item) => setPreviewItem(item)}
              />

              <OptionsPanel
                options={options}
                onChangeOptions={setOptions}
                onStartProcessing={handleStartProcessing}
                totalMatchedCount={scanData.summary.matched_pairs + scanData.summary.dates_from_filename}
                isProcessing={false}
              />
            </div>
          )}

          {stage === 'processing' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <ProgressDashboard
                progress={progress}
                extractionProgress={null}
                onCancel={handleCancel}
              />
              <LogViewer logs={logs} />
            </div>
          )}

          {stage === 'completed' && completedSummary && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <CompletedView
                summary={completedSummary}
                targetPath={outputDir || sourceDir}
                onReset={handleReset}
              />
              <LogViewer logs={logs} />
            </div>
          )}
        </main>

        {/* Footer Bar matching Stitch */}
        <footer className="h-9 px-8 bg-[#0b1120] border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <div className="font-mono">v1.0.0 Desktop Production Build</div>
          <div className="flex gap-4">
            <span className="text-slate-400">100% Offline Local Processing</span>
            <span>•</span>
            <span className="text-slate-400">Zero Cloud Uploads</span>
          </div>
        </footer>
      </div>

      {/* Pre-flight inspection modal */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}

      {/* Storage & Temp Cache Manager Modal */}
      {showStorage && (
        <StorageManagerModal
          outputDir={outputDir}
          onClose={() => setShowStorage(false)}
          onPurgedReset={handleReset}
        />
      )}

      {/* Settings & Matching Pattern Configuration Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Help & About Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  About Google Photos Metadata Fixer
                </h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>Google Photos Takeout</strong> provides your photos and videos alongside separate <code className="text-blue-300">.supplemental-metadata.json</code> sidecar files containing timestamps, GPS coordinates, descriptions, and people tags.
              </p>
              <p>
                <strong>Modern Match Engine:</strong> The app parses all modern Takeout suffixes, duplicate numbering patterns (e.g. <code className="text-blue-300">IMG(1).jpg</code>), Apple Live Photos, and recovers capture dates directly from media filenames.
              </p>
              <div className="p-3 bg-[#090d16] rounded-xl border border-slate-800 space-y-1 text-slate-400">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Supported Media
                </div>
                <div>JPEG, PNG, HEIC, TIFF, WebP, MP4, MOV, Apple Live Photos, and DNG/RAW.</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs shadow-lg transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
