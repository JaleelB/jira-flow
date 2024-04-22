#!/usr/bin/env node
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const architectureMapping = {
  x64: "amd64",
  arm: "arm",
  arm64: "arm64",
  ia32: "386",
};

const platformMapping = {
  darwin: "darwin",
  win32: "windows",
  linux: "linux",
  freebsd: "freebsd",
};

function getGlobalBinPath() {
  return execSync("npm prefix -g").toString().trim();
}

function getBinaries() {
  const version = require("./package.json").version;

  if (!version) {
    console.error("Failed to get version from package.json");
    process.exit(1);
  }

  const platform = platformMapping[os.platform()];
  const arch = architectureMapping[os.arch()];
  const baseUrl =
    "https://github.com/JaleelB/jiraflow/releases/download/v" + version;

  return [
    {
      name: "jiraflow",
      url: `${baseUrl}/jiraflow_${version}_${platform}_${arch}.tar.gz`,
    },
    {
      name: "commitmsg",
      url: `${baseUrl}/commitmsg_${version}_${platform}_${arch}.tar.gz`,
    },
  ];
}

function downloadBinary(url, outputPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      } else {
        reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
      }
    });
    req.on("error", (e) => {
      reject(e);
    });
    req.end();
  });
}

async function verifyAndPlaceBinary(binaryName, binPath, globalBinPath) {
  const filePath = path.join(binPath, binaryName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Downloaded binary does not exist: ${binaryName}`);
  }

  const targetPath = path.join(globalBinPath, binaryName);
  fs.renameSync(filePath, targetPath);
  console.log(`Moved ${binaryName} to ${targetPath}`);

  if (os.platform() !== "win32") {
    fs.chmodSync(targetPath, "755");
    console.log(`Made ${binaryName} executable`);
  }
}

async function install() {
  const binaries = getBinaries();
  const globalBinPath = getGlobalBinPath();
  const binPath = path.join(__dirname, "bin");

  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
  }

  for (const binary of binaries) {
    const outputPath = path.join(binPath, binary.name);
    try {
      console.log(`Downloading ${binary.name} from ${binary.url}...`);
      await downloadBinary(binary.url, outputPath);
      await verifyAndPlaceBinary(binary.name, binPath, globalBinPath);
    } catch (error) {
      console.error(`Failed to install ${binary.name}:`, error);
      process.exit(1);
    }
  }

  console.log("Installation complete.");
}

install();
