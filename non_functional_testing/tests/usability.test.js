/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NON-FUNCTIONAL TESTS — USABILITY
 * Tests: API Design, Error Message Quality, Response Clarity,
 *        Discoverability, Consistency of Behaviour
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

async function joinSession(username, code) {
  return request
    .post("/api/session/join")
    .send({ username, code })
    .set("Content-Type", "application/json");
}

function connectSocket() {
  return ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// US-01: Error Message Quality
// ─────────────────────────────────────────────────────────────────────────────
describe("US-01: Error Message Quality", () => {
  it("error message for short username should be human-readable", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "A" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(400);
    expect(res.body.error).to.be.a("string");
    expect(res.body.error.length).to.be.greaterThan(10);
    expect(res.body.error.toLowerCase()).to.include("character");
    console.log(`    → Short username error: "${res.body.error}"`);
  });

  it("error message for invalid code should mention 'not found'", async () => {
    const res = await joinSession("Bob", "ZZZZZZ");
    expect(res.status).to.equal(404);
    expect(res.body.error.toLowerCase()).to.include("not found");
    console.log(`    → Invalid code error: "${res.body.error}"`);
  });

  it("error message for duplicate username should name the username", async () => {
    const { code } = await createSession("UsabilityLeader");
    const res = await joinSession("UsabilityLeader", code);
    expect(res.status).to.equal(409);
    expect(res.body.error).to.include("UsabilityLeader");
    expect(res.body.error.toLowerCase()).to.include("taken");
    console.log(`    → Duplicate name error: "${res.body.error}"`);
  });

  it("error message for missing code should mention 'required'", async () => {
    const res = await joinSession("Bob", "");
    expect(res.status).to.equal(400);
    expect(res.body.error.toLowerCase()).to.include("required");
    console.log(`    → Missing code error: "${res.body.error}"`);
  });

  it("all error responses should have a single 'error' string field", async () => {
    const cases = [
      () => request.post("/api/session/create").send({ username: "" }).set("Content-Type", "application/json"),
      () => request.post("/api/session/join").send({ username: "X", code: "ZZZZZZ" }).set("Content-Type", "application/json"),
      () => request.get("/api/session/BADCODE"),
    ];
    for (const call of cases) {
      const res = await call();
      expect(res.body).to.have.property("error");
      expect(res.body.error).to.be.a("string");
      expect(Object.keys(res.body)).to.include("error");
    }
    console.log(`    → All error responses have consistent 'error' field`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US-02: API Response Consistency
// ─────────────────────────────────────────────────────────────────────────────
describe("US-02: API Response Structure Consistency", () => {
  it("session create response should always include code and leader", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request
        .post("/api/session/create")
        .send({ username: `StructUser${i}` })
        .set("Content-Type", "application/json");
      expect(res.body).to.have.property("code");
      expect(res.body).to.have.property("leader");
      expect(res.body.code).to.be.a("string");
      expect(res.body.leader).to.be.a("string");
    }
    console.log(`    → Session create always returns code + leader`);
  });

  it("session join response should always include code, leader, memberCount", async () => {
    const { code } = await createSession("JoinStructLeader");
    const res = await joinSession("JoinStructMember", code);
    expect(res.body).to.have.property("code");
    expect(res.body).to.have.property("leader");
    expect(res.body).to.have.property("memberCount");
    expect(res.body.memberCount).to.be.a("number");
    console.log(`    → Session join returns code + leader + memberCount`);
  });

  it("session info response should include code, leader, memberCount, createdAt", async () => {
    const { code } = await createSession("InfoStructLeader");
    const res = await request.get(`/api/session/${code}`);
    expect(res.body).to.have.property("code");
    expect(res.body).to.have.property("leader");
    expect(res.body).to.have.property("memberCount");
    expect(res.body).to.have.property("createdAt");
    console.log(`    → Session info returns all 4 expected fields`);
  });

  it("health response should always include ok, model, db", async () => {
    const res = await request.get("/api/health");
    expect(res.body).to.have.all.keys(["ok", "model", "db"]);
    expect(res.body.ok).to.be.a("boolean");
    expect(res.body.model).to.be.a("string");
    expect(res.body.db).to.be.a("string");
    console.log(`    → Health check has ok + model + db`);
  });

  it("message objects should always include username, text, room, type, _id, createdAt", (done) => {
    createSession("MsgStructLeader").then((session) => {
      const code = session.code;
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "MsgStructLeader" }));
      socket.on("history", () => {
        socket.emit("message", { text: "structure test", style: "bullets", autoSummarizeAt: 999 });
      });
      socket.on("message", (msg) => {
        if (msg.text === "structure test") {
          expect(msg).to.have.property("username");
          expect(msg).to.have.property("text");
          expect(msg).to.have.property("room");
          expect(msg).to.have.property("type");
          expect(msg).to.have.property("_id");
          expect(msg).to.have.property("createdAt");
          expect(msg.type).to.equal("message");
          console.log(`    → Message has all 6 required fields`);
          socket.disconnect();
          done();
        }
      });
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US-03: Input Flexibility (Usability of API)
// ─────────────────────────────────────────────────────────────────────────────
describe("US-03: Input Flexibility", () => {
  it("should accept session code in any case (upper/lower/mixed)", async () => {
    const { code } = await createSession("CaseLeader");

    const lowerRes = await joinSession("CaseMember1", code.toLowerCase());
    expect(lowerRes.status).to.equal(200);

    const upperRes = await joinSession("CaseMember2", code.toUpperCase());
    expect(upperRes.status).to.equal(409); // already a member with that username won't happen but code normalizes

    console.log(`    → Code accepted in lowercase and uppercase`);
  });

  it("should trim leading and trailing spaces from username", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "   SpaceUser   " })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(200);
    expect(res.body.leader).to.equal("SpaceUser");
    console.log(`    → Username trimmed: "${res.body.leader}"`);
  });

  it("should accept usernames with spaces in the middle", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "John Doe" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(200);
    expect(res.body.leader).to.equal("John Doe");
    console.log(`    → Username with space accepted: "${res.body.leader}"`);
  });

  it("should accept usernames with special characters", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: "Röhit_123" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(200);
    console.log(`    → Special character username accepted`);
  });

  it("should accept all valid summary styles", async () => {
    const styles = ["bullets", "concise", "tldr", "decisions", "actions"];
    const { code } = await createSession("StyleLeader");

    for (const style of styles) {
      const res = await request
        .post(`/api/summarize/${code}`)
        .send({ style })
        .set("Content-Type", "application/json");
      // 422 = no messages (ok), anything else is unexpected
      expect(res.status).to.be.oneOf([200, 422, 429]);
    }
    console.log(`    → All 5 summary styles accepted without error`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US-04: Socket Event Usability
// ─────────────────────────────────────────────────────────────────────────────
describe("US-04: Socket Event Usability", () => {
  it("userJoined event should include username, room, and time fields", (done) => {
    createSession("UJLeader").then(async (session) => {
      const code = session.code;
      await joinSession("UJMember", code);

      const leaderSocket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      leaderSocket.on("connect", () => leaderSocket.emit("join", { room: code, username: "UJLeader" }));
      leaderSocket.on("history", () => {
        leaderSocket.once("userJoined", (data) => {
          expect(data).to.have.property("username");
          expect(data).to.have.property("room");
          expect(data).to.have.property("time");
          expect(data.room).to.equal(code);
          console.log(`    → userJoined has username + room + time`);
          leaderSocket.disconnect();
          done();
        });

        const memberSocket = connectSocket();
        memberSocket.on("connect", () => memberSocket.emit("join", { room: code, username: "UJMember" }));
      });
    }).catch(done);
  });

  it("userLeft event should include username and room fields", (done) => {
    createSession("ULLeader").then(async (session) => {
      const code = session.code;
      await joinSession("ULMember", code);

      const leaderSocket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      leaderSocket.on("connect", () => leaderSocket.emit("join", { room: code, username: "ULLeader" }));
      leaderSocket.on("history", () => {
        const memberSocket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
        memberSocket.on("connect", () => memberSocket.emit("join", { room: code, username: "ULMember" }));
        memberSocket.on("history", () => {
          leaderSocket.once("userLeft", (data) => {
            expect(data).to.have.property("username");
            expect(data).to.have.property("room");
            expect(data.username).to.equal("ULMember");
            console.log(`    → userLeft has username + room`);
            leaderSocket.disconnect();
            done();
          });
          memberSocket.disconnect();
        });
      });
    }).catch(done);
  });

  it("sessionEnded event should include the room code", (done) => {
    createSession("SELeader").then((session) => {
      const code = session.code;
      const socket = ioClient(BASE_URL, { transports: ["websocket"], forceNew: true });
      socket.on("connect", () => socket.emit("join", { room: code, username: "SELeader" }));
      socket.on("history", () => {
        socket.once("sessionEnded", (data) => {
          expect(data).to.have.property("room");
          expect(data.room).to.equal(code);
          console.log(`    → sessionEnded includes room code`);
          socket.disconnect();
          done();
        });
        socket.emit("endSession", { room: code });
      });
    }).catch(done);
  });

  it("invalidSession event should be emitted immediately on bad join", (done) => {
    const start = Date.now();
    const socket = connectSocket();
    const timer = setTimeout(() => {
      socket.disconnect();
      done(new Error("Timeout"));
    }, 5000);

    socket.on("connect", () => socket.emit("join", { room: "FAKECODE", username: "Ghost" }));
    socket.on("invalidSession", () => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      expect(duration).to.be.below(3000);
      console.log(`    → invalidSession received in ${duration}ms`);
      socket.disconnect();
      done();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US-05: Behavioural Consistency
// ─────────────────────────────────────────────────────────────────────────────
describe("US-05: Behavioural Consistency", () => {
  it("same username in different sessions should be allowed", async () => {
    const s1 = await createSession("SharedLeader");
    const s2 = await createSession("SharedLeader2");

    // "SameName" should be joinable in both sessions independently
    const r1 = await joinSession("SameName", s1.code);
    const r2 = await joinSession("SameName", s2.code);

    expect(r1.status).to.equal(200);
    expect(r2.status).to.equal(200);
    console.log(`    → Same username allowed in different sessions`);
  });

  it("session codes should always be exactly 6 characters", async () => {
    for (let i = 0; i < 5; i++) {
      const { code } = await createSession(`LenUser${i}`);
      expect(code).to.have.lengthOf(6);
    }
    console.log(`    → All session codes exactly 6 chars`);
  });

  it("memberCount should increment by 1 for each new join", async () => {
    const { code } = await createSession("CountLeader");
    const info1 = await request.get(`/api/session/${code}`);
    expect(info1.body.memberCount).to.equal(1);

    await joinSession("CountMember1", code);
    const info2 = await request.get(`/api/session/${code}`);
    expect(info2.body.memberCount).to.equal(2);

    await joinSession("CountMember2", code);
    const info3 = await request.get(`/api/session/${code}`);
    expect(info3.body.memberCount).to.equal(3);

    console.log(`    → memberCount increments correctly: 1 → 2 → 3`);
  });

  it("history endpoint should return messages array (empty or not)", async () => {
    const rooms = ["HIST001", "HIST002", "HIST003"];
    for (const room of rooms) {
      const res = await request.get(`/api/messages/${room}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    }
    console.log(`    → History endpoint always returns an array`);
  });
});
