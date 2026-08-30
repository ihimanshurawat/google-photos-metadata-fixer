import React, { useEffect, useState } from 'react';
import { X, Calendar, MapPin, FileText, Users, Tag, Loader2, Sparkles, Database } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { MediaPairDto, PreviewDto } from '../types/takeout';

interface PreviewModalProps {
  item: MediaPairDto;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ item, onClose }) => {
  const [data, setData] = useState<PreviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const res = await invoke<PreviewDto>('preview_file_metadata', {
          fileName: item.file_name,
          jsonPath: item.json_path,
        });
        setData(res);
      } catch (err: any) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [item]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 truncate max-w-sm">
                Metadata Inspection & Verification
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-sm">
                {item.file_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Reading metadata...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-4 text-xs">
            {/* Source Badge */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> Metadata Source:
              </span>
              <span className="font-semibold text-indigo-300 font-mono">{data.date_source}</span>
            </div>

            {/* Date & Time */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <Calendar className="w-3.5 h-3.5" /> Photo Taken Timestamp
              </div>
              <div className="text-slate-200 font-mono text-sm font-semibold pl-5">
                {data.date_taken || 'No timestamp found'}
              </div>
              {data.timestamp && (
                <div className="text-slate-500 pl-5 text-[11px]">
                  Unix Epoch: {data.timestamp}
                </div>
              )}
            </div>

            {/* GPS Location */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <MapPin className="w-3.5 h-3.5" /> GPS Coordinates
              </div>
              {data.latitude !== null && data.longitude !== null ? (
                <div className="pl-5 space-y-1">
                  <div className="text-slate-200 font-mono">
                    Lat: <span className="font-semibold text-emerald-300">{data.latitude}</span>, Lon: <span className="font-semibold text-emerald-300">{data.longitude}</span>
                  </div>
                  {data.altitude !== null && (
                    <div className="text-slate-400 text-[11px]">
                      Altitude: {data.altitude} meters
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-[11px] text-indigo-400 hover:underline"
                  >
                    View on Google Maps ↗
                  </a>
                </div>
              ) : (
                <div className="text-slate-500 italic pl-5">No GPS location recorded</div>
              )}
            </div>

            {/* Description */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <FileText className="w-3.5 h-3.5" /> Description & Title
              </div>
              <div className="pl-5 text-slate-300">
                {data.description ? (
                  <p className="italic bg-slate-900 p-2 rounded border border-slate-800">
                    "{data.description}"
                  </p>
                ) : (
                  <span className="text-slate-500 italic">No description provided</span>
                )}
              </div>
            </div>

            {/* People & Tags */}
            {data.people.length > 0 && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-400 font-medium">
                  <Users className="w-3.5 h-3.5" /> Tagged People ({data.people.length})
                </div>
                <div className="pl-5 flex flex-wrap gap-1.5 pt-1">
                  {data.people.map((person, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-medium"
                    >
                      <Tag className="w-3 h-3" /> {person}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
