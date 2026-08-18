import { useEffect, useState, useRef } from "react";
import { fetchWithAuth } from "@/utils/api";

const API = "http://127.0.0.1:8000";

// A saved album from the database
interface Album {
  id: number;
  spotify_album_id: string;
  title: string;
  artist: string;
  cover_image_url: string;
  release_date: string;
  genres: string;
  status: "listened" | "plan_to_listen";
  score: number | null;
  notes: string | null;
}

// A Last.fm recommendation (not yet saved)
interface RecAlbum {
  id: string; // mbid or name — not a DB id
  name: string;
  artist?: string;
  release_date?: string;
  images: { url: string }[];
}

interface SpotifySearchAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date: string;
}

// Discriminated union for the right panel
type PanelAlbum =
  | { kind: "saved"; album: Album }
  | { kind: "unsaved"; rec: RecAlbum };

export default function AlbumDiary() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [sortListened, setSortListened] = useState<"alpha" | "score">("alpha");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifySearchAlbum[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Modal state (for the search-result quick-add)
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSearchAlbum, setSelectedSearchAlbum] = useState<SpotifySearchAlbum | null>(null);
  const [addStatus, setAddStatus] = useState<"listened" | "plan_to_listen">("listened");
  const [addScore, setAddScore] = useState<number>(5);
  const [addNotes, setAddNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Right-panel state
  const [panelAlbum, setPanelAlbum] = useState<PanelAlbum | null>(null);
  const [editStatus, setEditStatus] = useState<"listened" | "plan_to_listen">("listened");
  const [editScore, setEditScore] = useState<number>(5);
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<RecAlbum[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlbums();
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchAlbums() {
    try {
      const res = await fetchWithAuth(`${API}/albums`);
      const data = await res.json();
      setAlbums(data);
    } catch (e) {
      console.error(e);
    }
  }

  // Debounced Spotify search
  useEffect(() => {
    let active = true;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = localStorage.getItem("spotify_token");
        const res = await fetch(`https://api.spotify.com/v1/search?type=album&q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && active) {
          const data = await res.json();
          setSearchResults(data.albums?.items || []);
          setShowSearchDropdown(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(delayDebounce);
    };
  }, [searchQuery]);

  // Open the right panel for a saved DB album
  async function openSavedAlbum(album: Album) {
    setPanelAlbum({ kind: "saved", album });
    setEditStatus(album.status);
    setEditScore(album.score ?? 5);
    setEditNotes(album.notes ?? "");
    fetchRecs(album.spotify_album_id);
  }

  // Open the right panel for an unsaved Last.fm recommendation
  function openRecAlbum(rec: RecAlbum) {
    setPanelAlbum({ kind: "unsaved", rec });
    setEditStatus("listened");
    setEditScore(5);
    setEditNotes("");
    setRecommendations([]);
  }

  async function fetchRecs(spotifyAlbumId: string) {
    setRecsLoading(true);
    setRecommendations([]);
    try {
      const res = await fetchWithAuth(`${API}/albums/${spotifyAlbumId}/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecsLoading(false);
    }
  }

  // Quick-add from search dropdown
  function handleSelectSearch(album: SpotifySearchAlbum) {
    setSelectedSearchAlbum(album);
    setAddStatus("listened");
    setAddScore(5);
    setAddNotes("");
    setShowAddModal(true);
    setShowSearchDropdown(false);
    setSearchQuery("");
  }

  // POST from the search modal
  async function handleAddAlbum() {
    if (!selectedSearchAlbum) return;
    setIsAdding(true);
    try {
      await fetchWithAuth(`${API}/albums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_album_id: selectedSearchAlbum.id,
          title: selectedSearchAlbum.name,
          artist: selectedSearchAlbum.artists[0]?.name || "Unknown",
          cover_image_url: selectedSearchAlbum.images[0]?.url || "",
          release_date: selectedSearchAlbum.release_date || "",
          genres: "",
          status: addStatus,
          score: addStatus === "listened" ? addScore : null,
          notes: addNotes
        })
      });
      await fetchAlbums();
      setShowAddModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  }

  // POST when saving an unsaved rec from the right panel
  async function handleAddRecToDiary() {
    if (!panelAlbum || panelAlbum.kind !== "unsaved") return;
    const rec = panelAlbum.rec;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`${API}/albums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotify_album_id: rec.id, // Last.fm mbid or album name as fallback key
          title: rec.name,
          artist: rec.artist || "Unknown",
          cover_image_url: rec.images[rec.images.length - 1]?.url || "",
          release_date: "",
          genres: "",
          status: editStatus,
          score: editStatus === "listened" ? editScore : null,
          notes: editNotes
        })
      });
      if (res.ok) {
        const newAlbum: Album = await res.json();
        const freshAlbums = await fetchWithAuth(`${API}/albums`);
        const allAlbums = await freshAlbums.json();
        setAlbums(allAlbums);
        // Transition the panel to viewing the newly saved record
        openSavedAlbum(newAlbum);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }

  // PUT for saved albums
  async function handleUpdateAlbum() {
    if (!panelAlbum || panelAlbum.kind !== "saved") return;
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`${API}/albums/${panelAlbum.album.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          score: editStatus === "listened" ? editScore : null,
          notes: editNotes
        })
      });
      if (res.ok) {
        const updated: Album = await res.json();
        setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
        setPanelAlbum({ kind: "saved", album: updated });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAlbum() {
    if (!panelAlbum || panelAlbum.kind !== "saved") return;
    if (!confirm("Are you sure you want to delete this album?")) return;
    try {
      const res = await fetchWithAuth(`${API}/albums/${panelAlbum.album.id}`, { method: "DELETE" });
      if (res.ok) {
        setAlbums(prev => prev.filter(a => a.id !== panelAlbum.album.id));
        setPanelAlbum(null);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Derived display values for the panel
  const panelCover = panelAlbum?.kind === "saved"
    ? panelAlbum.album.cover_image_url
    : panelAlbum?.rec.images[panelAlbum.rec.images.length - 1]?.url || "";
  const panelTitle = panelAlbum?.kind === "saved" ? panelAlbum.album.title : panelAlbum?.rec.name;
  const panelArtist = panelAlbum?.kind === "saved" ? panelAlbum.album.artist : panelAlbum?.rec.artist;
  const panelDate = panelAlbum?.kind === "saved" ? panelAlbum.album.release_date : panelAlbum?.rec.release_date;
  const isSavedPanel = panelAlbum?.kind === "saved";

  const listened = albums.filter(a => a.status === "listened").sort((a, b) => {
    if (sortListened === "alpha") return a.title.localeCompare(b.title);
    return (b.score ?? 0) - (a.score ?? 0);
  });
  const planToListen = albums.filter(a => a.status === "plan_to_listen").sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="relative h-screen flex flex-col w-full overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-[#1e1e1e] flex items-center justify-between px-8 shrink-0 relative z-20">
        <div className="relative w-96" ref={searchRef}>
          <input
            type="text"
            placeholder="Search albums to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length) setShowSearchDropdown(true); }}
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-full px-4 py-1.5 text-sm text-white focus:outline-none focus:border-[#4a4a4a] transition-colors"
          />
          {isSearching && (
            <span className="absolute right-4 top-2.5 w-3 h-3 border-2 border-[#4a4a4a] border-t-[#fff] rounded-full animate-spin" />
          )}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-10 left-0 w-full bg-[#111] border border-[#2a2a2a] rounded shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
              {searchResults.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectSearch(a)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-[#1a1a1a] text-left transition-colors border-b border-[#1a1a1a] last:border-0"
                >
                  <img src={a.images[2]?.url || a.images[0]?.url} alt="" className="w-10 h-10 object-cover rounded-sm bg-[#222]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{a.name}</p>
                    <p className="text-[#6b6b6b] text-xs truncate">{a.artists[0]?.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#6b6b6b] text-xs">Sort Listened:</span>
          <select
            value={sortListened}
            onChange={(e) => setSortListened(e.target.value as any)}
            className="bg-[#111] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="alpha">Alphabetically</option>
            <option value="score">Score (High to Low)</option>
          </select>
        </div>
      </header>

      {/* Main Grid View */}
      <div className={`flex-1 overflow-y-auto p-8 flex gap-8 transition-all duration-300 ${panelAlbum ? "pr-[320px]" : ""}`}>

        {/* Listened Section */}
        <section className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            Listened <span className="text-[#4a4a4a] text-sm font-normal">({listened.length})</span>
          </h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {listened.map((album) => (
              <button
                key={album.id}
                onClick={() => openSavedAlbum(album)}
                className="group flex flex-col text-left focus:outline-none"
              >
                <div className="w-full aspect-square bg-[#111] border border-[#1e1e1e] rounded overflow-hidden relative mb-2 group-hover:border-[#3a3a3a] transition-colors">
                  <img src={album.cover_image_url} alt={album.title} className="w-full h-full object-cover" />
                  {album.score != null && (
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur border border-[#2a2a2a] px-1.5 py-0.5 rounded text-[10px] font-bold text-white tabular-nums">
                      {album.score}/10
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-medium text-white truncate w-full">{album.title}</h3>
                <p className="text-xs text-[#6b6b6b] truncate w-full">{album.artist}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="w-px bg-[#1e1e1e] shrink-0" />

        {/* Plan to Listen Section */}
        <section className="w-64 xl:w-80 shrink-0">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            Plan to Listen <span className="text-[#4a4a4a] text-sm font-normal">({planToListen.length})</span>
          </h2>
          <div className="flex flex-col gap-3">
            {planToListen.map((album) => (
              <button
                key={album.id}
                onClick={() => openSavedAlbum(album)}
                className="group flex items-center gap-3 p-2 rounded hover:bg-[#111] border border-transparent hover:border-[#1e1e1e] transition-colors text-left focus:outline-none"
              >
                <img src={album.cover_image_url} alt={album.title} className="w-12 h-12 object-cover rounded-sm border border-[#1e1e1e]" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">{album.title}</h3>
                  <p className="text-xs text-[#6b6b6b] truncate">{album.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* Right Detail Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-[320px] bg-[#181818] border-l border-[#1e1e1e] flex flex-col transition-transform duration-300 z-30 shadow-2xl ${panelAlbum ? "translate-x-0" : "translate-x-full"}`}
      >
        {panelAlbum && (
          <>
            <div className="h-16 shrink-0 border-b border-[#1e1e1e] flex items-center justify-between px-4">
              <span className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">
                {isSavedPanel ? "Album Details" : "Recommendation"}
              </span>
              <button onClick={() => setPanelAlbum(null)} className="text-[#6b6b6b] hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {/* Cover & Metadata */}
              <div>
                <img src={panelCover} className="w-full aspect-square object-cover rounded border border-[#1e1e1e] mb-4 shadow-lg" alt="" />
                <h2 className="text-xl font-bold text-white mb-1 leading-tight">{panelTitle}</h2>
                {panelArtist && <p className="text-sm text-[#b3b3b3]">{panelArtist}</p>}
                {panelDate && <p className="text-xs text-[#4a4a4a] mt-1">{panelDate.slice(0, 4)}</p>}
              </div>

              {/* Edit / Add Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-[#6b6b6b] text-xs mb-1 block">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="listened">Listened</option>
                    <option value="plan_to_listen">Plan to Listen</option>
                  </select>
                </div>

                {editStatus === "listened" && (
                  <div>
                    <label className="text-[#6b6b6b] text-xs mb-1 block">Score (1-10)</label>
                    <select
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {[...Array(10)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[#6b6b6b] text-xs mb-1 block">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={isSavedPanel ? "Write a review..." : "Add a note..."}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none resize-none h-24"
                  />
                </div>

                <div className="flex gap-2">
                  {isSavedPanel ? (
                    <>
                      <button
                        onClick={handleUpdateAlbum}
                        disabled={isSaving}
                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-white text-sm font-semibold py-2 rounded transition-colors disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={handleDeleteAlbum}
                        className="w-10 flex items-center justify-center bg-[#1a0f0f] border border-[#3a1a1a] hover:bg-[#2a1414] text-[#ff6b6b] rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddRecToDiary}
                      disabled={isSaving}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-white text-sm font-semibold py-2 rounded transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Adding..." : "Add to List"}
                    </button>
                  )}
                </div>
              </div>

              {/* Recommendations — only for saved albums */}
              {isSavedPanel && (
                <div className="mt-4 pt-6 border-t border-[#1e1e1e]">
                  <h3 className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Recommended Albums</h3>
                  {recsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-[#4a4a4a]">
                      <span className="w-3 h-3 border-2 border-[#4a4a4a] border-t-transparent rounded-full animate-spin" />
                      Finding similar artists...
                    </div>
                  ) : recommendations.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {recommendations.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => openRecAlbum(rec)}
                          className="group flex flex-col gap-1 cursor-pointer focus:outline-none"
                          title={rec.name}
                        >
                          <div className="w-full aspect-square overflow-hidden rounded border border-[#1e1e1e] group-hover:border-[#3a3a3a] transition-all duration-200">
                            <img
                              src={rec.images[rec.images.length - 1]?.url || rec.images[0]?.url}
                              alt={rec.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </div>
                          <div className="w-full text-left mt-1">
                            <p className="text-[11px] font-medium text-white group-hover:text-[#b3b3b3] transition-colors truncate w-full leading-tight">
                              {rec.name}
                            </p>
                            {rec.artist && (
                              <p className="text-[10px] text-[#6b6b6b] truncate w-full">
                                {rec.artist}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#4a4a4a]">No recommendations found.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Search Add Modal */}
      {showAddModal && selectedSearchAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#1e1e1e] flex items-center gap-4 bg-[#111]">
              <img src={selectedSearchAlbum.images[2]?.url || selectedSearchAlbum.images[0]?.url} alt="" className="w-12 h-12 rounded-sm object-cover border border-[#2a2a2a]" />
              <div>
                <h3 className="text-white font-semibold truncate">{selectedSearchAlbum.name}</h3>
                <p className="text-[#6b6b6b] text-xs">{selectedSearchAlbum.artists[0]?.name}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[#6b6b6b] text-xs mb-1 block">Status</label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value as any)}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="listened">Listened</option>
                  <option value="plan_to_listen">Plan to Listen</option>
                </select>
              </div>

              {addStatus === "listened" && (
                <div>
                  <label className="text-[#6b6b6b] text-xs mb-1 block">Score (1-10)</label>
                  <select
                    value={addScore}
                    onChange={(e) => setAddScore(Number(e.target.value))}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[#6b6b6b] text-xs mb-1 block">Notes</label>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white focus:outline-none resize-none h-24"
                  placeholder="Description"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded text-sm font-semibold text-white bg-[#111] border border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAlbum}
                  disabled={isAdding}
                  className="flex-1 py-2 rounded text-sm font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add to your List"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
