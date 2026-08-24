#!/usr/bin/env node
"use strict";

const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, toNamespacedPath } = require("node:path");
const { spawnSync } = require("node:child_process");

const platforms = require("./platforms.json");
const key = `${process.platform}-${process.arch}`;
const target = platforms[key];

if (!target) {
  process.stderr.write(
    `jira-flow: unsupported platform ${process.platform}/${process.arch}. ` +
      `Supported targets: ${Object.keys(platforms).join(", ")}\n`,
  );
  process.exit(1);
}

let packageJson;
try {
  packageJson = require.resolve(`${target.package}/package.json`);
} catch {
  process.stderr.write(
    `jira-flow: native package ${target.package} is missing. ` +
      "Reinstall without omitting optional dependencies.\n",
  );
  process.exit(1);
}

const rootManifest = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
const nativeManifest = JSON.parse(readFileSync(packageJson, "utf8"));
if (rootManifest.version !== nativeManifest.version) {
  process.stderr.write(
    `jira-flow: package version mismatch (${rootManifest.version} vs ${nativeManifest.version}). Reinstall JiraFlow.\n`,
  );
  process.exit(1);
}

const binary = join(dirname(packageJson), "bin", target.binary);
if (!existsSync(binary)) {
  process.stderr.write(
    `jira-flow: native executable is missing from ${target.package}. Reinstall JiraFlow.\n`,
  );
  process.exit(1);
}

const executable = process.platform === "win32" ? toNamespacedPath(binary) : binary;
const child = spawnSync(executable, process.argv.slice(2), {
  stdio: "inherit",
  windowsHide: false,
  env: process.env,
});
if (child.error) {
  process.stderr.write(`jira-flow: failed to launch native executable: ${child.error.message}\n`);
  process.exit(1);
}
if (child.signal) {
  process.stderr.write(`jira-flow: native executable exited on signal ${child.signal}\n`);
  process.exit(1);
}
process.exit(child.status === null ? 1 : child.status);
