const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function getGlobalBinPath() {
  const commands = ["npm root -g", "pnpm bin -g", "yarn global bin"];

  for (const command of commands) {
    try {
      const globalBinPath = execSync(command).toString().trim();
      if (globalBinPath) {
        return globalBinPath;
      }
    } catch (error) {
      console.warn(`Command failed: ${command}`, error.message);
    }
  }

  throw new Error(
    "Failed to determine the global bin path using npm, pnpm, or yarn."
  );
}

function getBinaryName() {
  const platform = os.platform();
  const arch = os.arch();

  switch (platform) {
    case "darwin":
      return arch === "arm64"
        ? "commitmsg-darwin-arm64"
        : "commitmsg-darwin-amd64";
    case "linux":
      return "commitmsg-linux-amd64";
    case "win32":
      return "commitmsg-windows-amd64.exe";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

const globalBinPath = getGlobalBinPath();
const binaryName = getBinaryName();
const fullBinaryPath = path.join(globalBinPath, binaryName);

// Ensure the binary is executable
if (fs.existsSync(fullBinaryPath)) {
  fs.chmodSync(fullBinaryPath, "755");
  console.log(`Made ${binaryName} executable.`);
} else {
  throw new Error(`Binary not found: ${binaryName}`);
}

const gitHooksDirPath = path.resolve(".git", "hooks");
const preCommitHookPath = path.join(gitHooksDirPath, "pre-commit");

// Update the pre-commit hook script with the correct binary path
if (fs.existsSync(preCommitHookPath)) {
  let hookScriptContent = fs.readFileSync(preCommitHookPath, "utf8");
  hookScriptContent = hookScriptContent.replace(
    /BINARY_PATH_PLACEHOLDER/g,
    fullBinaryPath
  );
  fs.writeFileSync(preCommitHookPath, hookScriptContent, "utf8");
  console.log("Updated pre-commit hook with the binary path.");
} else {
  console.warn("Pre-commit hook not found.");
}
