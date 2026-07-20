import os
import urllib.parse
import requests
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
    "http://localhost:3000",
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
        return RedirectResponse(url=f"{FRONTEND_URL}?access_token={access_token}")
    else:
        return {"error": "Failed to retrieve access token", "details": response.text}

@app.get("/timeline")
def timeline(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"error": "Missing or invalid authorization header"}
    
    token = auth_header.split(" ")[1]
    
    spotify_url = "https://api.spotify.com/v1/me/player/recently-played"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(spotify_url, headers=headers)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Spotify Error: {response.text}")
        
    data = response.json()
    items = data.get("items", [])
    
    cleaned_data = []
    
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
        track = item.get("track", {})
        track_id = track.get("id")
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
