#!/bin/bash

# Path to the package.json file
PACKAGE_JSON="../package.json"

# Extract the version number from package.json
VERSION=$(node -p "require('../package.json').version")

# Use sed to update the URLs in the package.json file
sed -i '' "s/{{version}}/$VERSION/g" $PACKAGE_JSON

echo "Updated binary URLs with current version in package.json"
