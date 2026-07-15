"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TrackEvent {
  id: string;
  songTitle: string;
  artist: string;
  albumCover: string; // real image URL
  timestamp: Date;
  genre: string;
  duration: string; // e.g. "3:42"
}

// ─── Genre Pill ──────────────────────────────────────────────────────────────

const genreColors: Record<string, string> = {
  "Synth-pop": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Pop: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Pop Rap": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Pop Punk": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Hip-Hop": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "R&B": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

function GenrePill({ genre }: { genre: string }) {
  const cls =
    genreColors[genre] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}
    >
      {genre}
    </span>
  );
}

// ─── Playlist Button ─────────────────────────────────────────────────────────

interface PlaylistButtonProps {
  label: string;
  icon: string;
  gradient: string;
  onClick: () => void;
}

function PlaylistButton({ label, icon, gradient, onClick }: PlaylistButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm text-white ${gradient} shadow-lg transition-shadow hover:shadow-xl`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </motion.button>
  );
}

// ─── Timeline Item ───────────────────────────────────────────────────────────

interface TimelineItemProps {
  track: TrackEvent;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function TimelineItem({ track, index, isExpanded, onToggle }: TimelineItemProps) {
  const timeAgo = formatDistanceToNow(track.timestamp, { addSuffix: true });
  const fullTime = format(track.timestamp, "h:mm a");

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative flex gap-4"
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center gap-0">
        {/* Dot */}
        <motion.div
          className={`relative z-10 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg ring-2 ring-white/10 flex-shrink-0 mt-5`}
          whileHover={{ scale: 1.4 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
        {/* Line */}
        <div className="w-px flex-1 bg-gradient-to-b from-white/10 to-transparent mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-6">
        <motion.div
          layout
          onClick={onToggle}
          className={`
            group relative rounded-2xl border cursor-pointer overflow-hidden
            transition-colors duration-200
            ${isExpanded
              ? "border-white/20 bg-white/[0.07]"
              : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10"
            }
          `}
        >
          {/* Subtle glow on hover/expand */}
          <motion.div
            className={`absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none rounded-2xl transition-opacity duration-300 bg-gradient-to-br from-slate-700 to-slate-900`}
            style={{ opacity: isExpanded ? 0.04 : 0 }}
          />

          {/* Main row */}
          <div className="flex items-center gap-4 p-4">
            {/* Album art box */}
            <div
              className={`w-12 h-12 rounded-xl flex-shrink-0 shadow-md flex items-center justify-center overflow-hidden bg-slate-800`}
            >
              {track.albumCover ? (
                <img src={track.albumCover} alt={track.songTitle} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🎵</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm leading-snug truncate">
                {track.songTitle}
              </p>
              <p className="text-slate-400 text-xs mt-0.5 truncate">
                {track.artist}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <GenrePill genre={track.genre} />
              </div>
            </div>

            {/* Meta */}
            <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
              <span className="text-slate-400 text-xs">{timeAgo}</span>
              <span className="text-slate-600 text-[10px]">{fullTime}</span>
              <span className="text-slate-500 text-[10px]">
                ⏱ {track.duration}
              </span>
            </div>

            {/* Chevron */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex-shrink-0 text-slate-500 text-xs ml-1"
            >
              ▾
            </motion.div>
          </div>

          {/* Expanded panel */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
                  <p className="text-slate-400 text-xs mb-3 text-center">
                    Build a playlist based on{" "}
                    <span className="text-white font-medium">
                      {track.songTitle}
                    </span>
                  </p>
                  <div className="flex gap-3">
                    <PlaylistButton
                      label="Deepen"
                      icon="🎯"
                      gradient="bg-gradient-to-r from-violet-600 to-indigo-600"
                      onClick={() =>
                        alert(
                          `Generating Deepen Playlist for: ${track.songTitle}`
                        )
                      }
                    />
                    <PlaylistButton
                      label="Explore"
                      icon="🧭"
                      gradient="bg-gradient-to-r from-rose-500 to-pink-600"
                      onClick={() =>
                        alert(
                          `Generating Explore Playlist for: ${track.songTitle}`
                        )
                      }
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Main Timeline ────────────────────────────────────────────────────────────

export default function Timeline() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

        const res = await fetch("http://127.0.0.1:8000/timeline", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          let errorMsg = "Failed to fetch timeline";
          try {
            const errData = await res.json();
            errorMsg = errData.detail || errData.error || errorMsg;
          } catch (e) {}
          throw new Error(errorMsg);
        }

        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }

        const mappedData = data.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));

        setTracks(mappedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, []);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-slate-400 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live session
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
          Your Sonic{" "}
          <span className="bg-gradient-to-r from-violet-400 to-rose-400 bg-clip-text text-transparent">
            Timeline
          </span>
        </h1>
        <p className="text-slate-400 text-sm">
          Your recent listening history — click any track to generate a playlist.
        </p>
      </motion.div>

      {/* Events */}
      <div className="relative">
        {loading ? (
          <div className="text-center text-white mt-10">Loading timeline...</div>
        ) : error ? (
          <div className="text-center text-red-500 mt-10">{error}</div>
        ) : tracks.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">No recent tracks found.</div>
        ) : (
          tracks.map((track, index) => (
            <TimelineItem
              key={`${track.id}-${index}`}
              track={track}
              index={index}
              isExpanded={expandedId === track.id}
              onToggle={() => handleToggle(track.id)}
            />
          ))
        )}
      </div>

      {/* Footer fade */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-slate-600 text-xs pb-8 mt-2"
        >
          Showing last {tracks.length} tracks
        </motion.div>
      )}
    </div>
  );
}
