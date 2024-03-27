
#!/bin/bash

cd "$(dirname "$0")"/..

# Path to the package.json file
PACKAGE_JSON="package.json"

# Extract the version number from package.json
VERSION=$(node -p "require('./package.json').version")

# Regular expression to match the version placeholder or any version number
VERSION_REGEX='[0-9]+\.[0-9]+\.[0-9]+|{{version}}'

# Prepare the sed substitution pattern
SED_PATTERN="s|/download/[0-9a-zA-Z\.-]*/|/download/$VERSION/|g"

# Use sed to update the URLs in the package.json file
# sed -i '' "s/{{version}}/$VERSION/g" $PACKAGE_JSON
sed -i '' "$SED_PATTERN" "$PACKAGE_JSON"

echo "Updated binary URLs with current $VERSION in package.json"