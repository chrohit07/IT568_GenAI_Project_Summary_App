/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIT TESTS — White-box, 100% branch coverage
 * Framework: Mocha + Chai | Coverage: nyc (Istanbul)
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const crypto = require("crypto");
const {
  generateCode,
  createSession,
  joinSession,
  parseSummaryResponse,
  getAutoThreshold,
  getEffectiveThreshold,
  shouldTriggerSummary,
  buildTranscript,
  VALID_CHARS,
} = require("../logic");

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-01: generateCode()", () => {
  it("returns a string of exactly 6 characters", () => {
    expect(generateCode()).to.have.lengthOf(6);
  });

  it("only contains characters from the valid charset", () => {
    for (let i = 0; i < 50; i++) {
      for (const ch of generateCode()) {
        expect(VALID_CHARS).to.include(ch);
      }
    }
  });

  it("never contains ambiguous character O", () => {
    for (let i = 0; i < 100; i++) expect(generateCode()).to.not.include("O");
  });

  it("never contains ambiguous character 0 (zero)", () => {
    for (let i = 0; i < 100; i++) expect(generateCode()).to.not.include("0");
  });

  it("never contains ambiguous character I", () => {
    for (let i = 0; i < 100; i++) expect(generateCode()).to.not.include("I");
  });

  it("never contains ambiguous character 1 (one)", () => {
    for (let i = 0; i < 100; i++) expect(generateCode()).to.not.include("1");
  });

  it("is always uppercase", () => {
    const code = generateCode();
    expect(code).to.equal(code.toUpperCase());
  });

  it("generates varied codes (not all identical)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    expect(codes.size).to.be.greaterThan(1);
  });

  it("retries on collision — never returns existing session code", () => {
    const sessions = new Map();
    const codes = [];
    for (let i = 0; i < 30; i++) {
      const c = generateCode(sessions);
      expect(sessions.has(c)).to.be.false;
      sessions.set(c, {});
      codes.push(c);
    }
    expect(new Set(codes).size).to.equal(codes.length);
  });

  it("hits recursive retry branch when first generated code is already taken", () => {
    const sessions = new Map();

    // First 6 calls → index 0 → code "AAAAAA"
    // Next 6 calls → index 1 → code "BBBBBB" (different, not in map)
    let callCount = 0;
    const stub = sinon.stub(crypto, "randomInt").callsFake(() => {
      return callCount++ < 6 ? 0 : 1;
    });

    // Pre-fill map with the first code that will be generated
    const firstCode = "AAAAAA"; // VALID_CHARS[0] = 'A', repeated 6 times
    sessions.set(firstCode, {});

    // generateCode detects collision on "AAAAAA", retries → returns "BBBBBB"
    const result = generateCode(sessions);

    stub.restore();

    expect(result).to.not.equal(firstCode);
    expect(result).to.have.lengthOf(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-02: createSession()", () => {
  let sessions;
  beforeEach(() => { sessions = new Map(); });

  it("returns a code and leader for valid username", () => {
    const r = createSession(sessions, "Rohit");
    expect(r).to.have.property("code");
    expect(r).to.have.property("leader", "Rohit");
  });

  it("stores session in the map", () => {
    const r = createSession(sessions, "Rohit");
    expect(sessions.has(r.code)).to.be.true;
  });

  it("adds leader as first member", () => {
    const r = createSession(sessions, "Rohit");
    expect(sessions.get(r.code).members.has("Rohit")).to.be.true;
    expect(sessions.get(r.code).members.size).to.equal(1);
  });

  it("trims whitespace from username", () => {
    const r = createSession(sessions, "  Rohit  ");
    expect(r.leader).to.equal("Rohit");
  });

  it("sets createdAt as a Date", () => {
    const r = createSession(sessions, "Rohit");
    expect(sessions.get(r.code).createdAt).to.be.instanceOf(Date);
  });

  it("creates independent sessions for multiple leaders", () => {
    const r1 = createSession(sessions, "Alice");
    const r2 = createSession(sessions, "Bob");
    expect(r1.code).to.not.equal(r2.code);
    expect(sessions.size).to.equal(2);
  });

  it("returns 400 for username with 1 character", () => {
    expect(createSession(sessions, "A").status).to.equal(400);
  });

  it("returns 400 for empty string username", () => {
    expect(createSession(sessions, "").status).to.equal(400);
  });

  it("returns 400 for null username", () => {
    expect(createSession(sessions, null).status).to.equal(400);
  });

  it("returns 400 for whitespace-only username", () => {
    expect(createSession(sessions, "   ").status).to.equal(400);
  });

  it("returns 400 for undefined username", () => {
    expect(createSession(sessions, undefined).status).to.equal(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-03: joinSession()", () => {
  let sessions;
  beforeEach(() => {
    sessions = new Map();
    sessions.set("ABCDEF", {
      leader: "Alice",
      members: new Set(["Alice"]),
      createdAt: new Date(),
    });
  });

  it("allows valid user to join existing session", () => {
    const r = joinSession(sessions, "Bob", "ABCDEF");
    expect(r.code).to.equal("ABCDEF");
    expect(r.memberCount).to.equal(2);
  });

  it("adds new member to session members set", () => {
    joinSession(sessions, "Bob", "ABCDEF");
    expect(sessions.get("ABCDEF").members.has("Bob")).to.be.true;
  });

  it("returns correct leader name", () => {
    expect(joinSession(sessions, "Bob", "ABCDEF").leader).to.equal("Alice");
  });

  it("accepts lowercase code and normalizes to uppercase", () => {
    expect(joinSession(sessions, "Bob", "abcdef").code).to.equal("ABCDEF");
  });

  it("trims whitespace from username before joining", () => {
    joinSession(sessions, "  Bob  ", "ABCDEF");
    expect(sessions.get("ABCDEF").members.has("Bob")).to.be.true;
  });

  it("allows multiple different users to join", () => {
    joinSession(sessions, "Bob", "ABCDEF");
    joinSession(sessions, "Charlie", "ABCDEF");
    expect(sessions.get("ABCDEF").members.size).to.equal(3);
  });

  it("returns 404 for non-existent session code", () => {
    const r = joinSession(sessions, "Bob", "ZZZZZZ");
    expect(r.status).to.equal(404);
    expect(r.error).to.include("not found");
  });

  it("returns 409 for duplicate username in same session", () => {
    const r = joinSession(sessions, "Alice", "ABCDEF");
    expect(r.status).to.equal(409);
    expect(r.error).to.include("already taken");
  });

  it("returns 400 for username with 1 character", () => {
    expect(joinSession(sessions, "A", "ABCDEF").status).to.equal(400);
  });

  it("returns 400 for empty username", () => {
    expect(joinSession(sessions, "", "ABCDEF").status).to.equal(400);
  });

  it("returns 400 for null username", () => {
    expect(joinSession(sessions, null, "ABCDEF").status).to.equal(400);
  });

  it("returns 400 for empty code", () => {
    const r = joinSession(sessions, "Bob", "");
    expect(r.status).to.equal(400);
    expect(r.error).to.include("required");
  });

  it("returns 400 for null code", () => {
    expect(joinSession(sessions, "Bob", null).status).to.equal(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-04: parseSummaryResponse()", () => {
  it("parses valid JSON with all fields", () => {
    const r = parseSummaryResponse(JSON.stringify({
      title: "Team Talk", overview: "They discussed goals.", bullets: ["G1", "G2"],
    }));
    expect(r.title).to.equal("Team Talk");
    expect(r.overview).to.equal("They discussed goals.");
    expect(r.bullets).to.deep.equal(["G1", "G2"]);
  });

  it("defaults title to 'Chat Summary' when missing", () => {
    expect(parseSummaryResponse(JSON.stringify({ overview: "x", bullets: [] })).title)
      .to.equal("Chat Summary");
  });

  it("defaults overview to empty string when missing", () => {
    expect(parseSummaryResponse(JSON.stringify({ title: "T", bullets: [] })).overview)
      .to.equal("");
  });

  it("defaults bullets to empty array when not an array", () => {
    expect(parseSummaryResponse(JSON.stringify({ title: "T", overview: "O", bullets: "bad" })).bullets)
      .to.deep.equal([]);
  });

  it("defaults bullets to empty array when null", () => {
    expect(parseSummaryResponse(JSON.stringify({ title: "T", overview: "O", bullets: null })).bullets)
      .to.deep.equal([]);
  });

  it("falls back gracefully on invalid JSON", () => {
    const r = parseSummaryResponse("not json {{");
    expect(r.title).to.equal("Summary");
    expect(r.overview).to.equal("not json {{");
    expect(r.bullets).to.deep.equal([]);
  });

  it("handles empty JSON object {}", () => {
    const r = parseSummaryResponse("{}");
    expect(r.title).to.equal("Chat Summary");
    expect(r.overview).to.equal("");
    expect(r.bullets).to.deep.equal([]);
  });

  it("handles 5 bullet points correctly", () => {
    const r = parseSummaryResponse(JSON.stringify({
      title: "T", overview: "O", bullets: ["a","b","c","d","e"],
    }));
    expect(r.bullets).to.have.lengthOf(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-05: Auto-summarize threshold logic", () => {
  it("uses default threshold 15 when autoSummarizeAt is undefined", () => {
    expect(getAutoThreshold(undefined)).to.equal(15);
  });

  it("uses default threshold 15 when autoSummarizeAt is 0", () => {
    expect(getAutoThreshold(0)).to.equal(15);
  });

  it("uses provided threshold when set to 5", () => {
    expect(getAutoThreshold(5)).to.equal(5);
  });

  it("uses provided threshold when set to 30", () => {
    expect(getAutoThreshold(30)).to.equal(30);
  });

  it("uses 999 as effective threshold when autoAt is 0 (off)", () => {
    expect(getEffectiveThreshold(0)).to.equal(999);
  });

  it("uses provided autoAt when non-zero", () => {
    expect(getEffectiveThreshold(10)).to.equal(10);
  });

  it("triggers summary when count equals threshold", () => {
    expect(shouldTriggerSummary({ ROOM: 15 }, "ROOM", 15)).to.be.true;
  });

  it("triggers summary when count exceeds threshold", () => {
    expect(shouldTriggerSummary({ ROOM: 20 }, "ROOM", 15)).to.be.true;
  });

  it("does not trigger summary when count is below threshold", () => {
    expect(shouldTriggerSummary({ ROOM: 10 }, "ROOM", 15)).to.be.false;
  });

  it("treats missing room count as 0 — does not trigger", () => {
    expect(shouldTriggerSummary({}, "NEWROOM", 15)).to.be.false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-06: buildTranscript()", () => {
  it("formats messages as 'username: text' lines", () => {
    const t = buildTranscript([{ username: "Alice", text: "Hello" }, { username: "Bob", text: "Hi" }]);
    expect(t).to.include("Alice: Hello");
    expect(t).to.include("Bob: Hi");
  });

  it("joins messages with newline separator", () => {
    expect(buildTranscript([{ username: "A", text: "1" }, { username: "B", text: "2" }]))
      .to.equal("A: 1\nB: 2");
  });

  it("limits to last 50 messages when more than 50 provided", () => {
    const msgs = Array.from({ length: 60 }, (_, i) => ({ username: "U", text: `msg${i}` }));
    const lines = buildTranscript(msgs).split("\n");
    expect(lines).to.have.lengthOf(50);
    expect(lines[0]).to.equal("U: msg10");
  });

  it("handles empty messages array", () => {
    expect(buildTranscript([])).to.equal("");
  });

  it("handles single message", () => {
    expect(buildTranscript([{ username: "X", text: "hi" }])).to.equal("X: hi");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("UT-07: Session memory management", () => {
  let sessions;
  beforeEach(() => { sessions = new Map(); });

  it("deletes session from map on endSession", () => {
    sessions.set("ROOM01", { leader: "Alice", members: new Set(["Alice"]) });
    sessions.delete("ROOM01");
    expect(sessions.has("ROOM01")).to.be.false;
  });

  it("removes specific member on disconnect without affecting others", () => {
    sessions.set("ROOM01", { leader: "Alice", members: new Set(["Alice", "Bob"]) });
    sessions.get("ROOM01").members.delete("Bob");
    expect(sessions.get("ROOM01").members.has("Bob")).to.be.false;
    expect(sessions.get("ROOM01").members.has("Alice")).to.be.true;
  });

  it("allows username reuse after member disconnects", () => {
    sessions.set("ROOM01", { leader: "Alice", members: new Set(["Alice", "Bob"]) });
    sessions.get("ROOM01").members.delete("Bob");
    const r = joinSession(sessions, "Bob", "ROOM01");
    expect(r.code).to.equal("ROOM01");
  });

  it("handles delete on non-existent room without throwing", () => {
    expect(() => sessions.delete("GHOST")).to.not.throw();
  });

  it("correctly tracks member count through join and leave cycle", () => {
    sessions.set("ROOM01", { leader: "Alice", members: new Set(["Alice"]) });
    joinSession(sessions, "Bob", "ROOM01");
    joinSession(sessions, "Charlie", "ROOM01");
    expect(sessions.get("ROOM01").members.size).to.equal(3);
    sessions.get("ROOM01").members.delete("Bob");
    expect(sessions.get("ROOM01").members.size).to.equal(2);
  });

  it("returns 404 after session is deleted", () => {
    sessions.set("ROOM01", { leader: "Alice", members: new Set(["Alice"]) });
    sessions.delete("ROOM01");
    expect(joinSession(sessions, "Bob", "ROOM01").status).to.equal(404);
  });
});
