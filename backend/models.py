from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    spotify_id = Column(String, unique=True, index=True)
    display_name = Column(String)

    saved_albums = relationship("SavedAlbum", back_populates="user")

class SavedAlbum(Base):
    __tablename__ = "saved_albums"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    spotify_album_id = Column(String)
    title = Column(String)
    artist = Column(String)
    cover_image_url = Column(String)
    release_date = Column(String)
    genres = Column(String)
    status = Column(String)  # "listened" or "plan_to_listen"
    score = Column(Integer)  # 1 to 5
    notes = Column(Text)
    added_at = Column(DateTime)

    user = relationship("User", back_populates="saved_albums")
