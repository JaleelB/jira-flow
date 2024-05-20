#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { getGlobalBinPath } = require("./utils");

function removeBinary(binaryPrefix) {
  const globalBinPath = getGlobalBinPath();

  const binaryName = fs
    .readdirSync(globalBinPath)
    .find((file) => file.startsWith(binaryPrefix));
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
  removeBinary("postco");
}

uninstall();
