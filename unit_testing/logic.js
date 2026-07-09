"use strict";

const crypto = require("crypto");

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(sessions) {
  if (!sessions) sessions = new Map();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += VALID_CHARS[crypto.randomInt(0, VALID_CHARS.length)];
  }
  if (sessions.has(code)) return generateCode(sessions);
  return code;
}
function createSession(sessions, username) {
  if (!username || username.trim().length < 2) {
    return { error: "Name must be at least 2 characters.", status: 400 };
  }
  const u = username.trim();
  const code = generateCode(sessions);
  sessions.set(code, {
    leader: u,
    members: new Set([u]),
    createdAt: new Date(),
  });
  return { code, leader: u };
}

function joinSession(sessions, username, code) {
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
  session.members.add(u);
  return { code: c, leader: session.leader, memberCount: session.members.size };
}

function parseSummaryResponse(raw) {
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

function getAutoThreshold(autoSummarizeAt) {
  return autoSummarizeAt || 15;
}

function getEffectiveThreshold(autoAt) {
  return autoAt || 999;
}

function shouldTriggerSummary(roomMsgCount, room, threshold) {
  return (roomMsgCount[room] || 0) >= threshold;
}

function buildTranscript(messages) {
  return messages
    .slice(-50)
    .map((m) => `${m.username}: ${m.text}`)
    .join("\n");
}

module.exports = {
  generateCode,
  createSession,
  joinSession,
  parseSummaryResponse,
  getAutoThreshold,
  getEffectiveThreshold,
  shouldTriggerSummary,
  buildTranscript,
  VALID_CHARS,
};
