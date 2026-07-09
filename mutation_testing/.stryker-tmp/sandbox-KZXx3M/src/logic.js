// @ts-nocheck
"use strict";

/**
 * logic.js
 * Pure business logic extracted from server/index.js
 * This is what Stryker mutates — no Express, no MongoDB, no Groq
 */
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
const crypto = require("crypto");
const VALID_CHARS = stryMutAct_9fa48("0") ? "" : (stryCov_9fa48("0"), "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");

// ── Session code generator ────────────────────────────────────────────────────
function generateCode(sessions) {
  if (stryMutAct_9fa48("1")) {
    {}
  } else {
    stryCov_9fa48("1");
    if (stryMutAct_9fa48("4") ? false : stryMutAct_9fa48("3") ? true : stryMutAct_9fa48("2") ? sessions : (stryCov_9fa48("2", "3", "4"), !sessions)) sessions = new Map();
    let code = stryMutAct_9fa48("5") ? "Stryker was here!" : (stryCov_9fa48("5"), "");
    for (let i = 0; stryMutAct_9fa48("8") ? i >= 6 : stryMutAct_9fa48("7") ? i <= 6 : stryMutAct_9fa48("6") ? false : (stryCov_9fa48("6", "7", "8"), i < 6); stryMutAct_9fa48("9") ? i-- : (stryCov_9fa48("9"), i++)) {
      if (stryMutAct_9fa48("10")) {
        {}
      } else {
        stryCov_9fa48("10");
        stryMutAct_9fa48("11") ? code -= VALID_CHARS[crypto.randomInt(0, VALID_CHARS.length)] : (stryCov_9fa48("11"), code += VALID_CHARS[crypto.randomInt(0, VALID_CHARS.length)]);
      }
    }
    if (stryMutAct_9fa48("13") ? false : stryMutAct_9fa48("12") ? true : (stryCov_9fa48("12", "13"), sessions.has(code))) return generateCode(sessions);
    return code;
  }
}

// ── Session create validation ─────────────────────────────────────────────────
function validateCreate(username) {
  if (stryMutAct_9fa48("14")) {
    {}
  } else {
    stryCov_9fa48("14");
    if (stryMutAct_9fa48("17") ? !username && username.trim().length < 2 : stryMutAct_9fa48("16") ? false : stryMutAct_9fa48("15") ? true : (stryCov_9fa48("15", "16", "17"), (stryMutAct_9fa48("18") ? username : (stryCov_9fa48("18"), !username)) || (stryMutAct_9fa48("21") ? username.trim().length >= 2 : stryMutAct_9fa48("20") ? username.trim().length <= 2 : stryMutAct_9fa48("19") ? false : (stryCov_9fa48("19", "20", "21"), (stryMutAct_9fa48("22") ? username.length : (stryCov_9fa48("22"), username.trim().length)) < 2)))) {
      if (stryMutAct_9fa48("23")) {
        {}
      } else {
        stryCov_9fa48("23");
        return stryMutAct_9fa48("24") ? {} : (stryCov_9fa48("24"), {
          error: stryMutAct_9fa48("25") ? "" : (stryCov_9fa48("25"), "Name must be at least 2 characters."),
          status: 400
        });
      }
    }
    return stryMutAct_9fa48("26") ? {} : (stryCov_9fa48("26"), {
      valid: stryMutAct_9fa48("27") ? false : (stryCov_9fa48("27"), true),
      username: stryMutAct_9fa48("28") ? username : (stryCov_9fa48("28"), username.trim())
    });
  }
}

// ── Session join validation ───────────────────────────────────────────────────
function validateJoin(sessions, username, code) {
  if (stryMutAct_9fa48("29")) {
    {}
  } else {
    stryCov_9fa48("29");
    const u = stryMutAct_9fa48("30") ? username || "" : (stryCov_9fa48("30"), (stryMutAct_9fa48("33") ? username && "" : stryMutAct_9fa48("32") ? false : stryMutAct_9fa48("31") ? true : (stryCov_9fa48("31", "32", "33"), username || (stryMutAct_9fa48("34") ? "Stryker was here!" : (stryCov_9fa48("34"), "")))).trim());
    const c = stryMutAct_9fa48("36") ? (code || "").toUpperCase() : stryMutAct_9fa48("35") ? (code || "").trim().toLowerCase() : (stryCov_9fa48("35", "36"), (stryMutAct_9fa48("39") ? code && "" : stryMutAct_9fa48("38") ? false : stryMutAct_9fa48("37") ? true : (stryCov_9fa48("37", "38", "39"), code || (stryMutAct_9fa48("40") ? "Stryker was here!" : (stryCov_9fa48("40"), "")))).trim().toUpperCase());
    if (stryMutAct_9fa48("43") ? !u && u.length < 2 : stryMutAct_9fa48("42") ? false : stryMutAct_9fa48("41") ? true : (stryCov_9fa48("41", "42", "43"), (stryMutAct_9fa48("44") ? u : (stryCov_9fa48("44"), !u)) || (stryMutAct_9fa48("47") ? u.length >= 2 : stryMutAct_9fa48("46") ? u.length <= 2 : stryMutAct_9fa48("45") ? false : (stryCov_9fa48("45", "46", "47"), u.length < 2)))) {
      if (stryMutAct_9fa48("48")) {
        {}
      } else {
        stryCov_9fa48("48");
        return stryMutAct_9fa48("49") ? {} : (stryCov_9fa48("49"), {
          error: stryMutAct_9fa48("50") ? "" : (stryCov_9fa48("50"), "Name must be at least 2 characters."),
          status: 400
        });
      }
    }
    if (stryMutAct_9fa48("53") ? false : stryMutAct_9fa48("52") ? true : stryMutAct_9fa48("51") ? c : (stryCov_9fa48("51", "52", "53"), !c)) {
      if (stryMutAct_9fa48("54")) {
        {}
      } else {
        stryCov_9fa48("54");
        return stryMutAct_9fa48("55") ? {} : (stryCov_9fa48("55"), {
          error: stryMutAct_9fa48("56") ? "" : (stryCov_9fa48("56"), "Session code is required."),
          status: 400
        });
      }
    }
    const session = sessions.get(c);
    if (stryMutAct_9fa48("59") ? false : stryMutAct_9fa48("58") ? true : stryMutAct_9fa48("57") ? session : (stryCov_9fa48("57", "58", "59"), !session)) {
      if (stryMutAct_9fa48("60")) {
        {}
      } else {
        stryCov_9fa48("60");
        return stryMutAct_9fa48("61") ? {} : (stryCov_9fa48("61"), {
          error: stryMutAct_9fa48("62") ? "" : (stryCov_9fa48("62"), "Session not found. Check the code and try again."),
          status: 404
        });
      }
    }
    if (stryMutAct_9fa48("64") ? false : stryMutAct_9fa48("63") ? true : (stryCov_9fa48("63", "64"), session.members.has(u))) {
      if (stryMutAct_9fa48("65")) {
        {}
      } else {
        stryCov_9fa48("65");
        return stryMutAct_9fa48("66") ? {} : (stryCov_9fa48("66"), {
          error: stryMutAct_9fa48("67") ? `` : (stryCov_9fa48("67"), `"${u}" is already taken in this session. Please choose a different name.`),
          status: 409
        });
      }
    }
    return stryMutAct_9fa48("68") ? {} : (stryCov_9fa48("68"), {
      valid: stryMutAct_9fa48("69") ? false : (stryCov_9fa48("69"), true),
      username: u,
      code: c,
      session
    });
  }
}

// ── Summary JSON parser ───────────────────────────────────────────────────────
function parseSummaryJSON(raw) {
  if (stryMutAct_9fa48("70")) {
    {}
  } else {
    stryCov_9fa48("70");
    try {
      if (stryMutAct_9fa48("71")) {
        {}
      } else {
        stryCov_9fa48("71");
        const parsed = JSON.parse(raw);
        return stryMutAct_9fa48("72") ? {} : (stryCov_9fa48("72"), {
          title: stryMutAct_9fa48("75") ? parsed.title && "Chat Summary" : stryMutAct_9fa48("74") ? false : stryMutAct_9fa48("73") ? true : (stryCov_9fa48("73", "74", "75"), parsed.title || (stryMutAct_9fa48("76") ? "" : (stryCov_9fa48("76"), "Chat Summary"))),
          overview: stryMutAct_9fa48("79") ? parsed.overview && "" : stryMutAct_9fa48("78") ? false : stryMutAct_9fa48("77") ? true : (stryCov_9fa48("77", "78", "79"), parsed.overview || (stryMutAct_9fa48("80") ? "Stryker was here!" : (stryCov_9fa48("80"), ""))),
          bullets: Array.isArray(parsed.bullets) ? parsed.bullets : stryMutAct_9fa48("81") ? ["Stryker was here"] : (stryCov_9fa48("81"), [])
        });
      }
    } catch {
      if (stryMutAct_9fa48("82")) {
        {}
      } else {
        stryCov_9fa48("82");
        return stryMutAct_9fa48("83") ? {} : (stryCov_9fa48("83"), {
          title: stryMutAct_9fa48("84") ? "" : (stryCov_9fa48("84"), "Summary"),
          overview: raw,
          bullets: stryMutAct_9fa48("85") ? ["Stryker was here"] : (stryCov_9fa48("85"), [])
        });
      }
    }
  }
}

// ── Transcript builder ────────────────────────────────────────────────────────
function buildTranscript(messages) {
  if (stryMutAct_9fa48("86")) {
    {}
  } else {
    stryCov_9fa48("86");
    return stryMutAct_9fa48("87") ? messages.map(m => `${m.username}: ${m.text}`).join("\n") : (stryCov_9fa48("87"), messages.slice(stryMutAct_9fa48("88") ? +50 : (stryCov_9fa48("88"), -50)).map(stryMutAct_9fa48("89") ? () => undefined : (stryCov_9fa48("89"), m => stryMutAct_9fa48("90") ? `` : (stryCov_9fa48("90"), `${m.username}: ${m.text}`))).join(stryMutAct_9fa48("91") ? "" : (stryCov_9fa48("91"), "\n")));
  }
}

// ── Style prompt selector ─────────────────────────────────────────────────────
function getStylePrompt(style) {
  if (stryMutAct_9fa48("92")) {
    {}
  } else {
    stryCov_9fa48("92");
    const styleMap = stryMutAct_9fa48("93") ? {} : (stryCov_9fa48("93"), {
      bullets: stryMutAct_9fa48("94") ? "" : (stryCov_9fa48("94"), "Write a 1-sentence overview then exactly 3-5 concise bullet points."),
      concise: stryMutAct_9fa48("95") ? "" : (stryCov_9fa48("95"), "Write a concise 3-4 sentence paragraph summary."),
      tldr: stryMutAct_9fa48("96") ? "" : (stryCov_9fa48("96"), "Write a single TL;DR sentence under 25 words."),
      decisions: stryMutAct_9fa48("97") ? "" : (stryCov_9fa48("97"), "List only the decisions made in the conversation as bullet points."),
      actions: stryMutAct_9fa48("98") ? "" : (stryCov_9fa48("98"), "List only action items and who is responsible as bullet points.")
    });
    return stryMutAct_9fa48("101") ? styleMap[style] && styleMap.bullets : stryMutAct_9fa48("100") ? false : stryMutAct_9fa48("99") ? true : (stryCov_9fa48("99", "100", "101"), styleMap[style] || styleMap.bullets);
  }
}

// ── Auto-summarize threshold ──────────────────────────────────────────────────
function getThreshold(autoSummarizeAt) {
  if (stryMutAct_9fa48("102")) {
    {}
  } else {
    stryCov_9fa48("102");
    return stryMutAct_9fa48("105") ? autoSummarizeAt && 15 : stryMutAct_9fa48("104") ? false : stryMutAct_9fa48("103") ? true : (stryCov_9fa48("103", "104", "105"), autoSummarizeAt || 15);
  }
}

// ── Effective threshold (0 = off) ─────────────────────────────────────────────
function getEffectiveThreshold(autoAt) {
  if (stryMutAct_9fa48("106")) {
    {}
  } else {
    stryCov_9fa48("106");
    return stryMutAct_9fa48("109") ? autoAt && 999 : stryMutAct_9fa48("108") ? false : stryMutAct_9fa48("107") ? true : (stryCov_9fa48("107", "108", "109"), autoAt || 999);
  }
}

// ── Should trigger summary ────────────────────────────────────────────────────
function shouldTrigger(roomMsgCount, room, threshold) {
  if (stryMutAct_9fa48("110")) {
    {}
  } else {
    stryCov_9fa48("110");
    return stryMutAct_9fa48("114") ? (roomMsgCount[room] || 0) < threshold : stryMutAct_9fa48("113") ? (roomMsgCount[room] || 0) > threshold : stryMutAct_9fa48("112") ? false : stryMutAct_9fa48("111") ? true : (stryCov_9fa48("111", "112", "113", "114"), (stryMutAct_9fa48("117") ? roomMsgCount[room] && 0 : stryMutAct_9fa48("116") ? false : stryMutAct_9fa48("115") ? true : (stryCov_9fa48("115", "116", "117"), roomMsgCount[room] || 0)) >= threshold);
  }
}

// ── Health response builder ───────────────────────────────────────────────────
function buildHealthResponse(model, dbState) {
  if (stryMutAct_9fa48("118")) {
    {}
  } else {
    stryCov_9fa48("118");
    return stryMutAct_9fa48("119") ? {} : (stryCov_9fa48("119"), {
      ok: stryMutAct_9fa48("120") ? false : (stryCov_9fa48("120"), true),
      model,
      db: (stryMutAct_9fa48("123") ? dbState !== 1 : stryMutAct_9fa48("122") ? false : stryMutAct_9fa48("121") ? true : (stryCov_9fa48("121", "122", "123"), dbState === 1)) ? stryMutAct_9fa48("124") ? "" : (stryCov_9fa48("124"), "connected") : stryMutAct_9fa48("125") ? "" : (stryCov_9fa48("125"), "disconnected")
    });
  }
}
module.exports = stryMutAct_9fa48("126") ? {} : (stryCov_9fa48("126"), {
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
  buildHealthResponse
});