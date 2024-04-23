#!/bin/bash

cd "$(dirname "$0")"/..

echo "Starting the version bump process..."
pnpx version-bump-prompt 

NEW_VERSION=$(node -pe "require('./package.json').version")

git add package.json
git commit -m "chore(release): bump version to ${NEW_VERSION}"

git tag -s "v${NEW_VERSION}" -m "chore(release): tag version v${NEW_VERSION}"

git push && git push --tags

echo "Version bump and release preparations are complete."

