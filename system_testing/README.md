# SummaryBot — System Tests (Black-box + Acceptance)

## Framework
- **Mocha** — test runner
- **Chai** — assertions
- **Supertest** — HTTP black-box testing
- **socket.io-client** — WebSocket black-box testing
- **Mochawesome** — HTML report generator

## What is tested (Black-box)
The server is treated as a black box. Tests only use public HTTP and WebSocket APIs.

| Test ID | Type | What it covers |
|---|---|---|
| AC-01 | Acceptance | Health check endpoint |
| AC-02 | Black-box | Session creation — valid and invalid inputs |
| AC-03 | Black-box | Session join — valid, 404, 409 duplicate, 400 bad input |
| AC-04 | Black-box | Session info endpoint |
| AC-05 | Black-box | Message history endpoint |
| AC-06 | Acceptance | WebSocket join and history delivery |
| AC-07 | Acceptance | Real-time message broadcast |
| AC-08 | Acceptance | Invalid session code rejection via socket |
| AC-09 | Acceptance | End session — broadcast + cleanup |
| AC-10 | Acceptance | User disconnect broadcast |
| AC-11 | Black-box | Summarize REST fallback (empty room) |
| AC-12 | Black-box | Content-Type and response format validation |

## Pre-requisite
**The server must be running before you run system tests.**

```bash
# Terminal 1 — start the server
cd server
node index.js
```

## How to run

### 1. Install dependencies
```bash
cd system_testing
npm install
```

### 2. Run tests (console output only)
```bash
npm test
```

### 3. Run tests WITH HTML report
```bash
npm run test:report
```

### 4. View report
- **HTML Test Report** → `system_testing/reports/system-test-report.html`

Open in your browser.

## Notes
- Tests create and clean up their own sessions
- Socket tests use `forceNew: true` so each test gets an isolated connection
- The `endSession` test verifies the session is gone via REST after socket cleanup
