"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GenreDepthProfile {
  id: number;
  genre_name: string;
  depth_score: number;
  track_count: number;
  first_discovered_at: string;
}

interface ProfileData {
  overall_breadth_score: number;
  total_genres_discovered: number;
  genre_profiles: GenreDepthProfile[];
}

// ─── Depth Score Progress Bar ─────────────────────────────────────────────────

const MAX_DEPTH_SCORE = 20; // cap for visual 100%

function DepthBar({ score }: { score: number }) {
  const pct = Math.min((score / MAX_DEPTH_SCORE) * 100, 100);

  // Color shifts from indigo → violet → rose as depth increases
  const barColor =
    pct >= 75
      ? "from-rose-500 to-pink-500"
      : pct >= 40
      ? "from-violet-500 to-purple-500"
      : "from-indigo-500 to-violet-500";

  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// ─── Genre Card ───────────────────────────────────────────────────────────────

function GenreCard({ profile, index }: { profile: GenreDepthProfile; index: number }) {
  const depth = profile.depth_score;
  const level = depth < 3 ? "Novice" : depth < 8 ? "Apprentice" : depth < 15 ? "Expert" : "Master";
  const levelColor =
    depth < 3
      ? "text-slate-400 bg-slate-500/20 border-slate-500/30"
      : depth < 8
      ? "text-indigo-300 bg-indigo-500/20 border-indigo-500/30"
      : depth < 15
      ? "text-violet-300 bg-violet-500/20 border-violet-500/30"
      : "text-rose-300 bg-rose-500/20 border-rose-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl border border-white/[0.07] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15 transition-colors duration-200 p-3.5 flex flex-col gap-2.5"
    >
      {/* Genre name */}
      <p className="text-white text-xs font-semibold leading-snug capitalize truncate">
        {profile.genre_name}
      </p>

      {/* Level badge + track count */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${levelColor}`}
        >
          {level}
        </span>
        <span className="text-slate-500 text-[10px]">
          {profile.track_count} track{profile.track_count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Depth bar */}
      <div>
        <DepthBar score={depth} />
        <div className="flex justify-between mt-1">
          <span className="text-slate-600 text-[9px]">depth</span>
          <span className="text-slate-400 text-[9px] font-medium">{depth.toFixed(1)} xp</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: string | number;
  icon: string;
  gradient: string;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-4 border border-white/10 bg-gradient-to-br ${gradient}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-white text-2xl font-bold leading-none">{value}</div>
      <div className="text-white/60 text-xs mt-1 font-medium">{label}</div>
    </div>
  );
}

// ─── Main MusicProfile Drawer ─────────────────────────────────────────────────

interface MusicProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MusicProfile({ isOpen, onClose }: MusicProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchProfile() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("spotify_token");
        if (!token) throw new Error("No Spotify token found.");

        const res = await fetch("http://127.0.0.1:8000/debug/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          let msg = "Failed to fetch profile";
          try {
            const err = await res.json();
            msg = err.detail || err.error || msg;
          } catch {}
          throw new Error(msg);
        }

        const data = await res.json();
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
            style={{
              background:
                "linear-gradient(160deg, #0f0f1a 0%, #111128 60%, #0d1017 100%)",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-700/20 blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-indigo-700/15 blur-[60px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/[0.06]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">🎮</span>
                  <h2 className="text-white font-bold text-lg tracking-tight">Music Profile</h2>
                </div>
                <p className="text-slate-500 text-xs">Your genre exploration skill tree</p>
              </div>
              <button
                id="music-profile-close-btn"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-200 text-sm"
                aria-label="Close profile drawer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent"
                  />
                  <span className="text-sm">Loading your profile…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-red-400 text-sm">{error}</p>
                  <p className="text-slate-600 text-xs">
                    Make sure your backend is running and you&apos;ve listened to some tracks.
                  </p>
                </div>
              ) : profile ? (
                <>
                  {/* ── Top Stats ── */}
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex gap-3 mb-6"
                  >
                    <StatPill
                      label="Breadth Score"
                      value={profile.overall_breadth_score.toFixed(1)}
                      icon="🌐"
                      gradient="from-violet-900/60 to-indigo-900/40"
                    />
                    <StatPill
                      label="Genres Discovered"
                      value={profile.total_genres_discovered}
                      icon="🔬"
                      gradient="from-rose-900/50 to-pink-900/30"
                    />
                  </motion.div>

                  {/* ── Section label ── */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
                      Genre Skill Tree
                    </span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-slate-600 text-[10px]">
                      {profile.genre_profiles.length} genres
                    </span>
                  </div>

                  {/* ── Genre Grid ── */}
                  {profile.genre_profiles.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-10">
                      No genres discovered yet. Listen to some tracks!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {profile.genre_profiles.map((gp, i) => (
                        <GenreCard key={gp.id} profile={gp} index={i} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="relative z-10 px-5 py-4 border-t border-white/[0.06]">
              <p className="text-slate-600 text-[10px] text-center">
                Scores update in the background as you listen 🎵
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
