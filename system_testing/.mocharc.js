module.exports = {
  spec: "tests/system.test.js",
  timeout: 15000,
  exit: true,
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "./reports",
    reportFilename: "system-test-report",
    charts: true,
    inline: true,
    quiet: false,
  },
};
