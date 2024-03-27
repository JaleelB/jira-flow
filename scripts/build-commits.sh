#!/bin/bash

# Define the output directory for binaries
BIN_DIR="../bin"
mkdir -p $BIN_DIR

# Navigate to the script's directory
cd "$(dirname "$0")"

# Build for Linux
env GOOS=linux GOARCH=amd64 go build -o ${BIN_DIR}/commitmsg-linux commitmsg.go

# Build for macOS
env GOOS=darwin GOARCH=amd64 go build -o ${BIN_DIR}/commitmsg-macos commitmsg.go

# Build for macOS on arm64 (Apple Silicon)
env GOOS=darwin GOARCH=arm64 go build -o ${BIN_DIR}/commitmsg-macos-arm64 commitmsg.go


# Build for Windows
env GOOS=windows GOARCH=amd64 go build -o ${BIN_DIR}/commitmsg-windows.exe commitmsg.go

echo "Binaries compiled to ${BIN_DIR}"
