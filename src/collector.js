const fs = require("fs");
const path = require("path");

async function collectLogs() {
  const logs = [];

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const summaryPath = process.env.GITHUB_STEP_SUMMARY;
      if (fs.existsSync(summaryPath)) {
        logs.push(fs.readFileSync(summaryPath, "utf8"));
      }
    } catch (e) {
    }
  }

  const workspace = process.env.GITHUB_WORKSPACE || ".";

  const logPatterns = [
    "npm-debug.log",
    "yarn-error.log",
    "pnpm-debug.log",
    ".npm/_logs/*.log",
    "jest.log",
    "test-results.log",
  ];

  for (const pattern of logPatterns) {
    const fullPath = path.join(workspace, pattern);
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, "utf8");
        if (content.length < 100000) {
          logs.push(`=== ${pattern} ===\n${content}`);
        }
      }
    } catch (e) {
    }
  }

  if (process.env.BUILD_LOG) {
    logs.push(process.env.BUILD_LOG);
  }

  if (process.env.TEST_OUTPUT) {
    logs.push(process.env.TEST_OUTPUT);
  }

  if (logs.length === 0) {
    return "No logs collected. Ensure previous steps output logs to standard files.";
  }

  return logs.join("\n\n");
}

module.exports = { collectLogs };
