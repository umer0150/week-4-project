# week-4-project

# CollabCanvas 🎨

Real-time collaborative whiteboard with chat, live dashboard, and authentication.

## Tech Stack
- **Frontend** — React, TypeScript, Vite, Tailwind, tldraw
- **Backend** — Express, Socket.io, TypeScript
- **Database** — PostgreSQL (Neon) + Drizzle ORM
- **Auth** — bcryptjs, React Hook Form, Zod
- **Deploy** — Docker + Railway

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/umer0150/week-4-project.git
cd collabcanvas
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### 2. Environment Variables
Create `server/.env`:


### 3. Run Migrations
```bash
cd server
npm run db:generate
npm run db:migrate
```

### 4. Start Dev Servers
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Visit `http://localhost:5173`

## Run with Docker
```bash
docker-compose up --build
```
Visit `http://localhost:3001`

## Deploy to Railway
1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables:
   - `DATABASE_URL` = your Neon connection string
   - `NODE_ENV` = `production`
4. Settings → Networking → Generate Domain 

## Features
- 🖌️ Real-time collaborative canvas (tldraw)
- 💬 Group chat with history
- 📊 Live dashboard (online users, stats)
- 🔐 Register / Login with unique username (e.g. `@ali12`)
- 💾 All data saved to PostgreSQL