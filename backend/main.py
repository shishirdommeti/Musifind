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
    scope = "user-read-recently-played"
    query_params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": SPOTIFY_CLIENT_ID,
        "scope": scope,
        "redirect_uri": SPOTIFY_REDIRECT_URI,
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
def generate_playlist(request: Request, payload: PlaylistRequest):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header.split(" ")[1]
    headers = {"Authorization": f"Bearer {token}"}

    seeds = payload.seed_track_ids
    if len(seeds) > 5:
        seeds = random.sample(seeds, 5)
        
    if not seeds:
        raise HTTPException(status_code=400, detail="No seed track IDs provided")

    rec_url = f"https://api.spotify.com/v1/recommendations?limit=30&seed_tracks={','.join(seeds)}"
    rec_response = requests.get(rec_url, headers=headers)
    if rec_response.status_code != 200:
        raise HTTPException(status_code=rec_response.status_code, detail=f"Spotify Recommendations Error: {rec_response.text}")
        
    rec_tracks = rec_response.json().get("tracks", [])
    track_uris = [track.get("uri") for track in rec_tracks]
    
    if not track_uris:
        raise HTTPException(status_code=400, detail="No recommended tracks found")

    me_response = requests.get("https://api.spotify.com/v1/me", headers=headers)
    if me_response.status_code != 200:
        raise HTTPException(status_code=me_response.status_code, detail=f"Spotify Me Error: {me_response.text}")
    spotify_user_id = me_response.json().get("id")

    create_url = f"https://api.spotify.com/v1/users/{spotify_user_id}/playlists"
    playlist_payload = {
        "name": "Sonic Discovery",
        "public": True,
        "description": "Generated by Spotifind based on your listening history."
    }
    create_response = requests.post(create_url, json=playlist_payload, headers=headers)
    if create_response.status_code not in (200, 201):
        raise HTTPException(status_code=create_response.status_code, detail=f"Spotify Create Playlist Error: {create_response.text}")
        
    playlist_data = create_response.json()
    playlist_id = playlist_data.get("id")
    playlist_url = playlist_data.get("external_urls", {}).get("spotify")

    add_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
    add_response = requests.post(add_url, json={"uris": track_uris}, headers=headers)
    if add_response.status_code not in (200, 201):
        raise HTTPException(status_code=add_response.status_code, detail=f"Spotify Add Tracks Error: {add_response.text}")

    return {"url": playlist_url}

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
