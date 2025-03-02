#!/bin/bash
# install.sh
set -e

echo "Installing JiraFlow..."

# Determine OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
elif [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
fi

# Download binaries
RELEASE_URL="https://github.com/JaleelB/jira-flow/releases/latest/download"
INSTALL_DIR="/usr/local/bin"

echo "Downloading JiraFlow binaries for $OS-$ARCH..."
curl -L "$RELEASE_URL/jira-flow-$OS-$ARCH" -o jira-flow
curl -L "$RELEASE_URL/commitmsg-$OS-$ARCH" -o commitmsg
curl -L "$RELEASE_URL/postco-$OS-$ARCH" -o postco

# Make binaries executable
chmod +x jira-flow commitmsg postco

# Move to installation directory
echo "Installing to $INSTALL_DIR..."
sudo mv jira-flow commitmsg postco "$INSTALL_DIR/"

echo "JiraFlow installed successfully! Run 'jira-flow init' to get started."
