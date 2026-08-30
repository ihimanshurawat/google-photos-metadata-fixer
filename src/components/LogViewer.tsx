import React, { useRef, useEffect } from 'react';
import { Download, Terminal } from 'lucide-react';
import { LogEntry } from '../types/takeout';

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const header = 'Timestamp,Level,File,Message,Success\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.timestamp}","${l.level}","${l.file_name.replace(/"/g, '""')}","${l.message.replace(/"/g, '""')}","${l.success}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `takeout_stitch_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 flex flex-col h-80 shadow-xl">
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold text-slate-100">Live Activity Log</h3>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={logs.length === 0}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 hover:underline cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Export Log (CSV)
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] flex flex-col gap-1 pr-1"
      >
        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 italic text-xs">
            Waiting for activity stream...
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className="flex items-center py-0.5 px-1.5 rounded hover:bg-slate-900/60 transition-colors"
            >
              <span className="text-slate-500 w-20 shrink-0">{log.timestamp}</span>
              <span
                className={`w-16 shrink-0 font-bold ${
                  log.level === 'error'
                    ? 'text-rose-400'
                    : log.level === 'warn'
                    ? 'text-amber-400'
                    : 'text-blue-400'
                }`}
              >
                [{log.level.toUpperCase()}]
              </span>
              <span className="text-slate-300 truncate max-w-lg">
                {log.file_name}: {log.message}
              </span>
              <span
                className={`ml-auto font-bold pl-4 text-[10px] ${
                  log.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {log.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
