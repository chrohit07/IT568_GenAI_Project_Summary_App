// @ts-nocheck
// ✅ Set environment variables BEFORE app loads
process.env.NODE_ENV = "test";
process.env.GROQ_API_KEY = "dummy";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/test";

// ✅ Mock Groq SDK (prevent real API calls)
jest.mock("groq-sdk", () => {
return jest.fn().mockImplementation(() => ({
chat: {
completions: {
create: jest.fn().mockResolvedValue({
choices: [{ message: { content: "Mock summary" } }]
})
}
}
}));
});

// ✅ Mock mongoose (prevent real DB connection)
jest.mock("mongoose", () => ({
connect: jest.fn().mockResolvedValue(true),
model: jest.fn(),
Schema: jest.fn()
}));

// ✅ Prevent server from actually starting (but keep real server for socket.io)
const http = require("http");

jest.spyOn(http.Server.prototype, "listen").mockImplementation(function (port, cb) {
if (cb) cb(); // allow app startup flow
return this;
});

// ✅ Silence console logs to avoid Jest async warnings
jest.spyOn(console, "log").mockImplementation(() => {});

afterAll(() => {
  jest.clearAllMocks();
});
