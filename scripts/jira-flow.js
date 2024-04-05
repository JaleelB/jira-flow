#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

const ARCHITECTURE_MAPPING = {
  x64: "amd64",
  arm64: "arm64",
  ia32: "386",
};

const PLATFORM_MAPPING = {
  darwin: "darwin",
  win32: "windows",
  linux: "linux",
  freebsd: "freebsd",
};

const platform = PLATFORM_MAPPING[os.platform()];
const arch = ARCHITECTURE_MAPPING[os.arch()];

console.log(`Running on ${platform} ${arch}`);

if (platform === undefined || arch === undefined) {
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
