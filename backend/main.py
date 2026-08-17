import os
import urllib.parse
import requests
import random
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Response, BackgroundTasks, Depends
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import services
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL")

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "healthy"}

@app.get("/login")
def login():
    scope = "user-read-recently-played playlist-modify-public playlist-modify-private"
    query_params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": SPOTIFY_CLIENT_ID,
        "scope": scope,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "show_dialog": "true"
    })
    auth_url = f"https://accounts.spotify.com/authorize?{query_params}"
    return RedirectResponse(url=auth_url)

@app.get("/callback")
def callback(code: str):
    token_url = "https://accounts.spotify.com/api/token"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "client_id": SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET,
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    response = requests.post(token_url, data=payload, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        return RedirectResponse(url=f"{FRONTEND_URL}/?access_token={access_token}&refresh_token={refresh_token}")
    else:
        return {"error": "Failed to retrieve access token", "details": response.text}

@app.get("/refresh")
def refresh(refresh_token: str):
    token_url = "https://accounts.spotify.com/api/token"
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET,
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    response = requests.post(token_url, data=payload, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        return {"access_token": data.get("access_token")}
    else:
        return {"error": "Failed to refresh token", "details": response.text}

@app.get("/me")
def get_me(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    headers = {"Authorization": f"Bearer {token}"}
    
    user_response = requests.get("https://api.spotify.com/v1/me", headers=headers)
    if user_response.status_code != 200:
        raise HTTPException(status_code=user_response.status_code, detail=f"Spotify Error: {user_response.text}")
        
    return {"display_name": user_response.json().get("display_name")}

@app.get("/timeline")
def timeline(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"error": "Missing or invalid authorization header"}
    
    token = auth_header.split(" ")[1]
    
    spotify_url = "https://api.spotify.com/v1/me/player/recently-played?limit=50"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(spotify_url, headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Spotify Error: {response.text}")
        
    data = response.json()
    items = data.get("items", [])
    
    cleaned_data = []
    seen_track_ids = set()
    
    user_response = requests.get("https://api.spotify.com/v1/me", headers=headers)
    user_id = 1
    if user_response.status_code == 200:
        spotify_id = user_response.json().get("id")
        user = db.query(models.User).filter(models.User.spotify_id == spotify_id).first()
        if not user:
            user = models.User(spotify_id=spotify_id, display_name=user_response.json().get("display_name"))
            db.add(user)
            db.commit()
            db.refresh(user)
        user_id = user.id

    for item in items:
        if len(cleaned_data) >= 30:
            break
            
        track = item.get("track", {})
        track_id = track.get("id")
        
        if not track_id or track_id in seen_track_ids:
            continue
        seen_track_ids.add(track_id)
        song_title = track.get("name")
        artists = track.get("artists", [])
        artist_id = artists[0].get("id") if artists else None
        artist_name = artists[0].get("name") if artists else "Unknown"
        
        album = track.get("album", {})
        images = album.get("images", [])
        album_cover = images[0].get("url") if images else ""
        
        timestamp = item.get("played_at")
        
        duration_ms = track.get("duration_ms", 0)
        minutes = duration_ms // 60000
        seconds = (duration_ms % 60000) // 1000
        duration = f"{minutes}:{seconds:02d}"
        
        if artist_id:
            background_tasks.add_task(services.process_track_gamification, db, user_id, artist_id, token)
        
        cleaned_data.append({
            "id": track_id,
            "songTitle": song_title,
            "artist": artist_name,
            "albumCover": album_cover,
            "timestamp": timestamp,
            "genre": "Loading...",
            "duration": duration,
        })
        
    return cleaned_data

class PlaylistRequest(BaseModel):
    seed_track_ids: list[str]




@app.post("/generate-playlist")
async def generate_playlist(request: Request):
    try:
        # 1. Get frontend data and token
        body = await request.json()
        seed_track_ids = body.get("seed_track_ids", [])
        playlist_name = body.get("playlist_name", "Discovery Playlist")
        playlist_desc = body.get("playlist_description", "Generated by Musifind")
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            print("DEBUG: Missing Authorization header")
            raise HTTPException(status_code=401, detail="Missing auth header")

        headers = {"Authorization": auth_header}
        print(f"DEBUG: Starting generation with {len(seed_track_ids)} seed tracks.")

        # 2. Sample to 5 tracks
        if len(seed_track_ids) > 5:
            seed_track_ids = random.sample(seed_track_ids, 5)

        # 3. WORKAROUND: Bypass the 403 by looking up metadata in recently-played
        print("DEBUG: Fetching recently played to resolve track metadata...")
        history_res = requests.get(
            "https://api.spotify.com/v1/me/player/recently-played?limit=50", 
            headers=headers
        )
        if history_res.status_code != 200:
            raise HTTPException(status_code=history_res.status_code, detail="Failed to fetch history")
        
        history_items = history_res.json().get("items", [])
        tracks_data = []
        
        for item in history_items:
            track = item.get("track", {})
            # If this track is in our selected seeds and we haven't added it yet
            if track.get("id") in seed_track_ids:
                if not any(t.get("id") == track.get("id") for t in tracks_data):
                    tracks_data.append(track)
        
        print(f"DEBUG: Successfully resolved {len(tracks_data)} tracks from history.")

        # 4. Bridge to Last.fm
        lastfm_key = os.getenv("LASTFM_API_KEY")
        recommended_uris = []
        
        print("DEBUG: Bridging to Last.fm...")
        for t in tracks_data:
            artist = t["artists"][0]["name"]
            name = t["name"]
            
            lfm_res = requests.get(
                f"http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist={artist}&track={name}&api_key={lastfm_key}&format=json&limit=5"
            )
            
            if lfm_res.status_code == 200:
                similar_tracks = lfm_res.json().get("similartracks", {}).get("track", [])
                
                for sim in similar_tracks:
                    sim_artist = sim.get("artist", {}).get("name")
                    sim_name = sim.get("name")
                    
                    search_res = requests.get(
                        f"https://api.spotify.com/v1/search?q=track:{sim_name} artist:{sim_artist}&type=track&limit=1",
                        headers=headers
                    )
                    if search_res.status_code == 200:
                        items = search_res.json().get("tracks", {}).get("items", [])
                        if items:
                            recommended_uris.append(items[0]["uri"])
        
        # Deduplicate and cap at 30
        recommended_uris = list(set(recommended_uris))[:30]
        print(f"DEBUG: Found {len(recommended_uris)} unique tracks to add.")

        if not recommended_uris:
            raise HTTPException(status_code=400, detail="Could not find similar tracks.")

        # 5. NEW API ENDPOINT: Create Playlist via /me/playlists
        print("DEBUG: Creating playlist...")
        playlist_res = requests.post(
            "https://api.spotify.com/v1/me/playlists",
            headers=headers,
            json={"name": playlist_name, "description": playlist_desc, "public": False}
        )
        if playlist_res.status_code not in [200, 201]:
            print(f"PLAYLIST CREATION ERROR: {playlist_res.text}")
            raise HTTPException(status_code=playlist_res.status_code, detail="Failed to create playlist")
            
        playlist_id = playlist_res.json().get("id")
        playlist_url = playlist_res.json().get("external_urls", {}).get("spotify")

        # 5b. USER WORKAROUND: Force playlist to be private via update endpoint
        print(f"DEBUG: Forcing playlist {playlist_id} to be private...")
        update_res = requests.put(
            f"https://api.spotify.com/v1/playlists/{playlist_id}",
            headers=headers,
            json={"public": False}
        )
        if update_res.status_code not in [200, 204]:
            print(f"WARNING: Could not update privacy: {update_res.text}")
        
        # 6. NEW API ENDPOINT: Populate Playlist via /items
        print(f"DEBUG: Injecting tracks into playlist {playlist_id}...")
        add_res = requests.post(
            f"https://api.spotify.com/v1/playlists/{playlist_id}/items",
            headers=headers,
            json={"uris": recommended_uris} 
        )
        if add_res.status_code not in [200, 201]:
            print(f"TRACK ADD ERROR: {add_res.text}")
            raise HTTPException(status_code=add_res.status_code, detail="Failed to add tracks")
        
        print(f"DEBUG: SUCCESS! Playlist URL: {playlist_url}")
        return {"url": playlist_url}

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/profile")
def debug_profile(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    user = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        headers = {"Authorization": f"Bearer {token}"}
        user_response = requests.get("https://api.spotify.com/v1/me", headers=headers)
        if user_response.status_code == 200:
            spotify_id = user_response.json().get("id")
            user = db.query(models.User).filter(models.User.spotify_id == spotify_id).first()
            
    if not user:
        user = db.query(models.User).first()

    if not user:
        return {
            "overall_breadth_score": 0,
            "total_genres_discovered": 0,
            "genre_profiles": [],
            "genres": []
        }

    global_profile = db.query(models.GlobalMusicProfile).filter(models.GlobalMusicProfile.user_id == user.id).first()
    genre_profiles = db.query(models.GenreDepthProfile).filter(models.GenreDepthProfile.user_id == user.id).all()

    genres_list = [
        {
            "id": gp.id,
            "genre_name": gp.genre_name,
            "depth_score": gp.depth_score,
            "track_count": gp.track_count,
            "first_discovered_at": gp.first_discovered_at.isoformat() if gp.first_discovered_at else None
        }
        for gp in genre_profiles
    ]

    if not global_profile:
        return {
            "overall_breadth_score": 0,
            "total_genres_discovered": 0,
            "genre_profiles": genres_list,
            "genres": genres_list
        }

    return {
        "overall_breadth_score": global_profile.overall_breadth_score or 0,
        "total_genres_discovered": global_profile.total_genres_discovered or 0,
        "genre_profiles": genres_list,
        "genres": genres_list
    }


@app.get("/debug/db")
def debug_db(db: Session = Depends(get_db)):
    tracks = db.query(models.TrackHistory).order_by(models.TrackHistory.id.desc()).limit(10).all()
    genres = db.query(models.GenreDepthProfile).all()

    serialized_tracks = [
        {
            "id": track.id,
            "user_id": track.user_id,
            "spotify_track_id": track.spotify_track_id,
            "played_at": track.played_at.isoformat() if track.played_at else None,
        }
        for track in tracks
    ]

    serialized_genres = [
        {
            "id": genre.id,
            "user_id": genre.user_id,
            "genre_name": genre.genre_name,
            "depth_score": genre.depth_score,
            "track_count": genre.track_count,
            "first_discovered_at": genre.first_discovered_at.isoformat() if genre.first_discovered_at else None,
        }
        for genre in genres
    ]

    return {
        "tracks": serialized_tracks,
        "genres": serialized_genres
    }
