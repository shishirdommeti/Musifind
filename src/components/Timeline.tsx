import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { fetchWithAuth } from "@/utils/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TrackEvent {
  id: string;
  songTitle: string;
  artist: string;
  albumCover: string;
  timestamp: Date;
  genre: string;
  duration: string;
}

interface TimelineProps {
  selectedIds: Set<string>;
  onToggleTrack: (id: string) => void;
}

// ─── Timeline Item ───────────────────────────────────────────────────────────

interface TimelineItemProps {
  track: TrackEvent;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
}

function TimelineItem({ track, index, isSelected, onToggle }: TimelineItemProps) {
  const timeAgo = formatDistanceToNow(track.timestamp, { addSuffix: true });
  const fullTime = format(track.timestamp, "h:mm a");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onClick={onToggle}
      className={`
        flex items-center gap-4 px-6 py-3.5 cursor-pointer
        border-b border-[#1a1a1a] transition-colors duration-150
        ${isSelected
          ? "bg-[#1a1a1a] border-l-2 border-l-white"
          : "hover:bg-[#111] border-l-2 border-l-transparent"
        }
      `}
    >
      {/* Album art */}
      <div className="w-10 h-10 rounded flex-shrink-0 overflow-hidden bg-[#1e1e1e] flex items-center justify-center">
        {track.albumCover ? (
          <img src={track.albumCover} alt={track.songTitle} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">🎵</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug truncate ${isSelected ? "text-white" : "text-[#c0c0c0]"}`}>
          {track.songTitle}
        </p>
        <p className="text-[#5a5a5a] text-xs mt-0.5 truncate">{track.artist}</p>
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="text-[#4a4a4a] text-[10px]">{timeAgo}</p>
        <p className="text-[#3a3a3a] text-[10px]">{fullTime}</p>
        <p className="text-[#3a3a3a] text-[10px]">⏱ {track.duration}</p>
      </div>

      {/* Selection indicator */}
      <div
        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
          ${isSelected ? "border-white bg-white" : "border-[#2a2a2a] bg-transparent"}`}
      >
        {isSelected && (
          <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Timeline ────────────────────────────────────────────────────────────

export default function Timeline({ selectedIds, onToggleTrack }: TimelineProps) {
  const [tracks, setTracks] = useState<TrackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const token = localStorage.getItem("spotify_token");
        if (!token) {
          setError("No Spotify token found. Please connect Spotify.");
          setLoading(false);
          return;
        }

        const res = await fetchWithAuth("http://127.0.0.1:8000/timeline");

        if (!res.ok) {
          let errorMsg = "Failed to fetch timeline";
          try {
            const errData = await res.json();
            errorMsg = errData.detail || errData.error || errorMsg;
          } catch (_) {}
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const mapped: TrackEvent[] = data.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        setTracks(mapped);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#1e1e1e] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#4a4a4a] text-[10px] uppercase tracking-widest font-semibold">Live session</span>
          </div>
          <h2 className="text-base font-semibold text-white">Your Sonic Timeline</h2>
        </div>
        {!loading && !error && (
          <span className="text-[#4a4a4a] text-xs">{tracks.length} tracks</span>
        )}
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-5 h-5 border-2 border-[#2a2a2a] border-t-white rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-red-500 text-sm">{error}</div>
        ) : tracks.length === 0 ? (
          <div className="px-6 py-10 text-[#4a4a4a] text-sm">No recent tracks found.</div>
        ) : (
          tracks.map((track, index) => (
            <TimelineItem
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              isSelected={selectedIds.has(track.id)}
              onToggle={() => onToggleTrack(track.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
