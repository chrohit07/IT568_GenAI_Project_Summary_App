"use strict";

/**
 * logic.js
 * Pure business logic extracted from server/index.js
 * This is what Stryker mutates — no Express, no MongoDB, no Groq
 */

const crypto = require("crypto");

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ── Session code generator ────────────────────────────────────────────────────
function generateCode(sessions) {
  if (!sessions) sessions = new Map();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += VALID_CHARS[crypto.randomInt(0, VALID_CHARS.length)];
  }
  if (sessions.has(code)) return generateCode(sessions);
  return code;
}

// ── Session create validation ─────────────────────────────────────────────────
function validateCreate(username) {
  if (!username || username.trim().length < 2) {
    return { error: "Name must be at least 2 characters.", status: 400 };
  }
  return { valid: true, username: username.trim() };
}

// ── Session join validation ───────────────────────────────────────────────────
function validateJoin(sessions, username, code) {
  const u = (username || "").trim();
  const c = (code || "").trim().toUpperCase();

  if (!u || u.length < 2) {
    return { error: "Name must be at least 2 characters.", status: 400 };
  }
  if (!c) {
    return { error: "Session code is required.", status: 400 };
  }
  const session = sessions.get(c);
  if (!session) {
    return { error: "Session not found. Check the code and try again.", status: 404 };
  }
  if (session.members.has(u)) {
    return {
      error: `"${u}" is already taken in this session. Please choose a different name.`,
      status: 409,
    };
  }
 return { valid: true, username: u, code: c, session };
}

// ── Summary JSON parser ───────────────────────────────────────────────────────
function parseSummaryJSON(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || "Chat Summary",
      overview: parsed.overview || "",
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    };
  } catch {
    return { title: "Summary", overview: raw, bullets: [] };
  }
}

// ── Transcript builder ────────────────────────────────────────────────────────
function buildTranscript(messages) {
  return messages
    .slice(-50)
    .map((m) => `${m.username}: ${m.text}`)
    .join("\n");
}

// ── Style prompt selector ─────────────────────────────────────────────────────
function getStylePrompt(style) {
  const styleMap = {
    bullets:   "Write a 1-sentence overview then exactly 3-5 concise bullet points.",
    concise:   "Write a concise 3-4 sentence paragraph summary.",
    tldr:      "Write a single TL;DR sentence under 25 words.",
    decisions: "List only the decisions made in the conversation as bullet points.",
    actions:   "List only action items and who is responsible as bullet points.",
  };
  return styleMap[style] || styleMap.bullets;
}

// ── Auto-summarize threshold ──────────────────────────────────────────────────
function getThreshold(autoSummarizeAt) {
  return autoSummarizeAt || 15;
}

// ── Effective threshold (0 = off) ─────────────────────────────────────────────
function getEffectiveThreshold(autoAt) {
  return autoAt || 999;
}

// ── Should trigger summary ────────────────────────────────────────────────────
function shouldTrigger(roomMsgCount, room, threshold) {
  return (roomMsgCount[room] || 0) >= threshold;
}

// ── Health response builder ───────────────────────────────────────────────────
function buildHealthResponse(model, dbState) {
  return {
    ok: true,
    model,
    db: dbState === 1 ? "connected" : "disconnected",
  };
}

module.exports = {
  VALID_CHARS,
  generateCode,
  validateCreate,
  validateJoin,
  parseSummaryJSON,
  buildTranscript,
  getStylePrompt,
  getThreshold,
  getEffectiveThreshold,
  shouldTrigger,
  buildHealthResponse,
};
