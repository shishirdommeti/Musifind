from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    spotify_id = Column(String, unique=True, index=True)
    display_name = Column(String)
    refresh_token = Column(String)

    genre_profiles = relationship("GenreDepthProfile", back_populates="user")
    track_history = relationship("TrackHistory", back_populates="user")
    global_profile = relationship("GlobalMusicProfile", back_populates="user", uselist=False)

class TrackHistory(Base):
    __tablename__ = "track_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    spotify_track_id = Column(String)
    played_at = Column(DateTime)

    user = relationship("User", back_populates="track_history")

class GlobalMusicProfile(Base):
    __tablename__ = "global_music_profile"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    overall_breadth_score = Column(Float)
    total_genres_discovered = Column(Integer)

    user = relationship("User", back_populates="global_profile")

class GenreDepthProfile(Base):
    __tablename__ = "genre_depth_profile"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    genre_name = Column(String)
    depth_score = Column(Float)
    track_count = Column(Integer)
    first_discovered_at = Column(DateTime)

    user = relationship("User", back_populates="genre_profiles")
