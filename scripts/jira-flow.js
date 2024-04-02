#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

const binaryNames = {
  "win32/x64": "jira-flow-windows-amd64.exe",
  "darwin/x64": "jira-flow-darwin-amd64",
  "linux/x64": "jira-flow-linux-amd64",
  "darwin/arm64": "jira-flow-darwin-arm64",
};

const platformKey = `${os.platform()}/${os.arch()}`;
const binaryName = binaryNames[platformKey];

if (!binaryName) {
  console.error(`Unsupported platform: ${os.platform()} on ${os.arch()}`);
  process.exit(1);
}

const binaryPath = path.join(__dirname, "..", "bin", binaryName);

// Spawn the correct binary and pass all arguments received by the script
const subprocess = spawn(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

subprocess.on("close", (code) => {
  process.exit(code);
});
