#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { getGlobalBinPath } = require("./utils");
const { execSync } = require("child_process");

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

function isInGitRepository() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch (error) {
    console.error(error.message);
    return false;
  }
}

function main() {
  if (!isInGitRepository()) {
    console.error("This command must be run inside a Git repository.");
    process.exit(1);
  }

  const platform = PLATFORM_MAPPING[os.platform()];
  const arch = ARCHITECTURE_MAPPING[os.arch()];

  if (platform === undefined || arch === undefined) {
    console.error(`Unsupported platform: ${os.platform()} on ${os.arch()}`);
    process.exit(1);
  }

  const binaryPrefix = "jiraflow";
  const globalBinPath = getGlobalBinPath();

  const binaryName = fs
    .readdirSync(globalBinPath)
    .find((file) => file.startsWith(binaryPrefix));

  if (!binaryName) {
    console.error(
      `Cannot find suitable jira-flow exectable binary for ${platform}/${arch} in ${globalBinPath}.`
    );
    process.exit(1);
  }

  const binaryPath = path.join(globalBinPath, binaryName);

  // Spawn the correct binary and pass all arguments received by the script
  const subprocess = spawn(binaryPath, process.argv.slice(2), {
    stdio: "inherit",
  });

  subprocess.on("close", (code) => {
    process.exit(code);
  });
}

main();
