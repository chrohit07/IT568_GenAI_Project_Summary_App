/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MUTATION TESTS
 * Stryker mutates src/logic.js and runs these Jest tests.
 * A mutant is KILLED if any test fails on the mutated code.
 * ─────────────────────────────────────────────────────────────────────────────
 */
"use strict";

const {
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
} = require("../src/logic");

// ─────────────────────────────────────────────────────────────────────────────
describe("generateCode()", () => {
  test("returns exactly 6 characters", () => {
    for (let i = 0; i < 10; i++) expect(generateCode()).toHaveLength(6);
  });

  test("every character is in VALID_CHARS", () => {
    for (let i = 0; i < 30; i++)
      for (const ch of generateCode())
        expect(VALID_CHARS).toContain(ch);
  });

  test("never contains O", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).not.toContain("O");
  });

  test("never contains 0", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).not.toContain("0");
  });

  test("never contains I", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).not.toContain("I");
  });

  test("never contains 1", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).not.toContain("1");
  });

  test("works with no argument", () => {
    expect(generateCode()).toHaveLength(6);
  });

  test("never returns a code already in sessions map", () => {
    const sessions = new Map();
    for (let i = 0; i < 20; i++) {
      const code = generateCode(sessions);
      expect(sessions.has(code)).toBe(false);
      sessions.set(code, {});
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("validateCreate()", () => {
  test("valid username returns valid:true", () => {
    expect(validateCreate("Rohit").valid).toBe(true);
  });

  test("valid username is trimmed", () => {
    expect(validateCreate("  Rohit  ").username).toBe("Rohit");
  });

  test("exactly 2 chars is valid", () => {
    expect(validateCreate("AB").valid).toBe(true);
  });

  test("1 char returns status 400", () => {
    expect(validateCreate("A").status).toBe(400);
  });

  test("empty string returns status 400", () => {
    expect(validateCreate("").status).toBe(400);
  });

  test("null returns status 400", () => {
    expect(validateCreate(null).status).toBe(400);
  });

  test("undefined returns status 400", () => {
    expect(validateCreate(undefined).status).toBe(400);
  });

  test("whitespace only returns status 400", () => {
    expect(validateCreate("   ").status).toBe(400);
  });

  test("error response has error string", () => {
    const r = validateCreate("X");
    expect(typeof r.error).toBe("string");
    expect(r.error.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("validateJoin()", () => {
  let sessions;
  beforeEach(() => {
    sessions = new Map();
    sessions.set("ABCDEF", { leader: "Alice", members: new Set(["Alice"]) });
  });

  test("valid new user returns valid:true", () => {
    expect(validateJoin(sessions, "Bob", "ABCDEF").valid).toBe(true);
  });

  test("returns correct code", () => {
    expect(validateJoin(sessions, "Bob", "ABCDEF").code).toBe("ABCDEF");
  });

  test("returns correct leader via session object", () => {
    const r = validateJoin(sessions, "Bob", "ABCDEF");
    expect(r.session.leader).toBe("Alice");
  });

  test("lowercase code normalized to uppercase", () => {
    expect(validateJoin(sessions, "Bob", "abcdef").code).toBe("ABCDEF");
  });

  test("username trimmed", () => {
    expect(validateJoin(sessions, "  Bob  ", "ABCDEF").username).toBe("Bob");
  });

  test("non-existent code returns 404", () => {
    expect(validateJoin(sessions, "Bob", "ZZZZZZ").status).toBe(404);
  });

  test("404 error mentions not found", () => {
    expect(validateJoin(sessions, "Bob", "ZZZZZZ").error).toContain("not found");
  });

  test("duplicate username returns 409", () => {
    expect(validateJoin(sessions, "Alice", "ABCDEF").status).toBe(409);
  });

  test("409 error mentions taken", () => {
    expect(validateJoin(sessions, "Alice", "ABCDEF").error).toContain("taken");
  });

  test("1 char username returns 400", () => {
    expect(validateJoin(sessions, "A", "ABCDEF").status).toBe(400);
  });

  test("empty username returns 400", () => {
    expect(validateJoin(sessions, "", "ABCDEF").status).toBe(400);
  });

  test("null username returns 400", () => {
    expect(validateJoin(sessions, null, "ABCDEF").status).toBe(400);
  });

  test("empty code returns 400", () => {
    expect(validateJoin(sessions, "Bob", "").status).toBe(400);
  });

  test("empty code error mentions required", () => {
    expect(validateJoin(sessions, "Bob", "").error).toContain("required");
  });

  test("null code returns 400", () => {
    expect(validateJoin(sessions, "Bob", null).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("parseSummaryJSON()", () => {
  test("parses all fields correctly", () => {
    const r = parseSummaryJSON(JSON.stringify({ title: "T", overview: "O", bullets: ["a"] }));
    expect(r).toEqual({ title: "T", overview: "O", bullets: ["a"] });
  });

  test("missing title defaults to Chat Summary", () => {
    expect(parseSummaryJSON(JSON.stringify({ overview: "O", bullets: [] })).title)
      .toBe("Chat Summary");
  });

  test("missing overview defaults to empty string", () => {
    expect(parseSummaryJSON(JSON.stringify({ title: "T", bullets: [] })).overview)
      .toBe("");
  });

  test("non-array bullets defaults to empty array", () => {
    expect(parseSummaryJSON(JSON.stringify({ title: "T", overview: "O", bullets: "x" })).bullets)
      .toEqual([]);
  });

  test("null bullets defaults to empty array", () => {
    expect(parseSummaryJSON(JSON.stringify({ title: "T", overview: "O", bullets: null })).bullets)
      .toEqual([]);
  });

  test("invalid JSON returns Summary title", () => {
    expect(parseSummaryJSON("not json").title).toBe("Summary");
  });

  test("invalid JSON uses raw string as overview", () => {
    expect(parseSummaryJSON("not json").overview).toBe("not json");
  });

  test("invalid JSON returns empty bullets", () => {
    expect(parseSummaryJSON("not json").bullets).toEqual([]);
  });

  test("empty object returns defaults", () => {
    const r = parseSummaryJSON("{}");
    expect(r.title).toBe("Chat Summary");
    expect(r.overview).toBe("");
    expect(r.bullets).toEqual([]);
  });

  test("valid array bullets are preserved", () => {
    const r = parseSummaryJSON(JSON.stringify({ title: "T", overview: "O", bullets: ["a", "b"] }));
    expect(r.bullets).toEqual(["a", "b"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("buildTranscript()", () => {
  test("formats as username: text", () => {
    expect(buildTranscript([{ username: "A", text: "hi" }])).toBe("A: hi");
  });

  test("joins with newline", () => {
    const t = buildTranscript([{ username: "A", text: "1" }, { username: "B", text: "2" }]);
    expect(t).toBe("A: 1\nB: 2");
  });

  test("limits to last 50 of 60", () => {
    const msgs = Array.from({ length: 60 }, (_, i) => ({ username: "U", text: `${i}` }));
    expect(buildTranscript(msgs).split("\n")).toHaveLength(50);
  });

  test("first line of 60 is index 10", () => {
    const msgs = Array.from({ length: 60 }, (_, i) => ({ username: "U", text: `m${i}` }));
    expect(buildTranscript(msgs).split("\n")[0]).toBe("U: m10");
  });

  test("empty array returns empty string", () => {
    expect(buildTranscript([])).toBe("");
  });

  test("50 messages all kept", () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({ username: "U", text: `${i}` }));
    expect(buildTranscript(msgs).split("\n")).toHaveLength(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getStylePrompt()", () => {
  test("bullets contains bullet", () => { expect(getStylePrompt("bullets")).toContain("bullet"); });
  test("concise contains paragraph", () => { expect(getStylePrompt("concise")).toContain("paragraph"); });
  test("tldr contains TL;DR", () => { expect(getStylePrompt("tldr")).toContain("TL;DR"); });
  test("decisions contains decisions", () => { expect(getStylePrompt("decisions")).toContain("decisions"); });
  test("actions contains action", () => { expect(getStylePrompt("actions")).toContain("action"); });
  test("unknown falls back to bullets", () => { expect(getStylePrompt("unknown")).toContain("bullet"); });
  test("undefined falls back to bullets", () => { expect(getStylePrompt(undefined)).toContain("bullet"); });
  test("five styles are all different", () => {
    const prompts = ["bullets","concise","tldr","decisions","actions"].map(getStylePrompt);
    expect(new Set(prompts).size).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getThreshold()", () => {
  test("undefined returns 15", () => { expect(getThreshold(undefined)).toBe(15); });
  test("0 returns 15", () => { expect(getThreshold(0)).toBe(15); });
  test("5 returns 5", () => { expect(getThreshold(5)).toBe(5); });
  test("30 returns 30", () => { expect(getThreshold(30)).toBe(30); });
  test("default is not 14", () => { expect(getThreshold(undefined)).not.toBe(14); });
  test("default is not 16", () => { expect(getThreshold(undefined)).not.toBe(16); });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getEffectiveThreshold()", () => {
  test("0 returns 999", () => { expect(getEffectiveThreshold(0)).toBe(999); });
  test("10 returns 10", () => { expect(getEffectiveThreshold(10)).toBe(10); });
  test("0 does not return 15", () => { expect(getEffectiveThreshold(0)).not.toBe(15); });
  test("0 does not return 998", () => { expect(getEffectiveThreshold(0)).not.toBe(998); });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("shouldTrigger()", () => {
  test("count equals threshold returns true", () => {
    expect(shouldTrigger({ R: 15 }, "R", 15)).toBe(true);
  });
  test("count exceeds threshold returns true", () => {
    expect(shouldTrigger({ R: 20 }, "R", 15)).toBe(true);
  });
  test("count below threshold returns false", () => {
    expect(shouldTrigger({ R: 14 }, "R", 15)).toBe(false);
  });
  test("missing room treated as 0 returns false", () => {
    expect(shouldTrigger({}, "MISSING", 15)).toBe(false);
  });
  test("count 15 threshold 16 returns false", () => {
    expect(shouldTrigger({ R: 15 }, "R", 16)).toBe(false);
  });
  test("uses correct room key", () => {
    expect(shouldTrigger({ R1: 20, R2: 5 }, "R1", 15)).toBe(true);
    expect(shouldTrigger({ R1: 20, R2: 5 }, "R2", 15)).toBe(false);
  });
  test("threshold 1 count 1 returns true", () => {
    expect(shouldTrigger({ R: 1 }, "R", 1)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("buildHealthResponse()", () => {
  test("ok is always true", () => {
    expect(buildHealthResponse("m", 1).ok).toBe(true);
    expect(buildHealthResponse("m", 0).ok).toBe(true);
  });
  test("readyState 1 returns connected", () => {
    expect(buildHealthResponse("m", 1).db).toBe("connected");
  });
  test("readyState 0 returns disconnected", () => {
    expect(buildHealthResponse("m", 0).db).toBe("disconnected");
  });
  test("readyState 2 returns disconnected", () => {
    expect(buildHealthResponse("m", 2).db).toBe("disconnected");
  });
  test("readyState 1 is not disconnected", () => {
    expect(buildHealthResponse("m", 1).db).not.toBe("disconnected");
  });
  test("model is passed through", () => {
    expect(buildHealthResponse("llama-3.3", 1).model).toBe("llama-3.3");
  });
  test("has ok model db keys", () => {
    const r = buildHealthResponse("m", 1);
    expect(r).toHaveProperty("ok");
    expect(r).toHaveProperty("model");
    expect(r).toHaveProperty("db");
  });
});
