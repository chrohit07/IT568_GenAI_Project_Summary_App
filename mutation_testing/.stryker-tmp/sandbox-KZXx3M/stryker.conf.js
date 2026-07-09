// @ts-nocheck
// stryker.conf.js
module.exports = {
  mutate: ["src/logic.js"],

  testRunner: "jest",
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "off",
  concurrency: 1,

  jest: {
    configFile: "jest.config.js",
    enableFindRelatedTests: false,
  },

  htmlReporter: {
    fileName: "reports/mutation/index.html",
  },

  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },

  timeoutMS: 15000,
  timeoutFactor: 2,
  logLevel: "info",
};
