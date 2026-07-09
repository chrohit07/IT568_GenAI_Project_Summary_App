const BASE = "http://localhost:5173";

function mockSocketAndJoin(code = "TEST12", leader = "Leader") {
  cy.intercept("POST", "/api/session/join", {
    statusCode: 200,
    body: { code, leader, memberCount: 2 },
  }).as("joinApi");
  cy.intercept("GET", "**/socket.io/**", { statusCode: 200, body: {} });
  cy.intercept("POST", "**/socket.io/**", { statusCode: 200, body: {} });
}

function joinSession(username = "Tirth", code = "TEST12") {
  cy.get('[data-testid="join-session-btn"]').click();
  cy.get('[data-testid="username-input"]').type(username);
  cy.get('[data-testid="session-code-input"]').type(code);
  cy.get('[data-testid="join-submit-btn"]').click();
  cy.wait("@joinApi");
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Landing Page
// ═══════════════════════════════════════════════════════════════════════════
describe("Landing Page", () => {
  beforeEach(() => cy.visit(BASE));

  it("TC-01: displays app branding and tagline", () => {
    cy.contains("SummaryBot").should("be.visible");
    cy.contains("Real-time chat with AI-powered summarization").should(
      "be.visible",
    );
  });

  it("TC-02: shows Create Session and Join Session buttons", () => {
    cy.get('[data-testid="create-session-btn"]').should("be.visible");
    cy.get('[data-testid="join-session-btn"]').should("be.visible");
  });

  it("TC-03: Create Session button shows Leader badge", () => {
    cy.get('[data-testid="create-session-btn"]').within(() => {
      cy.contains("Leader").should("exist");
    });
  });

  it("TC-04: Join Session button shows Member badge", () => {
    cy.get('[data-testid="join-session-btn"]').within(() => {
      cy.contains("Member").should("exist");
    });
  });

  it("TC-05: shows footer text", () => {
    cy.contains("Powered by Groq").should("be.visible");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Create Session Flow
// ═══════════════════════════════════════════════════════════════════════════
describe("Create Session Flow", () => {
  beforeEach(() => cy.visit(BASE));

  it("TC-06: navigates to create view and shows name input", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.contains("Create Session").should("be.visible");
    cy.get('[data-testid="username-input"]').should("be.visible");
    cy.contains("Generate Session Code").should("be.visible");
  });

  it("TC-07: back button returns to landing", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.contains("← Back").click();
    cy.get('[data-testid="create-session-btn"]').should("be.visible");
    cy.get('[data-testid="join-session-btn"]').should("be.visible");
  });

  it("TC-08: shows error for empty name", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.contains("Generate Session Code").click();
    cy.contains("Please enter your name").should("be.visible");
  });

  it("TC-09: shows error for name shorter than 2 characters", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("A");
    cy.contains("Generate Session Code").click();
    cy.contains("Name must be at least 2 characters").should("be.visible");
  });

  it("TC-10: creates session and shows code", () => {
    cy.intercept("POST", "/api/session/create", {
      statusCode: 200,
      body: { code: "ABCD23", leader: "Tirth" },
    }).as("createApi");

    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.contains("Generate Session Code").click();

    cy.wait("@createApi");
    cy.contains("Your session code").should("be.visible");
    cy.contains("ABCD23").should("be.visible");
    cy.contains("Enter Session").should("be.visible");
    cy.contains("Copy").should("be.visible");
  });

  it("TC-11: shows error when server rejects create", () => {
    cy.intercept("POST", "/api/session/create", {
      statusCode: 400,
      body: { error: "Name must be at least 2 characters." },
    }).as("createFail");

    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("AB");
    cy.contains("Generate Session Code").click();

    cy.wait("@createFail");
    cy.contains("Name must be at least 2 characters").should("be.visible");
  });

  it("TC-12: clears error when user starts typing", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.contains("Generate Session Code").click();
    cy.contains("Please enter your name").should("be.visible");

    cy.get('[data-testid="username-input"]').type("T");
    cy.contains("Please enter your name").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Join Session Flow
// ═══════════════════════════════════════════════════════════════════════════
describe("Join Session Flow", () => {
  beforeEach(() => cy.visit(BASE));

  it("TC-13: navigates to join view and shows inputs", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.contains("Join Session").should("be.visible");
    cy.get('[data-testid="username-input"]').should("be.visible");
    cy.get('[data-testid="session-code-input"]').should("be.visible");
    cy.get('[data-testid="join-submit-btn"]').should("exist");
  });

  it("TC-14: back button returns to landing", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.contains("← Back").click();
    cy.get('[data-testid="create-session-btn"]').should("be.visible");
  });

  it("TC-15: join button disabled with empty fields", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="join-submit-btn"]').should("be.disabled");
  });

  it("TC-16: join button disabled with only username", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.get('[data-testid="join-submit-btn"]').should("be.disabled");
  });

  it("TC-17: join button disabled with only session code", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="session-code-input"]').type("TEST12");
    cy.get('[data-testid="join-submit-btn"]').should("be.disabled");
  });

  it("TC-18: join button disabled with short username and short code", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("A");
    cy.get('[data-testid="session-code-input"]').type("AB");
    cy.get('[data-testid="join-submit-btn"]').should("be.disabled");
  });

  it("TC-19: join button enabled with valid inputs", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.get('[data-testid="session-code-input"]').type("TEST12");
    cy.get('[data-testid="join-submit-btn"]').should("not.be.disabled");
  });

  it("TC-20: session code input converts to uppercase", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="session-code-input"]').type("test12");
    cy.get('[data-testid="session-code-input"]').should("have.value", "TEST12");
  });

  it("TC-21: joins session successfully", () => {
    mockSocketAndJoin();
    joinSession();
    cy.contains("SummaryBot").should("exist");
  });

  it("TC-22: shows error for non-existent session", () => {
    cy.intercept("POST", "/api/session/join", {
      statusCode: 404,
      body: { error: "Session not found. Check the code and try again." },
    }).as("joinApi");
    cy.intercept("GET", "**/socket.io/**", { statusCode: 200, body: {} });

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("User");
    cy.get('[data-testid="session-code-input"]').type("WRONG1");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.wait("@joinApi");
    cy.contains("Session not found").should("be.visible");
  });

  it("TC-23: shows error for duplicate name", () => {
    cy.intercept("POST", "/api/session/join", {
      statusCode: 409,
      body: { error: '"Tirth" is too similar to "Tirth" in this session.' },
    }).as("joinApi");
    cy.intercept("GET", "**/socket.io/**", { statusCode: 200, body: {} });

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.get('[data-testid="session-code-input"]').type("TEST12");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.wait("@joinApi");
    cy.contains("too similar").should("be.visible");
  });

  it("TC-24: shows error for similar name (case variation)", () => {
    cy.intercept("POST", "/api/session/join", {
      statusCode: 409,
      body: { error: '"TIRTH" is too similar to "Tirth" in this session.' },
    }).as("joinApi");
    cy.intercept("GET", "**/socket.io/**", { statusCode: 200, body: {} });

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("TIRTH");
    cy.get('[data-testid="session-code-input"]').type("TEST12");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.wait("@joinApi");
    cy.contains("too similar").should("be.visible");
  });

  it("TC-25: clears error when user edits username", () => {
    cy.intercept("POST", "/api/session/join", {
      statusCode: 404,
      body: { error: "Session not found." },
    }).as("joinApi");

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("User");
    cy.get('[data-testid="session-code-input"]').type("WRONG1");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.wait("@joinApi");
    cy.contains("Session not found").should("be.visible");

    cy.get('[data-testid="username-input"]').type("2");
    cy.contains("Session not found").should("not.exist");
  });

  it("TC-26: clears error when user edits session code", () => {
    cy.intercept("POST", "/api/session/join", {
      statusCode: 404,
      body: { error: "Session not found." },
    }).as("joinApi");

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("User");
    cy.get('[data-testid="session-code-input"]').type("WRONG1");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.wait("@joinApi");
    cy.contains("Session not found").should("be.visible");

    cy.get('[data-testid="session-code-input"]').type("A");
    cy.contains("Session not found").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Chat View — UI Elements
// ═══════════════════════════════════════════════════════════════════════════
describe("Chat View UI", () => {
  beforeEach(() => {
    cy.visit(BASE);
    mockSocketAndJoin();
    joinSession();
  });

  it("TC-27: shows topbar with SummaryBot branding", () => {
    cy.contains("SummaryBot").should("be.visible");
  });

  it("TC-28: shows chat input and send button", () => {
    cy.get('[data-testid="chat-input"]').should("exist");
    cy.get('[data-testid="send-btn"]').should("exist");
  });

  it("TC-29: shows summarize button", () => {
    cy.contains("Summarize").should("exist");
  });

  it("TC-30: shows empty feed message", () => {
    cy.contains("No messages yet").should("be.visible");
    cy.contains("SummaryBot is listening").should("be.visible");
  });

  it("TC-31: chat input shows Connecting placeholder when socket not connected", () => {
    cy.get('[data-testid="chat-input"]')
      .should("have.attr", "placeholder", "Connecting…")
      .and("be.disabled");
  });

  it("TC-32: send button disabled when not connected", () => {
    cy.get('[data-testid="send-btn"]').should("be.disabled");
  });

  it("TC-33: can type into chat input (force)", () => {
    cy.get('[data-testid="chat-input"]')
      .type("Hello world", { force: true })
      .should("have.value", "Hello world");
  });

  it("TC-34: sidebar toggle button is visible", () => {
    cy.get("button").contains(/⇤|⇥/).should("exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Chat View — Leader Actions
// ═══════════════════════════════════════════════════════════════════════════
describe("Leader Actions", () => {
  beforeEach(() => {
    cy.visit(BASE);

    cy.intercept("POST", "/api/session/create", {
      statusCode: 200,
      body: { code: "LEAD12", leader: "Leader" },
    }).as("createApi");
    cy.intercept("GET", "**/socket.io/**", { statusCode: 200, body: {} });
    cy.intercept("POST", "**/socket.io/**", { statusCode: 200, body: {} });

    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Leader");
    cy.contains("Generate Session Code").click();
    cy.wait("@createApi");
    cy.contains("Enter Session").click();
  });

  it("TC-35: shows Leader badge in topbar", () => {
    cy.contains("Leader").should("exist");
  });

  it("TC-36: shows End Session button for leader", () => {
    cy.contains("End Session").should("exist");
  });

  it("TC-37: End Session click shows confirmation modal", () => {
    cy.contains("End Session").click();
    cy.contains("End session?").should("be.visible");
    cy.contains("everyone").should("be.visible");
    cy.contains("Cancel").should("be.visible");
  });

  it("TC-38: cancel button in modal dismisses it", () => {
    cy.contains("End Session").click();
    cy.contains("End session?").should("be.visible");
    cy.contains("Cancel").click();
    cy.contains("End session?").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Chat View — Member Actions
// ═══════════════════════════════════════════════════════════════════════════
describe("Member Actions", () => {
  beforeEach(() => {
    cy.visit(BASE);
    mockSocketAndJoin();
    joinSession();
  });

  it("TC-39: shows Exit button for non-leader", () => {
    cy.contains("Exit").should("exist");
  });

  it("TC-40: Exit click shows confirmation modal", () => {
    cy.contains("Exit").click();
    cy.contains("Leave session?").should("be.visible");
    cy.contains("You'll be removed").should("be.visible");
    cy.contains("Cancel").should("be.visible");
    cy.contains("Leave").should("be.visible");
  });

  it("TC-41: cancel button in leave modal dismisses it", () => {
    cy.contains("Exit").click();
    cy.contains("Leave session?").should("be.visible");
    cy.contains("Cancel").click();
    cy.contains("Leave session?").should("not.exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Sidebar
// ═══════════════════════════════════════════════════════════════════════════
describe("Sidebar", () => {
  beforeEach(() => {
    cy.visit(BASE);
    mockSocketAndJoin();
    joinSession();
  });

  it("TC-42: sidebar shows session code with copy button", () => {
    cy.contains("Session Code").should("be.visible");
    cy.contains("TEST12").should("be.visible");
    cy.contains("Copy").should("be.visible");
  });

  it("TC-43: sidebar shows summary style options", () => {
    cy.contains("Summary Style").should("be.visible");
    cy.contains("Key bullets").should("be.visible");
    cy.contains("Short paragraph").should("be.visible");
    cy.contains("TL;DR one-liner").should("be.visible");
    cy.contains("Decisions only").should("be.visible");
    cy.contains("Action items").should("be.visible");
  });

  it("TC-44: sidebar shows Summarize Now button", () => {
    cy.contains("Summarize Now").should("be.visible");
  });

  it("TC-45: sidebar shows Export Summaries PDF button", () => {
    cy.contains("Export Summaries PDF").should("be.visible");
  });

  it("TC-46: sidebar shows user info", () => {
    cy.contains("Tirth").should("be.visible");
  });

  it("TC-47: can select a different summary style", () => {
    cy.contains("Short paragraph").click();
    cy.contains("Short paragraph").should("exist");
  });

  it("TC-48: toggling sidebar open and closed works", () => {
    // Sidebar is open by default at 1280px — close it
    cy.contains("Session Code").should("be.visible");
    cy.get("button").contains("⇥").click();
    cy.contains("Session Code").should("not.exist");

    // Re-open it
    cy.get("button").contains("⇤").click();
    cy.contains("Session Code").should("be.visible");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Input Validation Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
describe("Input Validation Edge Cases", () => {
  beforeEach(() => cy.visit(BASE));

  it("TC-49: username input has maxlength of 32", () => {
    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').should(
      "have.attr",
      "maxLength",
      "32",
    );
  });

  it("TC-50: session code input has maxlength of 8", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="session-code-input"]').should(
      "have.attr",
      "maxLength",
      "8",
    );
  });

  it("TC-51: client-side validation for short code (less than 4 chars)", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("ValidName");
    cy.get('[data-testid="session-code-input"]').type("AB");
    // Button should remain disabled because code < 4 chars
    cy.get('[data-testid="join-submit-btn"]').should("be.disabled");
  });

  it("TC-52: join button enables at exactly 4-char code and 2-char name", () => {
    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("AB");
    cy.get('[data-testid="session-code-input"]').type("ABCD");
    cy.get('[data-testid="join-submit-btn"]').should("not.be.disabled");
  });

  it("TC-53: network error on create shows error message", () => {
    cy.intercept("POST", "/api/session/create", { forceNetworkError: true }).as(
      "createFail",
    );

    cy.get('[data-testid="create-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.contains("Generate Session Code").click();

    cy.contains("Network error", { timeout: 10000 }).should("be.visible");
  });

  it("TC-54: network error on join shows error message", () => {
    cy.intercept("POST", "/api/session/join", { forceNetworkError: true }).as(
      "joinFail",
    );

    cy.get('[data-testid="join-session-btn"]').click();
    cy.get('[data-testid="username-input"]').type("Tirth");
    cy.get('[data-testid="session-code-input"]').type("TEST12");
    cy.get('[data-testid="join-submit-btn"]').click();

    cy.contains("Network error", { timeout: 10000 }).should("be.visible");
  });
});
