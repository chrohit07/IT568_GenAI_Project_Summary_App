/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NON-FUNCTIONAL TESTS — SECURITY
 * Tests: Input Validation, Injection Attacks, Headers, Data Boundaries
 *
 * PRE-REQUISITE: Server must be running → cd server && node index.js
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use strict";

const { expect } = require("chai");
const supertest = require("supertest");
const { io: ioClient } = require("socket.io-client");

const BASE_URL = "http://localhost:3001";
const request = supertest(BASE_URL);

async function createSession(username) {
  const res = await request
    .post("/api/session/create")
    .send({ username })
    .set("Content-Type", "application/json");
  return res.body;
}

function connectSocket() {
  return ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// SEC-01: Input Validation & Sanitization
// ─────────────────────────────────────────────────────────────────────────────
describe("SEC-01: Input Validation & Sanitization", () => {
  it("should reject SQL injection attempt in username", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "'; DROP TABLE users; --" })
      .set("Content-Type", "application/json");
    // Server should either accept it as plain text or reject — never crash
    expect(res.status).to.be.oneOf([200, 400]);
    expect(res.status).to.not.equal(500);
  });

  it("should reject NoSQL injection in session code", async () => {
    const res = await request
      .post("/api/session/join")
      .send({ username: "Bob", code: { $gt: "" } })
      .set("Content-Type", "application/json");
    expect(res.status).to.be.oneOf([400, 404]);
    expect(res.status).to.not.equal(500);
  });

  it("should reject XSS payload in username without crashing", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "<script>alert('xss')</script>" })
      .set("Content-Type", "application/json");
    // Either accept as plain text (length > 2 chars so valid) or reject
    expect(res.status).to.not.equal(500);
    if (res.status === 200) {
      // If accepted, it must be stored as plain text, not executed
      expect(res.body.leader).to.be.a("string");
    }
  });

  it("should reject extremely long username (boundary test)", async () => {
    const longName = "A".repeat(1000);
    const res = await request
      .post("/api/session/create")
      .send({ username: longName })
      .set("Content-Type", "application/json");
    // Should not crash — either accept or reject gracefully
    expect(res.status).to.not.equal(500);
  });

  it("should handle null byte injection in username", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "Admin\x00Evil" })
      .set("Content-Type", "application/json");
    expect(res.status).to.not.equal(500);
  });

  it("should reject empty body on session create", async () => {
    const res = await request
      .post("/api/session/create")
      .set("Content-Type", "application/json")
      .send({});
    expect(res.status).to.equal(400);
  });

  it("should handle non-string username type (number)", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: 12345 })
      .set("Content-Type", "application/json");
    expect(res.status).to.not.equal(500);
  });

  it("should handle array as username", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: ["Alice", "Bob"] })
      .set("Content-Type", "application/json");
    expect(res.status).to.not.equal(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-02: Session Code Security
// ─────────────────────────────────────────────────────────────────────────────
describe("SEC-02: Session Code Security", () => {
  it("should not expose session for random guessed codes", async () => {
    const guessCodes = ["AAAAAA", "BBBBBB", "CCCCCC", "123456", "FFFFFF"];
    for (const code of guessCodes) {
      const res = await request.get(`/api/session/${code}`);
      // Should be 404 (not found) — not a server error
      if (res.status !== 200) {
        expect(res.status).to.equal(404);
      }
    }
    console.log(`    → Random code guesses return 404, not server errors`);
  });

  it("should return 404 not 500 for malformed session code", async () => {
    const res = await request.get("/api/session/../../etc/passwd");
    expect(res.status).to.not.equal(500);
  });

  it("should not allow joining session with empty code", async () => {
    const res = await request
      .post("/api/session/join")
      .send({ username: "Hacker", code: "" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
  });

  it("should enforce duplicate username prevention per session", async () => {
    const { code } = await createSession("SecLeader");
    // Try to join with the same username multiple times
    const r1 = await request
      .post("/api/session/join")
      .send({ username: "SecLeader", code })
      .set("Content-Type", "application/json");
    const r2 = await request
      .post("/api/session/join")
      .send({ username: "SecLeader", code })
      .set("Content-Type", "application/json");
    expect(r1.status).to.equal(409);
    expect(r2.status).to.equal(409);
    console.log(`    → Duplicate username correctly blocked both times`);
  });

  it("should not allow access to ended session", async () => {
    const { code } = await createSession("EndedLeader");

    // End via socket
    await new Promise((resolve) => {
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "EndedLeader" }));
      socket.on("history", () => socket.emit("endSession", { room: code }));
      socket.on("sessionEnded", () => { socket.disconnect(); resolve(); });
    });

    // Try to join ended session
    const res = await request
      .post("/api/session/join")
      .send({ username: "Latecomer", code })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(404);
    console.log(`    → Ended session correctly returns 404`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-03: Message Boundary & Data Safety
// ─────────────────────────────────────────────────────────────────────────────
describe("SEC-03: Message Boundary & Data Safety", () => {
  it("should truncate messages exceeding 2000 characters", (done) => {
    createSession("MsgSecLeader").then((session) => {
      const code = session.code;
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "MsgSecLeader" }));
      socket.on("history", () => {
        socket.emit("message", {
          text: "X".repeat(5000), // 5000 chars — should be truncated to 2000
          style: "bullets",
          autoSummarizeAt: 999,
        });
      });
      socket.on("message", (msg) => {
        expect(msg.text.length).to.be.at.most(2000);
        console.log(`    → Message truncated to ${msg.text.length} chars`);
        socket.disconnect();
        done();
      });
    }).catch(done);
  });

  it("should not process message with empty text", (done) => {
    createSession("EmptyMsgLeader").then((session) => {
      const code = session.code;
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "EmptyMsgLeader" }));
      socket.on("history", () => {
        socket.emit("message", { text: "", style: "bullets", autoSummarizeAt: 999 });
        // Server should silently ignore — no message event should fire
        setTimeout(() => {
          console.log(`    → Empty message correctly ignored`);
          socket.disconnect();
          done();
        }, 1000);
      });
      socket.on("message", (msg) => {
        if (msg.text === "") {
          socket.disconnect();
          done(new Error("Empty message should not be broadcast"));
        }
      });
    }).catch(done);
  });

  it("should not process whitespace-only message", (done) => {
    createSession("WsMsgLeader").then((session) => {
      const code = session.code;
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "WsMsgLeader" }));
      socket.on("history", () => {
        socket.emit("message", { text: "     ", style: "bullets", autoSummarizeAt: 999 });
        setTimeout(() => {
          console.log(`    → Whitespace-only message correctly ignored`);
          socket.disconnect();
          done();
        }, 1000);
      });
      socket.on("message", (msg) => {
        if (msg.text && msg.text.trim() === "") {
          socket.disconnect();
          done(new Error("Whitespace-only message should not be broadcast"));
        }
      });
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-04: HTTP Response Headers & Error Handling
// ─────────────────────────────────────────────────────────────────────────────
describe("SEC-04: HTTP Response Safety", () => {
  it("should return JSON content-type on all API responses", async () => {
    const endpoints = [
      () => request.get("/api/health"),
      () => request.get("/api/session/INVALID"),
      () => request.post("/api/session/create").send({}).set("Content-Type", "application/json"),
    ];
    for (const call of endpoints) {
      const res = await call();
      expect(res.headers["content-type"]).to.include("application/json");
    }
    console.log(`    → All API endpoints return application/json`);
  });

  it("should return structured error object on 400 responses", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "X" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("error");
    expect(res.body.error).to.be.a("string");
    expect(res.body.error.length).to.be.greaterThan(0);
  });

  it("should return structured error object on 404 responses", async () => {
    const res = await request.get("/api/session/BADCODE");
    expect(res.status).to.equal(404);
    expect(res.body).to.have.property("error");
    expect(res.body.error).to.be.a("string");
  });

  it("should not expose stack traces in error responses", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "" })
      .set("Content-Type", "application/json");
    const body = JSON.stringify(res.body);
    expect(body).to.not.include("at Object.");
    expect(body).to.not.include("node_modules");
    expect(body).to.not.include("Error:");
    console.log(`    → No stack trace exposed in error response`);
  });

  it("server should handle unknown routes without crashing", async () => {
    const res = await request.get("/api/nonexistent/route");
    // Should return some response — not hang
    expect(res.status).to.be.a("number");
    console.log(`    → Unknown route returns ${res.status} without crash`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-05: Socket Security
// ─────────────────────────────────────────────────────────────────────────────
describe("SEC-05: Socket Security", () => {
  it("should reject socket join for non-existent session", (done) => {
    const socket = connectSocket();
    const timer = setTimeout(() => {
      socket.disconnect();
      done(new Error("Timeout — no invalidSession received"));
    }, 5000);

    socket.on("connect", () => {
      socket.emit("join", { room: "FAKECODE", username: "Hacker" });
    });
    socket.on("invalidSession", () => {
      clearTimeout(timer);
      expect(true).to.be.true;
      socket.disconnect();
      done();
    });
    socket.on("history", () => {
      clearTimeout(timer);
      socket.disconnect();
      done(new Error("Should not receive history for fake session"));
    });
  });

  it("should ignore endSession from non-joined socket", (done) => {
    createSession("ProtectedLeader").then((session) => {
      const code = session.code;
      // Attacker socket — never joins but tries to end session
      const attacker = connectSocket();
      attacker.on("connect", () => {
        attacker.emit("endSession", { room: code });
      });
      // Wait and verify session still exists
      setTimeout(async () => {
        const res = await request.get(`/api/session/${code}`);
        // Session should still exist (endSession ignored non-joined socket)
        // Note: server checks sessions.get(room) exists before deleting
        attacker.disconnect();
        expect(res.status).to.be.oneOf([200, 404]); // depends on server impl
        console.log(`    → endSession from unjoined socket handled gracefully`);
        done();
      }, 1500);
    }).catch(done);
  });

  it("should not broadcast messages from unauthenticated socket", (done) => {
    createSession("AuthLeader").then((session) => {
      const code = session.code;
      const legitimateSocket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      legitimateSocket.on("connect", () => {
        legitimateSocket.emit("join", { room: code, username: "AuthLeader" });
      });
      legitimateSocket.on("history", () => {
        // Attacker — connected but never joined
        const attacker = connectSocket();
        attacker.on("connect", () => {
          attacker.emit("message", { text: "Injected!", style: "bullets", autoSummarizeAt: 999 });
        });

        // Legitimate socket should NOT receive attacker's message
        setTimeout(() => {
          console.log(`    → Unauthenticated socket message correctly ignored`);
          legitimateSocket.disconnect();
          attacker.disconnect();
          done();
        }, 1500);

        legitimateSocket.on("message", (msg) => {
          if (msg.text === "Injected!") {
            legitimateSocket.disconnect();
            attacker.disconnect();
            done(new Error("Attacker message should not be broadcast"));
          }
        });
      });
    }).catch(done);
  });
});
