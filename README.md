# ◈ SummaryBot

Real-time multi-user chat with AI-powered summarization.
Built with **Groq** (llama-3.3-70b-versatile) + **MongoDB Atlas** + **Socket.io**.

---

## File Structure

```
summarybot/
├── server/
│   └── index.js        ← Express + Socket.io + Groq + MongoDB (everything)
├── client/
│   ├── src/
│   │   ├── main.jsx    ← React entry
│   │   ├── App.jsx     ← Full chat UI + socket logic
│   │   ├── App.module.css
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── package.json        ← Root: runs both server + client
├── .env.example
└── README.md
```

---

## Setup

### Step 1 — Install

```bash
# Root dependencies (server)
npm install

# Client dependencies
cd client && npm install && cd ..
```

### Step 2 — Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
GROQ_API_KEY=your_key_here
MONGODB_URI=your_atlas_uri_here
```

**Get Groq API Key:**
1. Visit https://console.groq.com
2. Sign up → API Keys → Create API Key

**Get MongoDB Atlas URI:**
1. Visit https://cloud.mongodb.com
2. Create free M0 cluster
3. Click Connect → Drivers → copy URI
4. Replace `<password>` with your DB user password
5. Add `0.0.0.0/0` to Network Access (allow all IPs)

### Step 3 — Run

```bash
# Development (starts both server + client with hot reload)
npm run dev
```

Open http://localhost:5173

---

## How It Works

1. User opens the app, enters their name, picks a room → joins
2. All users in the same room see each other's messages in real time via WebSockets
3. Messages are saved to MongoDB Atlas as they arrive
4. SummaryBot auto-summarizes every N messages (configurable: 5/10/15/20/30/off)
5. Any user can also click "Summarize Now" to trigger on demand
6. The summary appears as a card in the chat for everyone in the room

---

## Production Deployment

### Build frontend

```bash
npm run build
# Built files go to client/dist/
```

### Deploy to Railway

```bash
npm install -g @railway/cli
railway login && railway new && railway up
```

Set env vars in Railway dashboard: `GROQ_API_KEY`, `MONGODB_URI`, `NODE_ENV=production`

### Deploy to your Oracle Cloud instance

```bash
# On your Oracle A1.Flex VM
git clone <repo> && cd summarybot
npm install && cd client && npm install && npm run build && cd ..
npm start
```

Use Nginx as a reverse proxy on port 80 → 3001.

---

## API

| Route | Description |
|-------|-------------|
| `GET /api/health` | Server + DB status |
| `GET /api/messages/:room` | Last 100 messages |
| `POST /api/summarize/:room` | Trigger summary via REST |

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | client→server | Join a room |
| `message` | client→server | Send a message |
| `summarize` | client→server | Trigger summary |
| `history` | server→client | Last 100 messages on join |
| `message` | server→client | New message broadcast |
| `summary` | server→client | Summary card broadcast |
| `summarizing` | server→client | Summary in progress |
| `userJoined` | server→client | Someone joined |
| `userLeft` | server→client | Someone left |
