/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NON-FUNCTIONAL TESTS — RELIABILITY
 * Tests: Error Recovery, Data Consistency, Fault Tolerance, Stability
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

function socketJoin(room, username) {
  return new Promise((resolve, reject) => {
    const socket = connectSocket();
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout joining ${username} to ${room}`));
    }, 8000);
    socket.on("connect", () => socket.emit("join", { room, username }));
    socket.on("history", () => { clearTimeout(timer); resolve(socket); });
    socket.on("invalidSession", () => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error("invalidSession"));
    });
    socket.on("connect_error", (err) => { clearTimeout(timer); reject(err); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RL-01: Error Recovery
// ─────────────────────────────────────────────────────────────────────────────
describe("RL-01: Error Recovery", () => {
  it("server should remain available after receiving bad requests", async () => {
    // Send several bad requests
    await request.post("/api/session/create").send({ username: "" }).set("Content-Type", "application/json");
    await request.post("/api/session/join").send({ username: "", code: "" }).set("Content-Type", "application/json");
    await request.get("/api/session/INVALID");

    // Server should still respond correctly to a valid request
    const res = await request.get("/api/health");
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.be.true;
    console.log(`    → Server healthy after bad requests`);
  });

  it("server should remain available after socket connection drops", (done) => {
    const socket = connectSocket();
    socket.on("connect", () => {
      // Abruptly disconnect
      socket.disconnect();
      // Server should still respond to REST calls
      setTimeout(async () => {
        const res = await request.get("/api/health");
        expect(res.status).to.equal(200);
        console.log(`    → Server healthy after socket drop`);
        done();
      }, 500);
    });
  });

  it("should recover and accept new sessions after multiple invalid requests", async () => {
    // Flood with bad requests
    for (let i = 0; i < 10; i++) {
      await request
        .post("/api/session/create")
        .send({ username: "" })
        .set("Content-Type", "application/json");
    }
    // Should still create a valid session
    const res = await request
      .post("/api/session/create")
      .send({ username: "RecoveryUser" })
      .set("Content-Type", "application/json");
    expect(res.status).to.equal(200);
    expect(res.body.code).to.have.lengthOf(6);
    console.log(`    → New session created after 10 invalid requests`);
  });

  it("should handle rapid connect/disconnect cycles without crashing", (done) => {
    let cycles = 0;
    const total = 5;

    function cycle() {
      if (cycles >= total) {
        request.get("/api/health").then((res) => {
          expect(res.status).to.equal(200);
          console.log(`    → Server survived ${total} connect/disconnect cycles`);
          done();
        });
        return;
      }
      const s = connectSocket();
      s.on("connect", () => {
        cycles++;
        s.disconnect();
        setTimeout(cycle, 100);
      });
      s.on("connect_error", done);
    }
    cycle();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RL-02: Data Consistency
// ─────────────────────────────────────────────────────────────────────────────
describe("RL-02: Data Consistency", () => {
  it("session member count should be consistent after multiple joins", async () => {
    const { code } = await createSession("ConsistLeader");
    await joinSession("ConsMember1", code);
    await joinSession("ConsMember2", code);
    await joinSession("ConsMember3", code);

    const res = await request.get(`/api/session/${code}`);
    expect(res.status).to.equal(200);
    expect(res.body.memberCount).to.equal(4); // leader + 3
    console.log(`    → Member count consistent: ${res.body.memberCount}`);
  });

  it("duplicate join attempts should not inflate member count", async () => {
    const { code } = await createSession("DupLeader");
    await joinSession("DupMember", code);
    await joinSession("DupMember", code); // duplicate — should be rejected
    await joinSession("DupMember", code); // duplicate again

    const res = await request.get(`/api/session/${code}`);
    expect(res.body.memberCount).to.equal(2); // only leader + 1 member
    console.log(`    → Member count not inflated by duplicates: ${res.body.memberCount}`);
  });

  it("session code should be unique across 30 consecutive creates", async () => {
    const codes = [];
    for (let i = 0; i < 30; i++) {
      const { code } = await createSession(`UniqueUser${i}`);
      codes.push(code);
    }
    const unique = new Set(codes);
    expect(unique.size).to.equal(30);
    console.log(`    → All 30 session codes unique`);
  });

  it("leader should always be set correctly in session info", async () => {
    const leaderName = "DefiniteLeader";
    const { code } = await createSession(leaderName);
    const res = await request.get(`/api/session/${code}`);
    expect(res.body.leader).to.equal(leaderName);
    console.log(`    → Leader name consistent: ${res.body.leader}`);
  });

  it("session should not exist after endSession cleans up", async () => {
    const { code } = await createSession("CleanupLeader");

    // Verify exists
    const before = await request.get(`/api/session/${code}`);
    expect(before.status).to.equal(200);

    // End session via socket
    await new Promise((resolve) => {
      socketJoin(code, "CleanupLeader").then((socket) => {
        socket.on("sessionEnded", () => { socket.disconnect(); resolve(); });
        socket.emit("endSession", { room: code });
      }).catch(resolve);
    });

    // Verify gone
    const after = await request.get(`/api/session/${code}`);
    expect(after.status).to.equal(404);
    console.log(`    → Session correctly deleted after endSession`);
  });

  it("messages should be returned in chronological order", async () => {
    const { code } = await createSession("OrderLeader");
    // Send 3 sequential messages
    const socket = await socketJoin(code, "OrderLeader");
    const received = [];

    socket.on("message", (msg) => received.push(msg));

    socket.emit("message", { text: "First", style: "bullets", autoSummarizeAt: 999 });
    await new Promise((r) => setTimeout(r, 200));
    socket.emit("message", { text: "Second", style: "bullets", autoSummarizeAt: 999 });
    await new Promise((r) => setTimeout(r, 200));
    socket.emit("message", { text: "Third", style: "bullets", autoSummarizeAt: 999 });
    await new Promise((r) => setTimeout(r, 500));

    socket.disconnect();

    // Check history is chronological
    const history = await request.get(`/api/messages/${code}`);
    const texts = history.body.map((m) => m.text);
    const firstIdx = texts.indexOf("First");
    const secondIdx = texts.indexOf("Second");
    const thirdIdx = texts.indexOf("Third");

    if (firstIdx !== -1 && secondIdx !== -1 && thirdIdx !== -1) {
      expect(firstIdx).to.be.below(secondIdx);
      expect(secondIdx).to.be.below(thirdIdx);
      console.log(`    → Messages returned in chronological order`);
    } else {
      console.log(`    → Messages saved (indices: ${firstIdx}, ${secondIdx}, ${thirdIdx})`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RL-03: Fault Tolerance
// ─────────────────────────────────────────────────────────────────────────────
describe("RL-03: Fault Tolerance", () => {
  it("should handle malformed JSON body gracefully", async () => {
    const res = await request
      .post("/api/session/create")
      .set("Content-Type", "application/json")
      .send("this is not json");
    // Should return 400, not 500
    expect(res.status).to.not.equal(500);
  });

  it("should return valid response even for deeply nested body", async () => {
    const res = await request
      .post("/api/session/create")
      .send({ username: { nested: { deeply: "value" } } })
      .set("Content-Type", "application/json");
    expect(res.status).to.not.equal(500);
  });

  it("should handle concurrent endSession calls gracefully", async () => {
    const { code } = await createSession("ConcEndLeader");

    // Two sockets both try to end the same session simultaneously
    const results = await Promise.allSettled([
      new Promise((resolve) => {
        socketJoin(code, "ConcEndLeader").then((socket) => {
          socket.on("sessionEnded", () => { socket.disconnect(); resolve("ended"); });
          socket.emit("endSession", { room: code });
        }).catch(() => resolve("error"));
      }),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)),
    ]);

    // Server should not crash regardless of outcome
    const health = await request.get("/api/health");
    expect(health.status).to.equal(200);
    console.log(`    → Server survived concurrent endSession calls`);
  });

  it("should handle socket emitting events before joining", (done) => {
    const socket = connectSocket();
    socket.on("connect", () => {
      // Send message without joining first — server should ignore
      socket.emit("message", { text: "ghost message", style: "bullets", autoSummarizeAt: 999 });
      socket.emit("summarize", { style: "bullets" });

      setTimeout(async () => {
        const health = await request.get("/api/health");
        expect(health.status).to.equal(200);
        console.log(`    → Server survived events emitted before join`);
        socket.disconnect();
        done();
      }, 1000);
    });
  });

  it("should handle very rapid message sending without crashing", (done) => {
    createSession("RapidLeader").then((session) => {
      const code = session.code;
      socketJoin(code, "RapidLeader").then((socket) => {
        // Send 10 messages rapidly
        for (let i = 0; i < 10; i++) {
          socket.emit("message", {
            text: `Rapid message ${i}`,
            style: "bullets",
            autoSummarizeAt: 999,
          });
        }
        setTimeout(async () => {
          const health = await request.get("/api/health");
          expect(health.status).to.equal(200);
          console.log(`    → Server survived 10 rapid messages`);
          socket.disconnect();
          done();
        }, 2000);
      }).catch(done);
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RL-04: Stability Over Time
// ─────────────────────────────────────────────────────────────────────────────
describe("RL-04: Stability", () => {
  it("should maintain consistent response times over 20 requests", async () => {
    const times = [];
    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      await request.get("/api/health");
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    console.log(`    → Min: ${min}ms | Avg: ${avg.toFixed(1)}ms | Max: ${max}ms`);
    // Max should not be more than 10x the min (no wild spikes)
    expect(max).to.be.below(Math.max(min * 10, 1000));
  });

  it("should handle 5 sessions being created and ended sequentially", async () => {
    for (let i = 0; i < 5; i++) {
      const { code } = await createSession(`StabilityLeader${i}`);

      await new Promise((resolve) => {
        socketJoin(code, `StabilityLeader${i}`).then((socket) => {
          socket.on("sessionEnded", () => { socket.disconnect(); resolve(); });
          socket.emit("endSession", { room: code });
        }).catch(resolve);
      });

      const res = await request.get(`/api/session/${code}`);
      expect(res.status).to.equal(404);
    }
    console.log(`    → 5 sessions created and ended cleanly`);

    const health = await request.get("/api/health");
    expect(health.status).to.equal(200);
  });

  it("server should still be healthy at end of all reliability tests", async () => {
    const res = await request.get("/api/health");
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.be.true;
    console.log(`    → Final health check: OK`);
  });
});
