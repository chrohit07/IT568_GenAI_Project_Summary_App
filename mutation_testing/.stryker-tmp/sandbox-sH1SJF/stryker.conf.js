// @ts-nocheck
module.exports = {
mutate: [
  "../server/index.js",
  "../server/routes/**/*.js",
  "../server/services/**/*.js"
],
testRunner: "jest",
reporters: ["html", "clear-text"],
coverageAnalysis: "off",
concurrency: 1,
jest: {
configFile: "jest.config.js"
}
};
