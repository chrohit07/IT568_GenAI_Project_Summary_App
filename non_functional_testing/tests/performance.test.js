/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NON-FUNCTIONAL TESTS — PERFORMANCE
 * Tests: Response Time, Throughput, Concurrent Users, Load Testing
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
    }, 10000);
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
// PF-01: Response Time Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("PF-01: Response Time", () => {
  it("health endpoint should respond within 500ms", async () => {
    const start = Date.now();
    const res = await request.get("/api/health");
    const duration = Date.now() - start;
    expect(res.status).to.equal(200);
    expect(duration).to.be.below(500);
    console.log(`    → Health check: ${duration}ms`);
  });

  it("session create should respond within 1000ms", async () => {
    const start = Date.now();
    const res = await request
      .post("/api/session/create")
      .send({ username: "PerfUser" })
      .set("Content-Type", "application/json");
    const duration = Date.now() - start;
    expect(res.status).to.equal(200);
    expect(duration).to.be.below(1000);
    console.log(`    → Session create: ${duration}ms`);
  });

  it("session join should respond within 1000ms", async () => {
    const { code } = await createSession("PerfLeader");
    const start = Date.now();
    const res = await joinSession("PerfMember", code);
    const duration = Date.now() - start;
    expect(res.status).to.equal(200);
    expect(duration).to.be.below(1000);
    console.log(`    → Session join: ${duration}ms`);
  });

  it("session info should respond within 500ms", async () => {
    const { code } = await createSession("InfoPerf");
    const start = Date.now();
    const res = await request.get(`/api/session/${code}`);
    const duration = Date.now() - start;
    expect(res.status).to.equal(200);
    expect(duration).to.be.below(500);
    console.log(`    → Session info: ${duration}ms`);
  });

  it("message history should respond within 3000ms", async () => {
    const start = Date.now();
    const res = await request.get("/api/messages/PERFROOM");
    const duration = Date.now() - start;
    expect(res.status).to.equal(200);
    expect(duration).to.be.below(3000);
    console.log(`    → Message history: ${duration}ms`);
  });

  it("socket connection should establish within 3000ms", (done) => {
    const start = Date.now();
    const socket = connectSocket();
    socket.on("connect", () => {
      const duration = Date.now() - start;
      expect(duration).to.be.below(3000);
      console.log(`    → Socket connect: ${duration}ms`);
      socket.disconnect();
      done();
    });
    socket.on("connect_error", done);
  });

  it("average response time over 10 health requests should be below 1000ms", async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await request.get("/api/health");
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(`    → Avg: ${avg.toFixed(1)}ms | Max: ${max}ms`);
    expect(avg).to.be.below(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PF-02: Throughput Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("PF-02: Throughput", () => {
  it("should handle 20 sequential session creates without errors", async () => {
    const results = [];
    for (let i = 0; i < 20; i++) {
      const res = await request
        .post("/api/session/create")
        .send({ username: `ThroughputUser${i}` })
        .set("Content-Type", "application/json");
      results.push(res.status);
    }
    expect(results.every((s) => s === 200)).to.be.true;
    console.log(`    → 20 session creates: all 200 OK`);
  });

  it("should process 10 concurrent session creates without errors", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      request
        .post("/api/session/create")
        .send({ username: `ConcUser${i}` })
        .set("Content-Type", "application/json")
    );
    const results = await Promise.all(promises);
    const codes = results.map((r) => r.body.code);
    expect(results.every((r) => r.status === 200)).to.be.true;
    expect(new Set(codes).size).to.equal(10);
    console.log(`    → 10 concurrent creates: all unique codes`);
  });

  it("should handle 15 concurrent health checks within 5000ms", async () => {
    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: 15 }, () => request.get("/api/health"))
    );
    const duration = Date.now() - start;
    expect(results.every((r) => r.status === 200)).to.be.true;
    expect(duration).to.be.below(5000);
    console.log(`    → 15 concurrent health checks in ${duration}ms`);
  });

  it("should handle 10 concurrent session joins on same room", async () => {
    const { code } = await createSession("ThroughputLeader");
    for (let i = 0; i < 10; i++) {
      await joinSession(`THMember${i}`, code);
    }
    // Re-join (409 expected — already members, but server must not crash)
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request
          .post("/api/session/join")
          .send({ username: `THMember${i}`, code })
          .set("Content-Type", "application/json")
      )
    );
    results.forEach((r) => expect(r.status).to.be.oneOf([200, 409]));
    console.log(`    → 10 concurrent joins handled without crash`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PF-03: Concurrent Socket Users
// ─────────────────────────────────────────────────────────────────────────────
describe("PF-03: Concurrent Socket Users", () => {
  it("should support 5 simultaneous socket connections", (done) => {
    const sockets = [];
    let connected = 0;
    for (let i = 0; i < 5; i++) {
      const s = connectSocket();
      sockets.push(s);
      s.on("connect", () => {
        connected++;
        if (connected === 5) {
          expect(connected).to.equal(5);
          console.log(`    → 5 simultaneous sockets connected`);
          sockets.forEach((sock) => sock.disconnect());
          done();
        }
      });
      s.on("connect_error", done);
    }
  });

  it("should allow 5 users in the same session room simultaneously", async () => {
    const { code } = await createSession("MultiLeader");
    for (let i = 1; i <= 4; i++) await joinSession(`MultiMember${i}`, code);
    const sockets = await Promise.all([
      socketJoin(code, "MultiLeader"),
      socketJoin(code, "MultiMember1"),
      socketJoin(code, "MultiMember2"),
      socketJoin(code, "MultiMember3"),
      socketJoin(code, "MultiMember4"),
    ]);
    expect(sockets).to.have.lengthOf(5);
    console.log(`    → 5 users in same room simultaneously`);
    sockets.forEach((s) => s.disconnect());
  });

  it("should deliver message to all members when 1 user sends", (done) => {
    createSession("BroadcastLeader").then(async (session) => {
      const code = session.code;
      await joinSession("BcastMember1", code);
      await joinSession("BcastMember2", code);
      await joinSession("BcastMember3", code);

      const leaderSocket = await socketJoin(code, "BroadcastLeader");
      const m1 = await socketJoin(code, "BcastMember1");
      const m2 = await socketJoin(code, "BcastMember2");
      const m3 = await socketJoin(code, "BcastMember3");

      let received = 0;
      const onMsg = (msg) => {
        if (msg.text === "broadcast test") {
          received++;
          if (received === 3) {
            expect(received).to.equal(3);
            console.log(`    → Message delivered to all 3 members`);
            [leaderSocket, m1, m2, m3].forEach((s) => s.disconnect());
            done();
          }
        }
      };
      m1.on("message", onMsg);
      m2.on("message", onMsg);
      m3.on("message", onMsg);

      leaderSocket.emit("message", { text: "broadcast test", style: "bullets", autoSummarizeAt: 999 });
    }).catch(done);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PF-04: Load Testing
// ─────────────────────────────────────────────────────────────────────────────
describe("PF-04: Load Testing", () => {
  it("server should remain responsive after 50 rapid API calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => request.get("/api/health"))
    );
    expect(results.every((r) => r.status === 200)).to.be.true;
    console.log(`    → Server survived 50 rapid API calls`);
  });

  it("should create and immediately query 10 sessions without errors", async () => {
    const sessions = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createSession(`LoadUser${i}`))
    );
    const infoResults = await Promise.all(
      sessions.map((s) => request.get(`/api/session/${s.code}`))
    );
    expect(infoResults.every((r) => r.status === 200)).to.be.true;
    console.log(`    → 10 sessions created and queried successfully`);
  });

  it("response time should not degrade significantly after 30 requests", async () => {
    const firstTimes = [];
    const lastTimes = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await request.get("/api/health");
      firstTimes.push(Date.now() - start);
    }
    for (let i = 0; i < 10; i++) await request.get("/api/health");
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await request.get("/api/health");
      lastTimes.push(Date.now() - start);
    }
    const firstAvg = firstTimes.reduce((a, b) => a + b) / firstTimes.length;
    const lastAvg = lastTimes.reduce((a, b) => a + b) / lastTimes.length;
    console.log(`    → First 10 avg: ${firstAvg.toFixed(1)}ms | Last 10 avg: ${lastAvg.toFixed(1)}ms`);
    expect(lastAvg).to.be.below(firstAvg * 5 + 500);
  });
});
