#!/bin/bash

# Define the path where npm installs global packages
# This can be different on the user's machine, so it's best to check it dynamically
GLOBAL_BIN_PATH=$(npm bin -g)

BINARY_NAMES=("commitmsg-darwin-amd64" "commitmsg-linux-amd64" "commitmsg-windows-amd64.exe" "commitmsg-darwin-arm64")

GIT_HOOKS_DIR=".git/hooks"

for binary_name in "${BINARY_NAMES[@]}"; do

    FULL_BINARY_PATH="${GLOBAL_BIN_PATH}/${binary_name}"
  
    # Ensure the binary is executable
    chmod +x "${FULL_BINARY_PATH}"
    
    # Update the hook script with the correct binary path
    sed -i '' "s|BINARY_PATH_PLACEHOLDER|${FULL_BINARY_PATH}|" "${GIT_HOOKS_DIR}/pre-commit"
done

echo "Post-installation setup complete."
