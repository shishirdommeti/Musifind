import requests
from sqlalchemy.orm import Session
from datetime import datetime
import models

def process_track_gamification(db: Session, user_id: int, artist_id: str, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"https://api.spotify.com/v1/artists/{artist_id}", headers=headers)
    
    if response.status_code != 200:
        return
        
    data = response.json()
    genres = data.get("genres", [])
    
    for genre in genres:
        profile = db.query(models.GenreDepthProfile).filter(
            models.GenreDepthProfile.user_id == user_id,
            models.GenreDepthProfile.genre_name == genre
        ).first()
        
        if profile:
            profile.track_count += 1
            profile.depth_score += 1.5
        else:
            new_profile = models.GenreDepthProfile(
                user_id=user_id,
                genre_name=genre,
                depth_score=1.0,
                track_count=1,
                first_discovered_at=datetime.utcnow()
            )
            db.add(new_profile)
            
    db.commit()
    
    # Query GenreDepthProfile for total unique genres
    total_genres = db.query(models.GenreDepthProfile).filter(
        models.GenreDepthProfile.user_id == user_id
    ).count()
    
    global_profile = db.query(models.GlobalMusicProfile).filter(
        models.GlobalMusicProfile.user_id == user_id
    ).first()
    
    if global_profile:
        global_profile.total_genres_discovered = total_genres
        global_profile.overall_breadth_score = total_genres * 0.5
    else:
        new_global_profile = models.GlobalMusicProfile(
            user_id=user_id,
            total_genres_discovered=total_genres,
            overall_breadth_score=total_genres * 0.5
        )
        db.add(new_global_profile)
        
    db.commit()
