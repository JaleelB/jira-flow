const { execSync } = require("child_process");
const path = require("path");

function getGlobalBinPath() {
  try {
    // Check the npm version
    const npmVersion = execSync("npm -v").toString().trim();
    let globalBinPath;

    if (npmVersion >= "6.14.18" && npmVersion <= "8.19.4") {
      // npm 6.x to 8.x uses `npm bin -g`
      globalBinPath = execSync("npm bin -g").toString().trim();
    } else if (npmVersion >= "8.19.5") {
      // Older versions use `npm config get prefix` and append '/bin'
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

module.exports = {
  getGlobalBinPath,
};
