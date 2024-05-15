#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  return 0;
}

function getGlobalBinPath() {
  try {
    // Check the npm version
    const npmVersion = execSync("npm -v").toString().trim();
    let globalBinPath = "";

    if (compareVersions(npmVersion, "8.19.4") <= 0) {
      // For older or equal versions to 8.19.4
      globalBinPath = execSync("npm bin -g").toString().trim();
    } else {
      // For newer versions after 8.19.4
      const prefix = execSync("npm config --global get prefix")
        .toString()
        .trim();
      globalBinPath = path.join(prefix, "bin");
    }

    return globalBinPath;
  } catch (error) {
    console.error(`Failed to determine global bin path: ${error.message}`);
    throw new Error(
      "Cannot determine the global binary path, installation cannot proceed."
    );
  }
}

function getInstalledVersion(packageName) {
  try {
    const version = execSync(
      `npm list -g ${packageName} --depth=0 | grep ${packageName}`
    )
      .toString()
      .match(/@([0-9.]+)/)[1];
    return version;
  } catch (error) {
    console.error(
      `Failed to determine installed version for ${packageName}: ${error.message}`
    );
    return null;
  }
}

module.exports = {
  getGlobalBinPath,
  getInstalledVersion,
};
