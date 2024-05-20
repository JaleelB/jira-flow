#!/usr/bin/env node
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");
const tar = require("tar");
const { getGlobalBinPath } = require("./utils");

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

function validateEnvironment() {
  const platform = os.platform();
  const arch = os.arch();

  if (!platformMapping[platform] || !architectureMapping[arch]) {
    console.error(`Unsupported platform or architecture: ${platform}/${arch}`);
    process.exit(1);
  }
}

function validateURLs(binaries) {
  binaries.forEach((binary) => {
    try {
      new URL(binary.url);
    } catch (error) {
      console.error(`Invalid URL for binary ${binary.name}: ${binary.url}`);
      process.exit(1);
    }
  });
}

function getBinaries(version) {
  const platform = platformMapping[os.platform()];
  const arch = architectureMapping[os.arch()];

  const baseUrl =
    "https://github.com/JaleelB/jira-flow/releases/download/v" + version;

  return [
    {
      name: "jiraflow",
      url: `${baseUrl}/jiraflow_${version}_${platform}_${arch}.tar.gz`,
    },
    {
      name: "commitmsg",
      url: `${baseUrl}/commitmsg_${version}_${platform}_${arch}.tar.gz`,
    },
    {
      name: "postco",
      url: `${baseUrl}/postco_${version}_${platform}_${arch}.tar.gz`,
    },
  ];
}

function downloadAndExtractBinary(url, tempPath) {
  return new Promise((resolve, reject) => {
    const makeRequest = (url) => {
      const req = https.get(url, (res) => {
        if (res.statusCode === 200) {
          console.log(`Starting extraction to ${tempPath}`);
          res
            .pipe(zlib.createGunzip())
            .pipe(tar.extract({ cwd: tempPath, strip: 0 })) // Check if strip is needed
            .on("finish", () => {
              console.log(
                `Extraction finished. Contents of ${tempPath}:`,
                fs.readdirSync(tempPath)
              );
              resolve(tempPath);
            })
            .on("error", (err) => {
              console.error(`Extraction failed: ${err}`);
              reject(err);
            });
        } else if (res.statusCode === 302 || res.statusCode === 301) {
          console.log(
            `Following redirect from ${url} to ${res.headers.location}`
          );
          makeRequest(res.headers.location);
        } else {
          reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
        }
      });

      req.on("error", (err) => {
        console.error(`Request error: ${err}`);
        reject(err);
      });
      req.end();
    };

    makeRequest(url);
  });
}

async function verifyAndPlaceBinary(binaryName, binPath, extractPath) {
  if (os.platform() === "win32") {
    binaryName += ".exe";
  }

  const actualBinaryPath = path.join(extractPath, binaryName);

  if (!actualBinaryPath) {
    // const files = fs.readdirSync(extractPath);
    // console.error("Files in extractPath:", files);
    throw new Error("Binary not found after extraction");
  }

  const finalBinaryPath = path.join(binPath, binaryName);
  fs.renameSync(actualBinaryPath, finalBinaryPath);

  // Set the appropriate permissions for the binary (if not on Windows)
  if (os.platform() !== "win32") {
    fs.chmodSync(finalBinaryPath, "755");
  }
}

async function install(binaries, binPath) {
  if (!binPath) {
    console.error("Failed to determine global bin path");
    process.exit(1);
  }

  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
  }

  for (const binary of binaries) {
    try {
      // a temporary directory for binary extraction
      const tempPath = fs.mkdtempSync(path.join(os.tmpdir(), binary.name));

      const extractPath = await downloadAndExtractBinary(binary.url, tempPath);
      await verifyAndPlaceBinary(binary.name, binPath, extractPath);

      // clean up the temporary directory
      fs.rmdirSync(tempPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to install ${binary.name}:`, error);
      process.exit(1);
    }
  }

  console.log("Installation complete.");
}

function main() {
  validateEnvironment();

  const version = "%%VERSION%%";
  if (!version) {
    console.error("Package version missing");
    process.exit(1);
  }

  const binaries = getBinaries(version);
  validateURLs(binaries);

  const binPath = getGlobalBinPath();
  console.log(`Global binary path: ${binPath}`);

  install(binaries, binPath);
}

main();
