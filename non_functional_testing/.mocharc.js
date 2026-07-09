module.exports = {
  spec: "tests/*.test.js",
  timeout: 60000,
  exit: true,
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "./reports",
    reportFilename: "non-functional-report",
    charts: true,
    inline: true,
    quiet: false,
  },
};
