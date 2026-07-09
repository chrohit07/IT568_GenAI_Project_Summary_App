// @ts-nocheck
// jest.setup.js
// ✅ Set environment variables
process.env.NODE_ENV = "test";

// ✅ No mocks needed — api.test.js hits the LIVE server at localhost:3001
// The server is already running independently with its own DB and Groq setup
// We do NOT mock groq-sdk or mongoose here because we never import index.js

// ✅ Silence console logs
jest.spyOn(console, "log").mockImplementation(() => {});

afterAll(() => {
  jest.clearAllMocks();
});
