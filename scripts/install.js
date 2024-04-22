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
        "Cannot determine the global bin path, installation cannot proceed."
      );
    }
  }
  return globalBinPath;
}

function getPackageJson() {
  const packageJsonPath = path.join(".", "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.error(
      "Unable to find package.json. " +
        "Please run this script at root of the package you want to be installed"
    );
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
  return packageJson;
}

function getBinaries() {
  const packageJson = getPackageJson();
  const version = packageJson.version;

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

async function verifyAndPlaceBinary(binaryName, binPath) {
  const filePath = path.join(binPath, binaryName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Downloaded binary does not exist: ${binaryName}`);
  }

  const targetPath = binPath;
  fs.renameSync(filePath, targetPath);
  console.log(`Moved ${binaryName} to ${targetPath}`);

  if (os.platform() !== "win32") {
    fs.chmodSync(targetPath, "755");
    console.log(`Made ${binaryName} executable`);
  }
}

async function install() {
  const binaries = getBinaries();
  const binPath = getGlobalBinPath();

  if (!binPath) {
    console.error("Failed to determine global bin path");
    process.exit(1);
  }

  if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
  }

  for (const binary of binaries) {
    const outputPath = path.join(binPath, binary.name);
    try {
      console.log(`Downloading ${binary.name} from ${binary.url}...`);
      await downloadBinary(binary.url, outputPath);
      await verifyAndPlaceBinary(binary.name, binPath);
    } catch (error) {
      console.error(`Failed to install ${binary.name}:`, error);
      process.exit(1);
    }
  }

  console.log("Installation complete.");
}

install();
