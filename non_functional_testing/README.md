# SummaryBot — Non-Functional Tests

## Framework
- **Mocha** — test runner
- **Chai** — assertions
- **Supertest** — HTTP testing
- **socket.io-client** — WebSocket testing
- **Mochawesome** — HTML report generator

## Test Categories

| File | Category | What it covers |
|---|---|---|
| `performance.test.js` | Performance | Response time, throughput, concurrent users, load |
| `security.test.js` | Security | Input validation, injection, session security, socket safety |
| `reliability.test.js` | Reliability | Error recovery, data consistency, fault tolerance, stability |
| `usability.test.js` | Usability | Error messages, API structure, input flexibility, event format |

## Pre-requisite
**Server must be running before running any tests.**

```bash
# Terminal 1
cd server
node index.js
```

## How to Run

### Install dependencies
```bash
cd non_functional_testing
npm install
```

### Run all tests (single report)
```bash
npm run test:all
```
Report → `non_functional_testing/reports/non-functional-report.html`

### Run individual categories
```bash
npm run test:performance   # → reports/performance-report.html
npm run test:security      # → reports/security-report.html
npm run test:reliability   # → reports/reliability-report.html
npm run test:usability     # → reports/usability-report.html
```

### Run with default mocha (console only)
```bash
npm test
```

## Test Summary

### Performance (PF)
- PF-01: Response time — health <200ms, create/join <500ms
- PF-02: Throughput — 20 sequential + 10 concurrent creates
- PF-03: Concurrent socket users — 5 simultaneous, broadcast to all
- PF-04: Load — 50 rapid calls, no degradation

### Security (SEC)
- SEC-01: SQL injection, NoSQL injection, XSS in username
- SEC-02: Session code guessing, ended session access
- SEC-03: Message length boundary (2000 char limit)
- SEC-04: HTTP response safety, no stack trace exposure
- SEC-05: Socket — unauthenticated message injection

### Reliability (RL)
- RL-01: Server recovery after bad requests and socket drops
- RL-02: Member count consistency, chronological message order
- RL-03: Fault tolerance — malformed JSON, concurrent endSession
- RL-04: Stability over 20+ requests, create/end cycles

### Usability (US)
- US-01: Human-readable error messages with context
- US-02: Consistent response structure across all endpoints
- US-03: Input flexibility — case insensitive codes, whitespace trim
- US-04: Socket event payloads contain all needed fields
- US-05: Behavioural consistency — same name in diff sessions, etc.
