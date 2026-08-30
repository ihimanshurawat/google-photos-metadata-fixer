import { useState } from 'react';
import {
  FileImage,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  Calendar,
} from 'lucide-react';
import { ScanResponse, MediaPairDto } from '../types/takeout';

interface ScanSummaryProps {
  scanData: ScanResponse;
  onPreviewItem: (item: MediaPairDto) => void;
}

export const ScanSummary: React.FC<ScanSummaryProps> = ({ scanData, onPreviewItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { summary, pairs_preview } = scanData;

  const totalWithDates = summary.matched_pairs + summary.dates_from_filename;
  const matchPercent = summary.total_media > 0
    ? ((totalWithDates / summary.total_media) * 100).toFixed(1)
    : '100.0';

  const filteredPreview = pairs_preview.filter((item) =>
    item.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">Scan &amp; Analysis</h2>
        <p className="text-xs text-slate-400 mt-1">
          Review the metadata matching results across all your extracted Takeout files before processing.
        </p>
      </div>

      {/* Bento Summary Grid matching Stitch Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Photos */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Media Found
            </span>
            <div className="bg-blue-500/10 p-2 rounded-xl text-blue-400">
              <FileImage className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{summary.total_media.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>{summary.image_count} photos</span>
              <span>•</span>
              <span>{summary.video_count} videos</span>
            </div>
          </div>
        </div>

        {/* Matching JSONs */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Matching JSONs
            </span>
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{summary.matched_pairs.toLocaleString()}</div>
            <p className="text-xs text-emerald-400 font-medium mt-1">{matchPercent}% Match Rate</p>
          </div>
        </div>

        {/* Recovered from Filename */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Filename Timestamps
            </span>
            <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">{summary.dates_from_filename.toLocaleString()}</div>
            <p className="text-xs text-indigo-300 mt-1">Recovered capture dates</p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Table matching Stitch Design */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0b1120]">
          <h3 className="text-xs font-semibold text-slate-200">Sample File Analysis</h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#090d16] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b1120] text-slate-400 border-b border-slate-800 font-semibold">
                <th className="px-4 py-2.5 w-10">Type</th>
                <th className="px-4 py-2.5">File Name</th>
                <th className="px-4 py-2.5">Extension</th>
                <th className="px-4 py-2.5">JSON Status</th>
                <th className="px-4 py-2.5 text-right">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPreview.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                  <td className="px-4 py-2 text-slate-400">
                    {item.is_video ? (
                      <FileVideo className="w-4 h-4 text-purple-400" />
                    ) : (
                      <FileImage className="w-4 h-4 text-blue-400" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-200 font-medium truncate max-w-xs">
                    {item.file_name}
                  </td>
                  <td className="px-4 py-2 text-slate-400 font-mono">{item.extension ? `.${item.extension}` : ''}</td>
                  <td className="px-4 py-2">
                    {item.json_path ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-medium text-[11px] border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Metadata Found
                      </span>
                    ) : item.fallback_date_str ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 font-medium text-[11px] border border-blue-500/20">
                        <Calendar className="w-3 h-3 text-blue-400" />
                        From Name: {item.fallback_date_str.split(' ')[0]}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 font-medium text-[11px] border border-rose-500/20">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        JSON Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => onPreviewItem(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
