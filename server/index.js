require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const Groq = require("groq-sdk");
const path = require("path");
const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (_, res) =>
    res.sendFile(path.join(__dirname, "../client/dist/index.html"))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory session store
// sessions: Map<code, { leader, members: Set<username>, createdAt }>
// ─────────────────────────────────────────────────────────────────────────────
const sessions = new Map();

function generateCode() {
  // 6 uppercase alphanumeric chars, easy to read (no O/0, I/1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  // Ensure uniqueness
  if (sessions.has(code)) return generateCode();
  return code;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findSimilarMember(session, incoming) {
  const norm = normalizeName(incoming);
  for (const member of session.members) {
    if (normalizeName(member) === norm) return member;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB Models
// ─────────────────────────────────────────────────────────────────────────────
const MessageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    username: { type: String, required: true, maxlength: 32 },
    text: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ["message", "summary"], default: "message" },
    // summary-specific fields
    summaryTitle: String,
    summaryBullets: [String],
    summaryModel: String,
    summaryMsgCount: Number,
  },
  { timestamps: true }
);

MessageSchema.index({ room: 1, createdAt: -1 });
const Message = mongoose.model("Message", MessageSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Groq client
// ─────────────────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Per-room summarization lock (prevent double-firing)
const summaryLocks = new Set();

async function generateSummary(messages, room, style = "bullets", focus = "general") {
  if (summaryLocks.has(room)) return null;
  summaryLocks.add(room);

  const styleMap = {
    bullets: "Write a 1-sentence overview then exactly 3-5 concise bullet points.",
    concise: "Write a concise 3-4 sentence paragraph summary.",
    tldr: "Write a single TL;DR sentence under 25 words.",
    decisions: "List only the decisions made in the conversation as bullet points.",
    actions: "List only action items and who is responsible as bullet points.",
  };

  const transcript = messages
    .slice(-50)
    .map((m) => `${m.username}: ${m.text}`)
    .join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are SummaryBot. ${styleMap[style] || styleMap.bullets}
Respond ONLY with valid JSON, no markdown:
{"title":"short title max 8 words","overview":"1-2 sentence overview","bullets":["point 1","point 2","point 3"]}
For non-bullet styles put full summary in overview and use empty bullets array.`,
        },
        {
          role: "user",
          content: `Summarize this #${room} chat (${messages.length} messages):\n\n${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { title: "Summary", overview: raw, bullets: [] };
    }

    return {
      title: parsed.title || "Chat Summary",
      overview: parsed.overview || "",
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      model: MODEL,
      tokens: completion.usage?.total_tokens || 0,
    };
  } finally {
    summaryLocks.delete(room);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REST API
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ── Session: Create ──────────────────────────────────────────────────────────
app.post("/api/session/create", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters." });
  }
  const u = username.trim();
  const code = generateCode();
  sessions.set(code, {
    leader: u,
    members: new Set([u]),
    createdAt: new Date(),
  });
  console.log(`[session] Created #${code} by ${u}`);
  res.json({ code, leader: u });
});

// ── Session: Join ────────────────────────────────────────────────────────────
app.post("/api/session/join", (req, res) => {
  const { username, code } = req.body;
  const u = (username || "").trim();
  const c = (code || "").trim().toUpperCase();

  if (!u || u.length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters." });
  }
  if (!c) {
    return res.status(400).json({ error: "Session code is required." });
  }

  const session = sessions.get(c);
  if (!session) {
    return res.status(404).json({ error: "Session not found. Check the code and try again." });
  }

  // Name conflict check — exact match or similar (case, spacing, punctuation)
  const similar = findSimilarMember(session, u);
  if (similar) {
    return res.status(409).json({
      error: `"${u}" is too similar to "${similar}" in this session. Please choose a different name.`,
    });
  }

  session.members.add(u);
  console.log(`[session] ${u} joined #${c}`);
  res.json({ code: c, leader: session.leader, memberCount: session.members.size });
});

// ── Session: Info (optional helper) ─────────────────────────────────────────
app.get("/api/session/:code", (req, res) => {
  const session = sessions.get(req.params.code.toUpperCase());
  if (!session) return res.status(404).json({ error: "Session not found." });
  res.json({
    code: req.params.code.toUpperCase(),
    leader: session.leader,
    memberCount: session.members.size,
    createdAt: session.createdAt,
  });
});

// Get recent messages for a room (last 100)
app.get("/api/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(messages.reverse());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Trigger summary via REST (fallback) — returns only to the caller
app.post("/api/summarize/:room", async (req, res) => {
  try {
    const { style, focus } = req.body;
    const messages = await Message.find({
      room: req.params.room,
      type: "message",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!messages.length)
      return res.status(422).json({ error: "No messages to summarize" });

    const result = await generateSummary(
      messages.reverse(),
      req.params.room,
      style,
      focus
    );
    if (!result) return res.status(429).json({ error: "Summary in progress" });

    res.json({
      _id: new mongoose.Types.ObjectId().toString(),
      room: req.params.room,
      username: "SummaryBot",
      text: result.overview,
      type: "summary",
      summaryTitle: result.title,
      summaryBullets: result.bullets,
      summaryModel: result.model,
      summaryMsgCount: messages.length,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io — real-time layer
// ─────────────────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // User joins a room
  socket.on("join", async ({ room, username }) => {
    // ── Fix 1: Reject if session doesn't exist (invalid or ended code) ──
    const session = sessions.get(room);
    if (!session) {
      socket.emit("invalidSession");
      console.log(`[socket] ${username} tried to join non-existent session #${room}`);
      return;
    }

    socket.join(room);
    socket.data.room = room;
    socket.data.username = username;

    // Register username in session (handles reconnects)
    session.members.add(username);

    // Send last 100 messages on join
    const history = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    socket.emit("history", history.reverse());

    // Notify everyone (including the joiner) with current member count
    io.to(room).emit("userJoined", {
      username,
      room,
      time: new Date().toISOString(),
      onlineCount: session.members.size,
    });
    console.log(`[socket] ${username} joined #${room}`);
  });

  // Incoming chat message
  socket.on("message", async ({ text }) => {
    const { room, username } = socket.data;
    if (!room || !username || !text?.trim()) return;

    const msg = await Message.create({
      room,
      username,
      text: text.trim().slice(0, 2000),
      type: "message",
    });

    io.to(room).emit("message", msg);
  });

  // Manual summarize trigger from client — private to the requester
  socket.on("summarize", async ({ style }) => {
    const { room } = socket.data;
    if (!room) return;

    socket.emit("summarizing", { room });

    const messages = await Message.find({ room, type: "message" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!messages.length) {
      socket.emit("error", { message: "No messages to summarize yet." });
      return;
    }

    const result = await generateSummary(messages.reverse(), room, style || "bullets");
    if (!result) {
      socket.emit("error", { message: "Summary already in progress." });
      return;
    }

    socket.emit("summary", {
      _id: new mongoose.Types.ObjectId().toString(),
      room,
      username: "SummaryBot",
      text: result.overview,
      type: "summary",
      summaryTitle: result.title,
      summaryBullets: result.bullets,
      summaryModel: result.model,
      summaryMsgCount: messages.length,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const { room, username } = socket.data;
    if (room && username) {
      // Remove from session member list on disconnect
      const session = sessions.get(room);
      if (session) session.members.delete(username);

      io.to(room).emit("userLeft", {
        username,
        room,
        onlineCount: session ? session.members.size : 0,
      });
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });

  // Leader ends the session — wipe memory and notify everyone
  socket.on("endSession", ({ room }) => {
    if (!room) return;
    const session = sessions.get(room);
    if (!session) return;

    console.log(`[session] Ended #${room} by ${socket.data.username}`);

    // Notify all clients in the room BEFORE deleting
    io.to(room).emit("sessionEnded", { room });

    // Wipe from memory
    sessions.delete(room);
    summaryLocks.delete(room);

    // ── Fix 2: Clean up MongoDB so no ghost history leaks into future sessions ──
    Message.deleteMany({ room }).then(() => {
      console.log(`[session] MongoDB records deleted for #${room}`);
    }).catch((err) => {
      console.error(`[session] Failed to clean MongoDB for #${room}:`, err.message);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  if (!process.env.GROQ_API_KEY) {
    console.error("❌  GROQ_API_KEY is not set in .env");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("❌  MONGODB_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅  MongoDB Atlas connected");

  httpServer.listen(PORT, () => {
    console.log(`🤖  SummaryBot running → http://localhost:${PORT}`);
    console.log(`🧠  Model: ${MODEL}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});

