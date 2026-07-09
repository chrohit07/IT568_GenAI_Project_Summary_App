/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SYSTEM TESTS — Black-box & Acceptance Level
 * Tests the running server from the outside via HTTP and WebSocket.
 *
 * PRE-REQUISITE: Server must be running on localhost:3001
 *   cd server && node index.js
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use strict";

const { expect } = require("chai");
const supertest = require("supertest");
const { io: ioClient } = require("socket.io-client");

const BASE_URL = "http://localhost:3001";
const request = supertest(BASE_URL);

// ── Helper: create a session via REST ────────────────────────────────────────
async function createSession(username = "TestLeader") {
  const res = await request
    .post("/api/session/create")
    .send({ username })
    .set("Content-Type", "application/json");
  return res;
}

// ── Helper: join a session via REST (registers username in server memory) ────
async function joinSession(username, code) {
  return request
    .post("/api/session/join")
    .send({ username, code })
    .set("Content-Type", "application/json");
}

// ── Helper: connect a socket ─────────────────────────────────────────────────
function connectSocket() {
  return ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
}

// ── Helper: promise-based socket join ────────────────────────────────────────
// Connects a socket, emits join, waits for history confirmation
function socketJoin(room, username) {
  return new Promise((resolve, reject) => {
    const socket = connectSocket();
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout joining ${username} to ${room}`));
    }, 6000);

    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on("invalidSession", () => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error(`invalidSession received for ${room}`));
    });

    socket.on("connect", () => {
      socket.emit("join", { room, username });
    });

    socket.on("history", () => {
      clearTimeout(timer);
      resolve(socket);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-01: Health Check
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-01: Health Check Endpoint", () => {
  it("should return 200 with ok:true", async () => {
    const res = await request.get("/api/health");
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.be.true;
  });

  it("should include model name in health response", async () => {
    const res = await request.get("/api/health");
    expect(res.body).to.have.property("model");
    expect(res.body.model).to.be.a("string");
  });

  it("should include db status in health response", async () => {
    const res = await request.get("/api/health");
    expect(res.body).to.have.property("db");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-02: Session Creation
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-02: POST /api/session/create — Session Creation", () => {
  it("should create a session and return a 6-char code", async () => {
    const res = await createSession("Rohit");
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("code");
    expect(res.body.code).to.have.lengthOf(6);
  });

  it("should return the leader name in response", async () => {
    const res = await createSession("Rohit");
    expect(res.body.leader).to.equal("Rohit");
  });

  it("should generate unique codes for multiple sessions", async () => {
    const r1 = await createSession("Alice");
    const r2 = await createSession("Bob");
    expect(r1.body.code).to.not.equal(r2.body.code);
  });

  it("should return 400 for username shorter than 2 chars", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "A" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property("error");
  });

  it("should return 400 for empty username", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
  });

  it("should return 400 when username is missing entirely", async () => {
    const res = await request
      .post("/api/session/create")
      .send({})
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
  });

  it("should trim whitespace and still create session", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "  Rohit  " })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(200);
    expect(res.body.leader).to.equal("Rohit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-03: Session Join
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-03: POST /api/session/join — Session Join", () => {
  let sessionCode;

  before(async () => {
    const res = await createSession("Leader");
    sessionCode = res.body.code;
  });

  it("should allow a new user to join with valid code", async () => {
    const res = await joinSession("Member1", sessionCode);
    expect(res.status).to.equal(200);
    expect(res.body.code).to.equal(sessionCode);
    expect(res.body.memberCount).to.equal(2);
  });

  it("should return leader name in join response", async () => {
    const res = await joinSession("Member2", sessionCode);
    expect(res.body.leader).to.equal("Leader");
  });

  it("should accept lowercase code and normalize it", async () => {
    const res = await joinSession("Member3", sessionCode.toLowerCase());
    expect(res.status).to.equal(200);
  });

  it("should return 404 for non-existent session code", async () => {
    const res = await joinSession("Bob", "ZZZZZZ");
    expect(res.status).to.equal(404);
    expect(res.body.error).to.include("not found");
  });

  it("should return 409 for duplicate username in same session", async () => {
    const res = await joinSession("Leader", sessionCode);
    expect(res.status).to.equal(409);
    expect(res.body.error).to.include("already taken");
  });

  it("should return 400 for username shorter than 2 chars", async () => {
    const res = await joinSession("X", sessionCode);
    expect(res.status).to.equal(400);
  });

  it("should return 400 when code is empty", async () => {
    const res = await joinSession("Bob", "");
    expect(res.status).to.equal(400);
    expect(res.body.error).to.include("required");
  });

  it("should return 400 when username is missing", async () => {
    const res = await request
      .post("/api/session/join")
      .send({ code: sessionCode })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-04: Session Info
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-04: GET /api/session/:code — Session Info", () => {
  let sessionCode;

  before(async () => {
    const res = await createSession("InfoLeader");
    sessionCode = res.body.code;
  });

  it("should return session info for valid code", async () => {
    const res = await request.get(`/api/session/${sessionCode}`);
    expect(res.status).to.equal(200);
    expect(res.body.leader).to.equal("InfoLeader");
    expect(res.body.memberCount).to.equal(1);
  });

  it("should return 404 for invalid session code", async () => {
    const res = await request.get("/api/session/INVALID");
    expect(res.status).to.equal(404);
  });

  it("should include createdAt in session info", async () => {
    const res = await request.get(`/api/session/${sessionCode}`);
    expect(res.body).to.have.property("createdAt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-05: Message History
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-05: GET /api/messages/:room — Message History", () => {
  it("should return an array for any room", async () => {
    const res = await request.get("/api/messages/TESTROOM");
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an("array");
  });

  it("should return empty array for a room with no messages", async () => {
    const res = await request.get("/api/messages/EMPTYROOM999");
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-06: WebSocket — Join & History
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-06: WebSocket — Join & History", () => {
  let sessionCode;

  before(async () => {
    const res = await createSession("WSLeader");
    sessionCode = res.body.code;
  });

  it("should connect successfully to the server", (done) => {
    const socket = connectSocket();
    socket.on("connect", () => {
      expect(socket.connected).to.be.true;
      socket.disconnect();
      done();
    });
    socket.on("connect_error", (err) => done(err));
  });

  it("should receive history array on join", async () => {
    // WSLeader is already in the session (created it via REST)
    const socket = await socketJoin(sessionCode, "WSLeader");
    socket.disconnect();
  });

  it("should broadcast userJoined event to room when a second user joins", (done) => {
    joinSession("WSMember2", sessionCode).then(() => {

      // Connect leader and wait until confirmed in room
      socketJoin(sessionCode, "WSLeader").then((leaderSocket) => {

        // Attach listener — server now sends userJoined BEFORE history
        // so this listener will never miss the event
        leaderSocket.once("userJoined", ({ username }) => {
          expect(username).to.equal("WSMember2");
          leaderSocket.disconnect();
          done();
        });

        // Connect member — triggers userJoined broadcast to leader
        const memberSocket = connectSocket();
        memberSocket.on("connect", () => {
          memberSocket.emit("join", { room: sessionCode, username: "WSMember2" });
        });

      }).catch(done);
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-07: WebSocket — Real-time Messaging
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-07: WebSocket — Real-time Messaging", () => {
  let sessionCode;

  before(async () => {
    const res = await createSession("MsgLeader");
    sessionCode = res.body.code;
    // Pre-register receiver via REST so server allows socket join
    await joinSession("MsgReceiver", sessionCode);
  });

  it("should broadcast a message to all users in the room", (done) => {
    // Step 1: connect sender first, wait until in room
    socketJoin(sessionCode, "MsgLeader").then((senderSocket) => {

      // Step 2: connect receiver, wait until in room
      socketJoin(sessionCode, "MsgReceiver").then((receiverSocket) => {

        // Step 3: listen on receiver BEFORE sending
        receiverSocket.once("message", (msg) => {
          if (msg.text === "Hello from system test") {
            expect(msg.text).to.equal("Hello from system test");
            expect(msg.username).to.equal("MsgLeader");
            senderSocket.disconnect();
            receiverSocket.disconnect();
            done();
          }
        });

        // Step 4: send from sender
        senderSocket.emit("message", {
          text: "Hello from system test",
          style: "bullets",
          autoSummarizeAt: 999,
        });

      }).catch(done);
    }).catch(done);
  });

  it("should persist message with correct room and type fields", (done) => {
    socketJoin(sessionCode, "MsgLeader").then((socket) => {
      socket.on("message", (msg) => {
        if (msg.text === "Persistence test") {
          expect(msg.room).to.equal(sessionCode);
          expect(msg.type).to.equal("message");
          expect(msg).to.have.property("_id");
          expect(msg).to.have.property("createdAt");
          socket.disconnect();
          done();
        }
      });
      socket.emit("message", {
        text: "Persistence test",
        style: "bullets",
        autoSummarizeAt: 999,
      });
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-08: WebSocket — Invalid Session Rejection
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-08: WebSocket — Invalid Session Rejection", () => {
  it("should emit invalidSession when joining a non-existent room", (done) => {
    const socket = connectSocket();
    const timer = setTimeout(() => {
      socket.disconnect();
      done(new Error("Timeout — invalidSession never received"));
    }, 5000);

    socket.on("connect", () => {
      socket.emit("join", { room: "ZZZZZZ", username: "Ghost" });
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
      done(new Error("Should NOT receive history for invalid session"));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-09: WebSocket — End Session
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-09: WebSocket — End Session", () => {
  it("should broadcast sessionEnded to all clients when leader ends session", (done) => {
    createSession("EndLeader").then(async (res) => {
      const code = res.body.code;
      // Pre-register member via REST
      await joinSession("EndMember", code);

      // Step 1: connect leader first
      socketJoin(code, "EndLeader").then((leaderSocket) => {

        // Step 2: connect member second
        socketJoin(code, "EndMember").then((memberSocket) => {

          // Step 3: listen on member BEFORE leader fires endSession
          memberSocket.once("sessionEnded", ({ room }) => {
            expect(room).to.equal(code);
            leaderSocket.disconnect();
            memberSocket.disconnect();
            done();
          });

          // Step 4: leader ends session
          leaderSocket.emit("endSession", { room: code });

        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it("should remove session from store after endSession", async () => {
    const res = await createSession("CleanLeader");
    const code = res.body.code;

    const before = await request.get(`/api/session/${code}`);
    expect(before.status).to.equal(200);

    await new Promise((resolve, reject) => {
      socketJoin(code, "CleanLeader").then((socket) => {
        socket.on("sessionEnded", () => {
          socket.disconnect();
          resolve();
        });
        socket.emit("endSession", { room: code });
      }).catch(reject);
    });

    const after = await request.get(`/api/session/${code}`);
    expect(after.status).to.equal(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10: WebSocket — User Disconnect
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-10: WebSocket — User Disconnect", () => {
  it("should broadcast userLeft when a member disconnects", (done) => {
    createSession("DiscoLeader").then(async (res) => {
      const code = res.body.code;
      // Pre-register member via REST
      await joinSession("DiscoMember", code);

      // Step 1: connect leader first, wait until in room
      socketJoin(code, "DiscoLeader").then((leaderSocket) => {

        // Step 2: connect member second, wait until in room
        socketJoin(code, "DiscoMember").then((memberSocket) => {

          // Step 3: listen on leader BEFORE disconnecting member
          leaderSocket.once("userLeft", ({ username }) => {
            if (username === "DiscoMember") {
              expect(username).to.equal("DiscoMember");
              leaderSocket.disconnect();
              done();
            }
          });

          // Step 4: disconnect member — server broadcasts userLeft
          memberSocket.disconnect();

        }).catch(done);
      }).catch(done);
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-11: Summarize REST fallback
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-11: POST /api/summarize/:room — Summarize Fallback", () => {
  it("should return 422 when there are no messages to summarize", async () => {
    const res = await request
      .post("/api/summarize/EMPTYROOM000")
      .send({ style: "bullets" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(422);
    expect(res.body.error).to.include("No messages");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-12: Content-Type & Response Format
// ─────────────────────────────────────────────────────────────────────────────
describe("AC-12: API Content-Type & Response Format", () => {
  it("should return JSON content-type from /api/health", async () => {
    const res = await request.get("/api/health");
    expect(res.headers["content-type"]).to.include("application/json");
  });

  it("should return JSON content-type from /api/session/create", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "TypeTest" })
      .set("Content-Type", "application/json");
    expect(res.headers["content-type"]).to.include("application/json");
  });

  it("should return JSON error body for 404 session", async () => {
    const res = await request.get("/api/session/BADCODE");
    expect(res.status).to.equal(404);
    expect(res.body).to.have.property("error");
    expect(res.body.error).to.be.a("string");
  });
});
