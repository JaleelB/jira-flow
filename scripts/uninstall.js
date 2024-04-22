#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

function getGlobalBinPath() {
  let globalBinPath;
  try {
    // Attempt to get the global bin path using `npm bin -g`
    globalBinPath = execSync("npm bin -g").toString().trim();
  } catch (error) {
    console.warn(
      "Failed to determine global bin path using `npm bin -g`: ",
      error.message
    );
    try {
      // Fallback to using `npm prefix -g` if the above fails
      globalBinPath = execSync("npm prefix -g").toString().trim() + "/bin";
    } catch (fallbackError) {
      console.error(
        "Failed to determine global bin path using `npm prefix -g`: ",
        fallbackError.message
      );
      throw new Error(
        "Cannot determine the global bin path, uninstallation cannot proceed."
      );
    }
  }
  return globalBinPath;
}

function removeBinary(binaryName) {
  const globalBinPath = getGlobalBinPath();
  const platform = os.platform();
  const arch = os.arch();
  const binaryName = fs
    .readdirSync(binaryPath)
    .find(
      (file) =>
        file.startsWith(binaryPrefix) &&
        file.includes(platform) &&
        file.includes(arch)
    );
  const binaryPath = path.join(globalBinPath, binaryName);

  if (fs.existsSync(binaryPath)) {
    fs.unlinkSync(binaryPath);
    console.log(`Removed ${binaryName} from ${globalBinPath}`);
  } else {
    console.log(`Binary ${binaryName} not found at ${binaryPath}`);
  }
}

function uninstall() {
  removeBinary("jiraflow");
  removeBinary("commitmsg");
}

uninstall();
