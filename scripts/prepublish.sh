#!/bin/bash

# Navigate to the root directory of the project
cd "$(dirname "$0")"/..

# Path to the package.json file
PACKAGE_JSON="package.json"

# Use version-bump-prompt to handle versioning and git tasks interactively
echo "Starting the version bump process..."
pnpx version-bump-prompt --commit --tag --push

echo "Version bump and release preparations are complete."
