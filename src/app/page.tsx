"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Timeline from "@/components/Timeline";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // gets access token from the URL and stores it in local storage
  useEffect(() => {
    const token = searchParams.get("access_token");
    if (token) {
      localStorage.setItem("spotify_token", token);
      router.replace("/");
      setIsAuthenticated(true);
    } else {
      const stored = localStorage.getItem("spotify_token");
      setIsAuthenticated(!!stored);
    }
  }, []);

  return (
    <main className="min-h-screen w-full bg-slate-950 overflow-y-auto">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-900/30 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-rose-900/20 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-900/20 blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-16">
        {isAuthenticated ? (
          <Timeline />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
            <div className="text-center space-y-3 mb-4">
              <h1 className="text-5xl font-bold text-white tracking-tight">
                Spoti<span className="text-violet-400">find</span>
              </h1>
              <p className="text-slate-400 text-lg">
                Rediscover your music journey through time
              </p>
            </div>
            <a
              href="http://127.0.0.1:8000/login"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-full text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%)",
              }}
            >
              {/* Spotify icon */}
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect Spotify
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
            </a>
            <p className="text-slate-500 text-sm">
              Sign in with your Spotify account to get started
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
