import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import styles from "./App.module.css";

// ─── Socket singleton ────────────────────────────────────────────────────────
const socket = io({ autoConnect: false });

// ─── Constants ───────────────────────────────────────────────────────────────
const STYLES = [
  { value: "bullets", label: "Key bullets" },
  { value: "concise", label: "Short paragraph" },
  { value: "tldr", label: "TL;DR one-liner" },
  { value: "decisions", label: "Decisions only" },
  { value: "actions", label: "Action items" },
];
// ─── Helpers ─────────────────────────────────────────────────────────────────
function time(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_PALETTE = [
  ["#2a3f1a", "#c8f07a"],
  ["#1a2e3f", "#7ab8f0"],
  ["#3f1a2a", "#f07ab8"],
  ["#2e1a3f", "#b87af0"],
  ["#3f2e1a", "#f0c87a"],
  ["#1a3f2e", "#7af0c8"],
];

function avatarColors(name = "") {
  const idx =
    [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function exportSummariesToPDF(messages, room) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const colors = {
    title: [20, 20, 20],
    body: [50, 50, 50],
    muted: [120, 120, 120],
    accent: [37, 99, 235],
    white: [255, 255, 255],
    lightBg: [245, 247, 250],
    border: [210, 215, 225],
    bulletDot: [37, 99, 235],
  };

  function checkPage(needed = 12) {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  }

  function addText(text, opts = {}) {
    const {
      fontSize = 10.5,
      color = colors.body,
      bold = false,
      italic = false,
      lineHeight = 5.5,
      maxWidth = contentW,
      x = margin,
    } = opts;
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const style = bold ? "bold" : italic ? "italic" : "normal";
    doc.setFont("helvetica", style);
    const lines = doc.splitTextToSize(String(text || ""), maxWidth);
    lines.forEach((line) => {
      checkPage(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    });
  }

  // ── Header ──
  doc.setFillColor(...colors.accent);
  doc.rect(0, 0, pageW, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.white);
  doc.text("SummaryBot", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 215, 255);
  doc.text(`Session #${room}`, margin, 22);
  doc.text(
    `Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    margin,
    28,
  );

  y = 42;

  const summaries = messages.filter((m) => m.type === "summary");

  if (summaries.length === 0) {
    addText("No summaries have been generated in this session yet.", {
      color: colors.muted,
      fontSize: 12,
      italic: true,
    });
  } else {
    // Summary count badge
    addText(
      `${summaries.length} summar${summaries.length === 1 ? "y" : "ies"} generated`,
      { fontSize: 10, color: colors.muted },
    );
    y += 4;

    summaries.forEach((msg, idx) => {
      checkPage(40);

      // Card background
      const cardStartY = y;

      // Summary number + title
      doc.setFillColor(...colors.lightBg);
      doc.roundedRect(margin, y - 2, contentW, 10, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colors.accent);
      doc.text(`Summary ${idx + 1}`, margin + 4, y + 4.5);

      // Meta on same line, right-aligned
      const meta = `${msg.summaryMsgCount || "?"} messages  |  ${time(msg.createdAt)}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...colors.muted);
      doc.text(meta, pageW - margin - 4, y + 4.5, { align: "right" });

      y += 14;

      // Title
      addText(msg.summaryTitle || "Chat Summary", {
        fontSize: 13,
        color: colors.title,
        bold: true,
        lineHeight: 6.5,
      });
      y += 2;

      // Overview
      if (msg.text) {
        addText(msg.text, {
          fontSize: 10.5,
          color: colors.body,
          lineHeight: 5.5,
        });
        y += 3;
      }

      // Bullets
      if (msg.summaryBullets?.length > 0) {
        msg.summaryBullets.forEach((bullet) => {
          checkPage(8);

          // Bullet dot
          doc.setFillColor(...colors.bulletDot);
          doc.circle(margin + 3, y - 1.2, 1, "F");

          // Bullet text
          doc.setFontSize(10.5);
          doc.setTextColor(...colors.body);
          doc.setFont("helvetica", "normal");
          const bulletLines = doc.splitTextToSize(bullet, contentW - 12);
          bulletLines.forEach((line, li) => {
            checkPage(5.5);
            doc.text(line, margin + 8, y);
            y += 5.5;
          });
          y += 1.5;
        });
        y += 2;
      }

      // Model tag
      if (msg.summaryModel) {
        doc.setFontSize(7.5);
        doc.setTextColor(...colors.muted);
        doc.setFont("helvetica", "italic");
        doc.text(`Model: ${msg.summaryModel}`, margin, y);
        y += 5;
      }

      // Divider between summaries
      if (idx < summaries.length - 1) {
        y += 2;
        checkPage(8);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageW - margin, y);
        y += 8;
      }
    });
  }

  // Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.muted);
    doc.text("SummaryBot", margin, pageH - 9);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageW - margin,
      pageH - 9,
      { align: "right" },
    );
  }

  doc.save(`summarybot-${room}-${Date.now()}.pdf`);
}

// ─── Components ──────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  const [bg, fg] = avatarColors(name);
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.34,
      }}
    >
      {initials(name)}
    </div>
  );
}

function SummaryCard({ msg, onExportPDF }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <span className={styles.summaryBadge}>✦ AI Summary</span>
        <span className={styles.summaryMeta}>
          {msg.summaryMsgCount} msgs · {time(msg.createdAt)}
          {msg.summaryModel && (
            <> · {msg.summaryModel.split("-").slice(0, 3).join("-")}</>
          )}
        </span>
        {onExportPDF && (
          <button
            className={styles.pdfBtn}
            onClick={onExportPDF}
            title="Export summary as PDF"
          >
            ↓ PDF
          </button>
        )}
      </div>
      <div className={styles.summaryTitle}>{msg.summaryTitle}</div>
      {msg.text && <p className={styles.summaryOverview}>{msg.text}</p>}
      {msg.summaryBullets?.length > 0 && (
        <ul className={styles.summaryBullets}>
          {msg.summaryBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatMessage({ msg, isOwn }) {
  return (
    <div className={`${styles.message} ${isOwn ? styles.messageOwn : ""}`}>
      <Avatar name={msg.username} />
      <div className={styles.messageBody}>
        <div className={styles.messageMeta}>
          <span className={styles.messageUser}>{msg.username}</span>
          <span className={styles.messageTime}>{time(msg.createdAt)}</span>
        </div>
        <div data-testid="chat-message" className={styles.messageText}>
          {msg.text}
        </div>
      </div>
    </div>
  );
}

function SystemEvent({ text }) {
  return <div className={styles.systemEvent}>{text}</div>;
}

// ─── Join Screen ─────────────────────────────────────────────────────────────
function JoinScreen({ onJoin }) {
  // "landing" | "create" | "join"
  const [view, setView] = useState("landing");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);

  function resetError() {
    setError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    const u = username.trim();
    if (!u) return setError("Please enter your name.");
    if (u.length < 2) return setError("Name must be at least 2 characters.");
    setLoading(true);
    try {
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to create session.");
      setCreatedCode(data.code);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(createdCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleEnterSession() {
    onJoin(username.trim(), createdCode, true);
  }

  async function handleJoin(e) {
    e.preventDefault();
    const u = username.trim();
    const c = code.trim().toUpperCase();
    if (!u) return setError("Please enter your name.");
    if (u.length < 2) return setError("Name must be at least 2 characters.");
    if (!c || c.length < 4)
      return setError("Please enter a valid session code.");
    setLoading(true);
    try {
      const res = await fetch("/api/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, code: c }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to join session.");
      onJoin(u, c, false);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  if (view === "landing") {
    return (
      <div className={styles.joinWrap}>
        <div className={styles.joinCard}>
          <div className={styles.joinLogo}>
            <span className={styles.joinLogoIcon}>◈</span>
            <span className={styles.joinLogoText}>SummaryBot</span>
          </div>
          <p className={styles.joinSub}>
            Real-time chat with AI-powered summarization
          </p>

          <div className={styles.sessionOptions}>
            <button
              data-testid="create-session-btn"
              className={styles.sessionOptBtn}
              onClick={() => {
                setView("create");
                resetError();
              }}
            >
              <span className={styles.sessionOptIcon}>✦</span>
              <span className={styles.sessionOptTitle}>Create Session</span>
              <span className={styles.sessionOptDesc}>
                Start a new room and invite others with a code
              </span>
              <span className={styles.sessionOptBadge}>Leader</span>
            </button>

            <button
              data-testid="join-session-btn"
              className={styles.sessionOptBtn}
              onClick={() => {
                setView("join");
                resetError();
              }}
            >
              <span className={styles.sessionOptIcon}>→</span>
              <span className={styles.sessionOptTitle}>Join Session</span>
              <span className={styles.sessionOptDesc}>
                Enter an existing session code to join the chat
              </span>
              <span className={styles.sessionOptBadge}>Member</span>
            </button>
          </div>

          <div className={styles.joinFooter}>
            Powered by Groq · MongoDB Atlas
          </div>
        </div>
      </div>
    );
  }

  // ── Create flow ──
  if (view === "create") {
    return (
      <div className={styles.joinWrap}>
        <div className={styles.joinCard}>
          <button
            className={styles.backBtn}
            onClick={() => {
              setView("landing");
              setUsername("");
              setCreatedCode("");
              setError("");
            }}
          >
            ← Back
          </button>
          <div className={styles.joinLogo}>
            <span className={styles.joinLogoIcon}>✦</span>
            <span className={styles.joinLogoText}>Create Session</span>
          </div>
          <p className={styles.joinSub}>
            You'll be the session leader. Share the code with your team.
          </p>

          {!createdCode ? (
            <form onSubmit={handleCreate} className={styles.joinForm}>
              <div className={styles.field}>
                <label className={styles.label}>Your name</label>
                <input
                  data-testid="username-input"
                  className={styles.input}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    resetError();
                  }}
                  placeholder="e.g. Parth"
                  maxLength={32}
                  autoFocus
                />
              </div>
              {error && <div className={styles.errorMsg}>{error}</div>}
              <button
                className={styles.joinBtn}
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating…" : "Generate Session Code →"}
              </button>
            </form>
          ) : (
            <div className={styles.codeReveal}>
              <div className={styles.codeLabel}>Your session code</div>
              <div className={styles.codeBlock}>
                <span className={styles.codeText}>{createdCode}</span>
                <button className={styles.copyBtn} onClick={handleCopyCode}>
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <p className={styles.codeHint}>
                Share this code with anyone who wants to join your session.
              </p>
              <button className={styles.joinBtn} onClick={handleEnterSession}>
                Enter Session →
              </button>
            </div>
          )}

          <div className={styles.joinFooter}>
            Powered by Groq · MongoDB Atlas
          </div>
        </div>
      </div>
    );
  }

  // ── Join flow ──
  return (
    <div className={styles.joinWrap}>
      <div className={styles.joinCard}>
        <button
          className={styles.backBtn}
          onClick={() => {
            setView("landing");
            setUsername("");
            setCode("");
            setError("");
          }}
        >
          ← Back
        </button>
        <div className={styles.joinLogo}>
          <span className={styles.joinLogoIcon}>→</span>
          <span className={styles.joinLogoText}>Join Session</span>
        </div>
        <p className={styles.joinSub}>
          Enter the session code shared by your team leader.
        </p>

        <form onSubmit={handleJoin} className={styles.joinForm}>
          <div className={styles.field}>
            <label className={styles.label}>Your name</label>
            <input
              data-testid="username-input"
              className={styles.input}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                resetError();
              }}
              placeholder="e.g. Parth"
              maxLength={32}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Session code</label>
            <input
              data-testid="session-code-input"
              className={`${styles.input} ${styles.codeInput}`}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                resetError();
              }}
              placeholder="e.g. XKQZ"
              maxLength={8}
            />
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
          <button
            data-testid="join-submit-btn"
            className={styles.joinBtn}
            type="submit"
            disabled={
              loading || username.trim().length < 2 || code.trim().length < 4
            }
          >
            {loading ? "Joining…" : "Join Session →"}
          </button>
        </form>

        <div className={styles.joinFooter}>Powered by Groq · MongoDB Atlas</div>
      </div>
    </div>
  );
}

// ─── Ended Screen ────────────────────────────────────────────────────────────
function SessionEndedScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "40px 32px",
          background: "var(--bg1)",
          border: "1px solid var(--border2)",
          borderRadius: "14px",
          maxWidth: "360px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12, color: "var(--text3)" }}>
          ◈
        </div>
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: 20,
            fontStyle: "italic",
            color: "var(--text)",
            marginBottom: 8,
          }}
        >
          Session Ended
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--text3)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          The session leader has ended this session. All session data has been
          cleared.
        </p>
        <button
          style={{
            width: "100%",
            padding: "11px",
            background: "rgba(200,240,122,0.12)",
            border: "1px solid rgba(200,240,122,0.3)",
            borderRadius: "var(--radius)",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "var(--mono)",
          }}
          onClick={() => window.location.reload()}
        >
          Back to Home →
        </button>
      </div>
    </div>
  );
}

// ─── Main Chat ────────────────────────────────────────────────────────────────
export default function App() {
  const [joined, setJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [isLeader, setIsLeader] = useState(false);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [input, setInput] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryStyle, setSummaryStyle] = useState("bullets");
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const isLeaderRef = useRef(false);
  const roomRef = useRef("");

  const feed = [...messages, ...events].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  // Keep refs in sync for use in event listeners
  useEffect(() => {
    isLeaderRef.current = isLeader;
  }, [isLeader]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // ── Socket lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;

    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", { room, username });
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("history", (history) => setMessages(history));

    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("summary", (msg) => {
      setMessages((prev) => [...prev, msg]);
      setSummarizing(false);
    });

    socket.on("summarizing", () => setSummarizing(true));

    socket.on("userJoined", ({ username: u, onlineCount: count }) => {
      setOnlineCount(count);
      if (u === username) return;
      setEvents((prev) => [
        ...prev,
        {
          _id: Date.now(),
          createdAt: new Date().toISOString(),
          _isEvent: true,
          text: `${u} joined the room`,
        },
      ]);
    });

    socket.on("userLeft", ({ username: u, onlineCount: count }) => {
      setOnlineCount(count);
      setEvents((prev) => [
        ...prev,
        {
          _id: Date.now() + 1,
          createdAt: new Date().toISOString(),
          _isEvent: true,
          text: `${u} left the room`,
        },
      ]);
    });

    socket.on("error", ({ message }) => {
      setEvents((prev) => [
        ...prev,
        {
          _id: Date.now() + 2,
          createdAt: new Date().toISOString(),
          _isEvent: true,
          text: `⚠ ${message}`,
        },
      ]);
      setSummarizing(false);
    });

    // Session ended by leader — show ended screen to all members
    socket.on("sessionEnded", () => {
      setSessionEnded(true);
      socket.disconnect();
    });

    // ── Fix 3: Server rejected join — code invalid or session already ended ──
    socket.on("invalidSession", () => {
      socket.disconnect();
      window.location.reload(); // boots back to landing screen
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("history");
      socket.off("message");
      socket.off("summary");
      socket.off("summarizing");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("error");
      socket.off("sessionEnded");
      socket.off("invalidSession");
      socket.disconnect();
    };
  }, [joined]);

  // ── Leader tab-close / refresh guard ────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;

    function handleBeforeUnload(e) {
      if (isLeaderRef.current) {
        // Fire end-session synchronously on tab close
        socket.emit("endSession", { room: roomRef.current });
        e.preventDefault();
        e.returnValue = "Leaving as leader will end the session for everyone.";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [joined]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed.length]);

  function handleJoin(u, code, leader) {
    setUsername(u);
    setRoom(code);
    setIsLeader(leader);
    setSidebarOpen(window.innerWidth > 768);
    setJoined(true);
  }

  // Exit chat (non-leaders) — just disconnect and go back to landing
  function handleExit() {
    socket.disconnect();
    window.location.reload();
  }

  // End session (leader only) — wipe everything server-side
  function handleEndSession() {
    socket.emit("endSession", { room });
    socket.disconnect();
    window.location.reload();
  }

  function sendMessage() {
    const text = input.trim();
    if (!text || !connected) return;
    socket.emit("message", { text });
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const triggerSummary = useCallback(() => {
    if (summarizing) return;
    setSummarizing(true);
    socket.emit("summarize", { style: summaryStyle });
  }, [summarizing, summaryStyle]);

  async function handleExportAllPDF() {
    setExportingPDF(true);
    try {
      await exportSummariesToPDF(messages, room);
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleExportOnePDF(msg) {
    setExportingPDF(true);
    try {
      await exportSummariesToPDF([msg], room);
    } finally {
      setExportingPDF(false);
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(room).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  if (sessionEnded) return <SessionEndedScreen />;
  if (!joined) return <JoinScreen onJoin={handleJoin} />;

  return (
    <div className={styles.app}>
      {/* ── Exit confirm modal (non-leader) ── */}
      {showExitConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalTitle}>Leave session?</div>
            <p className={styles.modalDesc}>
              You'll be removed from the chat. You can rejoin with the same
              code.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowExitConfirm(false)}
              >
                Cancel
              </button>
              <button className={styles.modalDanger} onClick={handleExit}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── End session confirm modal (leader) ── */}
      {showEndConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalTitle}>End session?</div>
            <p className={styles.modalDesc}>
              This will immediately end the session for{" "}
              <strong>everyone</strong> and erase all session data from memory.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </button>
              <button className={styles.modalDanger} onClick={handleEndSession}>
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.logo}>◈ SummaryBot</span>
          {isLeader && <span className={styles.leaderBadge}>Leader</span>}
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.topbarDesktopOnly}>
            <button
              className={styles.iconBtn}
              onClick={handleCopyCode}
              title="Copy session code"
            >
              {codeCopied ? "✓" : "⌗"} {codeCopied ? "Copied" : room}
            </button>
          </span>
          <span
            className={`${styles.connDot} ${connected ? styles.connOnline : styles.connOff}`}
          />
          <span className={`${styles.connLabel} ${styles.topbarDesktopOnly}`}>
            {connected ? `${onlineCount} online` : "reconnecting…"}
          </span>
          <button
            className={styles.iconBtn}
            onClick={() => setSidebarOpen((s) => !s)}
            title="Toggle sidebar"
          >
            {sidebarOpen ? "⇥" : "⇤"}
          </button>
          {isLeader ? (
            <button
              className={styles.endSessionBtn}
              onClick={() => setShowEndConfirm(true)}
              title="End session for everyone"
            >
              <span className={styles.btnTextFull}>✕ End Session</span>
              <span className={styles.btnTextShort}>✕</span>
            </button>
          ) : (
            <button
              className={styles.exitBtn}
              onClick={() => setShowExitConfirm(true)}
              title="Leave this session"
            >
              <span className={styles.btnTextFull}>← Exit</span>
              <span className={styles.btnTextShort}>←</span>
            </button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {/* ── Chat area ── */}
        <main className={styles.chatArea}>
          <div className={styles.feed}>
            {feed.length === 0 && (
              <div className={styles.emptyFeed}>
                <div className={styles.emptyIcon}>◈</div>
                <p>No messages yet.</p>
                <p>Say something — SummaryBot is listening.</p>
              </div>
            )}

            {feed.map((item) => {
              if (item._isEvent)
                return <SystemEvent key={item._id} text={item.text} />;
              if (item.type === "summary")
                return (
                  <SummaryCard
                    key={item._id}
                    msg={item}
                    onExportPDF={() => handleExportOnePDF(item)}
                  />
                );
              return (
                <ChatMessage
                  key={item._id}
                  msg={item}
                  isOwn={item.username === username}
                />
              );
            })}

            {summarizing && (
              <div className={styles.typingIndicator}>
                <span />
                <span />
                <span />
                <em>SummaryBot is thinking…</em>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className={styles.inputBar}>
            <input
              data-testid="chat-input"
              ref={inputRef}
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? `Message #${room}…` : "Connecting…"}
              disabled={!connected}
              maxLength={2000}
            />
            <button
              data-testid="send-btn"
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={!connected || !input.trim()}
            >
              Send
            </button>
            <button
              className={`${styles.summarizeBtn} ${summarizing ? styles.summarizingBtn : ""}`}
              onClick={triggerSummary}
              disabled={summarizing || !connected}
              title="Summarize now"
            >
              {summarizing ? (
                <span className={styles.spinner} />
              ) : (
                "✦ Summarize"
              )}
            </button>
          </div>
        </main>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <>
            <div
              className={styles.sidebarOverlay}
              onClick={() => setSidebarOpen(false)}
            />
            <aside className={styles.sidebar}>
              <div className={styles.sidebarCloseRow}>
                <button
                  className={styles.sidebarCloseBtn}
                  onClick={() => setSidebarOpen(false)}
                >
                  ← Close
                </button>
              </div>
              <div className={styles.sideSection}>
                <div className={styles.sideLabel}>You</div>
                <div className={styles.userInfo}>
                  <Avatar name={username} size={36} />
                  <div>
                    <div className={styles.userName}>{username}</div>
                    <div className={styles.userRoom}>
                      {isLeader ? "Leader" : "Member"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.sideSection}>
                <div className={styles.sideLabel}>Session Code</div>
                <div className={styles.sessionCodeWrap}>
                  <span className={styles.sessionCodeDisplay}>{room}</span>
                  <button
                    className={styles.sessionCodeCopy}
                    onClick={handleCopyCode}
                  >
                    {codeCopied ? "✓" : "Copy"}
                  </button>
                </div>
                <p className={styles.sessionCodeHint}>
                  Share this code to invite others
                </p>
              </div>

              <div className={styles.sideSection}>
                <div className={styles.sideLabel}>Summary Style</div>
                <div className={styles.styleList}>
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      className={`${styles.styleBtn} ${summaryStyle === s.value ? styles.styleBtnActive : ""}`}
                      onClick={() => setSummaryStyle(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sideSection}>
                <button
                  className={styles.bigSumBtn}
                  onClick={triggerSummary}
                  disabled={summarizing || !connected}
                >
                  {summarizing ? (
                    <>
                      <span className={styles.spinner} /> Summarizing…
                    </>
                  ) : (
                    "✦ Summarize Now"
                  )}
                </button>
              </div>

              <div className={styles.sideSection}>
                <button
                  className={styles.pdfExportBtn}
                  onClick={handleExportAllPDF}
                  disabled={
                    exportingPDF ||
                    messages.filter((m) => m.type === "summary").length === 0
                  }
                  title="Export all summaries as PDF"
                >
                  {exportingPDF ? (
                    <>
                      <span className={styles.spinner} /> Exporting…
                    </>
                  ) : (
                    "↓ Export Summaries PDF"
                  )}
                </button>
              </div>

              <div className={styles.sideFooter}>
                Groq · llama-3.3-70b
                <br />
                MongoDB Atlas
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
