# Musifind

A full-stack web application that serves as a "Letterboxd for Music," allowing users to track, rate, and review albums while discovering new music through an algorithmic, recursive recommendation engine. It also features a custom playlist generator that curates and syncs personalized tracks directly to the user's Spotify account.

 **[Live Demo URL]**  |   **[Backend Repo URL (if separate)]**

---

##  Key Features
* **The Album Diary:** Track, rate, and review albums using a 10-point scale, organizing them seamlessly into "Listened" and "Plan to Listen" collections.
* **Recursive Discovery Engine:** Infinitely explore new music by clicking on algorithmic recommendations to view metadata, write reviews, and instantly generate fresh, deduplicated suggestions.
* **Stateless Playlist Generator:** Analyzes recent listening history to automatically curate and inject a 30-song "Sonic Discovery" playlist into the user's Spotify account.
* **Smart Search & Deduplication:** Search for any album via Spotify's catalog, with a recommendation engine that cross-references your database to guarantee you are only recommended albums you haven't logged yet.

##  Tech Stack & Architecture
* **Frontend:** React, Vite, TypeScript, Tailwind CSS
* **Backend:** Python, FastAPI, PostgreSQL
* **External APIs:** Spotify Web API, Last.fm API, Apple Music API
* **Data Modeling:** SQLAlchemy (ORM), Pydantic

### Technical Highlights & Challenges
* **Cross-Platform API Bridging:** Bypassed deprecated Spotify recommendation endpoints by engineering an Adapter Pattern that translates Spotify entities, queries the Last.fm graph network, and maps the data back into actionable Spotify URIs.
* **Fault-Tolerant API Fallbacks:** Overcame strict Spotify developer rate limits by building a high-availability fallback architecture that queries local PostgreSQL metadata and routes to the open Apple Music API, achieving zero UI downtime.
* **Type-Safe State Management:** Utilized TypeScript Discriminated Unions to manage complex, asynchronous UI state transitions between local database records and unsaved third-party API payloads, eliminating null-reference exceptions.
* **Algorithmic Deduplication & Caching:** Engineered an in-memory token caching layer and O(1) hash set lookups to instantly filter third-party recommendations against localized PostgreSQL data, drastically reducing network latency.
* **Seamless OAuth 2.0 Lifecycle:** Implemented Axios Interceptors to silently catch unauthorized responses, securely refresh access tokens via HttpOnly cookies, and automatically replay dropped network requests without disrupting the user experience.

##  Setup & Installation
To run this project locally, follow these quick steps:

**1. Clone the repository:**
```bash
git clone [https://github.com/](https://github.com/)[Your-Username]/[Repository-Name].git
```

**2. Backend Setup:**
Navigate to the `backend` directory, create a virtual environment, and install dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder:
```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=[http://127.0.0.1:8000/callback](http://127.0.0.1:8000/callback)
FRONTEND_URL=http://localhost:5173
LASTFM_API_KEY=your_lastfm_key
DATABASE_URL=postgresql://user:password@localhost:5432/your_db_name
```
Start the FastAPI server: 
```bash
uvicorn main:app --reload
```

**3. Frontend Setup:**
Navigate to the `frontend` directory, install dependencies, and run the Vite server:
```bash
cd ../frontend
npm install
npm run dev
```
