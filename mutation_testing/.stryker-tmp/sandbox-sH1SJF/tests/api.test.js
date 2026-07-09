// @ts-nocheck
const request = require("supertest");

const BASE_URL = "http://localhost:3001";

describe("Mutation Testing - API", () => {

test("Health API should return OK", async () => {
const res = await request(BASE_URL).get("/api/health");
expect(res.statusCode).toBe(200);
});

test("Reject invalid username", async () => {
const res = await request(BASE_URL)
.post("/api/session/create")
.send({ username: "a" });

expect(res.statusCode).toBe(400);

});

test("Accept valid username", async () => {
const res = await request(BASE_URL)
.post("/api/session/create")
.send({ username: "ValidUser" });

expect(res.statusCode).toBe(200);

});

});