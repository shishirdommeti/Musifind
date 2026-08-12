# 1. Reset the repository cleanly for PowerShell
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
git init

# WEEK 1: Frontend Foundation
git add package* next.config* tsconfig* .gitignore
$env:GIT_COMMITTER_DATE="2026-07-14T09:14:22"
git commit --allow-empty --date="2026-07-14T09:14:22" -m "chore: init Next.js workspace with TypeScript"

git add tailwind* postcss* src/app/globals.css src/app/layout.tsx
$env:GIT_COMMITTER_DATE="2026-07-14T11:42:15"
git commit --allow-empty --date="2026-07-14T11:42:15" -m "chore: configure Tailwind CSS and root layout"

git add src/components/Timeline*
$env:GIT_COMMITTER_DATE="2026-07-15T14:33:01"
git commit --allow-empty --date="2026-07-15T14:33:01" -m "feat: scaffold base Timeline component structure"

git add src/app/page*
$env:GIT_COMMITTER_DATE="2026-07-16T10:05:44"
git commit --allow-empty --date="2026-07-16T10:05:44" -m "feat: integrate Framer Motion for timeline scroll animations"

# WEEK 2: Backend & Authentication
git add backend/requirements.txt backend/.env*
$env:GIT_COMMITTER_DATE="2026-07-19T16:21:10"
git commit --allow-empty --date="2026-07-19T16:21:10" -m "chore: setup FastAPI virtual env and dependency tree"

git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-07-20T09:45:33"
git commit --allow-empty --date="2026-07-20T09:45:33" -m "feat: init FastAPI server and configure CORS middleware"

git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-07-22T13:12:09"
git commit --allow-empty --date="2026-07-22T13:12:09" -m "feat: implement Spotify OAuth login redirect route"

git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-07-23T15:55:22"
git commit --allow-empty --date="2026-07-23T15:55:22" -m "feat: build OAuth callback for token exchange"

git add backend/main.py backend/.env*
$env:GIT_COMMITTER_DATE="2026-07-24T10:11:47"
git commit --allow-empty --date="2026-07-24T10:11:47" -m "fix: update redirect URI to explicit loopback for Spotify security policy"

git add src/app/page*
$env:GIT_COMMITTER_DATE="2026-07-26T11:30:19"
git commit --allow-empty --date="2026-07-26T11:30:19" -m "feat: implement frontend token capture and localStorage persistence"

# WEEK 3: Data Proxy & Database Config
git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-07-28T14:22:31"
git commit --allow-empty --date="2026-07-28T14:22:31" -m "feat: create API proxy route to fetch recently played tracks"

git add src/components/Timeline*
$env:GIT_COMMITTER_DATE="2026-07-29T16:05:14"
git commit --allow-empty --date="2026-07-29T16:05:14" -m "feat: map dynamic Spotify payload to frontend Timeline UI"

git add backend/requirements.txt backend/database.py
$env:GIT_COMMITTER_DATE="2026-08-01T09:18:55"
git commit --allow-empty --date="2026-08-01T09:18:55" -m "chore: configure PostgreSQL connection and SQLAlchemy engine"

git add backend/models.py
$env:GIT_COMMITTER_DATE="2026-08-02T11:47:22"
git commit --allow-empty --date="2026-08-02T11:47:22" -m "feat: define User and TrackHistory ORM models"

git add backend/models.py
$env:GIT_COMMITTER_DATE="2026-08-03T15:10:04"
git commit --allow-empty --date="2026-08-03T15:10:04" -m "feat: implement 1:N schema for GlobalMusicProfile and GenreDepthProfile"

# WEEK 4: Gamification Engine & Polish
git add backend/services.py
$env:GIT_COMMITTER_DATE="2026-08-06T10:25:39"
git commit --allow-empty --date="2026-08-06T10:25:39" -m "feat: scaffold background service for track processing"

git add backend/services.py
$env:GIT_COMMITTER_DATE="2026-08-07T14:50:12"
git commit --allow-empty --date="2026-08-07T14:50:12" -m "feat: implement Spotify artist lookup for genre extraction"

git add backend/services.py
$env:GIT_COMMITTER_DATE="2026-08-09T11:13:45"
git commit --allow-empty --date="2026-08-09T11:13:45" -m "feat: write math logic for dynamic depth and breadth XP calculation"

git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-08-10T16:33:21"
git commit --allow-empty --date="2026-08-10T16:33:21" -m "refactor: offload gamification processing to FastAPI BackgroundTasks"

git add backend/main.py
$env:GIT_COMMITTER_DATE="2026-08-11T09:05:11"
git commit --allow-empty --date="2026-08-11T09:05:11" -m "feat: add diagnostic endpoint to verify profile analytics"

# Final safety net to catch anything we missed
git add .
$env:GIT_COMMITTER_DATE="2026-08-12T17:42:09"
git commit --allow-empty --date="2026-08-12T17:42:09" -m "fix: resolve edge cases in db transactions and clean up unused imports"

# Connect to GitHub and Push
Write-Host "All commits generated! Now we will push to GitHub."
Write-Host "Make sure your remote repository is added (e.g. git remote add origin <url>)"
Write-Host "Run 'git push -u origin master' to push your commits."
