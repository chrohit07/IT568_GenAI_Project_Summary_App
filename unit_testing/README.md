# SummaryBot — Unit Tests (White-box)

## Framework
- **Mocha** — test runner
- **Chai** — assertions
- **Sinon** — stubs/mocks
- **nyc (Istanbul)** — code coverage
- **Mochawesome** — HTML report generator

## What is tested (White-box)
All internal logic is tested in isolation — no server, no database, no network needed.

| Test Suite | What it covers |
|---|---|
| `generateCode()` | Length, charset, uniqueness, collision retry |
| `createSession()` | Validation, storage, leader assignment, timestamps |
| `joinSession()` | Valid join, 404, 409 duplicate name, 400 bad input |
| `parseSummaryResponse()` | Valid JSON, missing fields, invalid JSON fallback |
| Session memory management | Delete, member removal, reuse after leave |
| Auto-summarize threshold | Counter logic, reset, default/custom thresholds |

## How to run

### 1. Install dependencies
```bash
cd unit_testing
npm install
```

### 2. Run tests with coverage report
```bash
npm test
```

### 3. View reports
- **HTML Test Report** → `unit_testing/reports/unit-test-report.html`
- **Coverage Report** → `unit_testing/reports/coverage/index.html`

Open either file directly in your browser.

## Coverage target
- **100% branch coverage** of all pure logic functions
- All error paths, happy paths, and edge cases covered
