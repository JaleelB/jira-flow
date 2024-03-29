#!/bin/bash

# List of target OS/architectures
platforms=("windows/amd64" "darwin/amd64" "linux/amd64" "darwin/arm64")

# Path to the main application entry point
mainAppPath="commitmsg.go"

# Output directory for the binaries
outputDir="../bin"
mkdir -p $outputDir

# Navigate to the script's directory
cd "$(dirname "$0")"

for platform in "${platforms[@]}"
do
    platform_split=(${platform//\// })
    GOOS=${platform_split[0]}
    GOARCH=${platform_split[1]}
    outputName='commitmsg-'$GOOS'-'$GOARCH
    if [ $GOOS = "windows" ]; then
        outputName+='.exe'
    fi

    env GOOS=$GOOS GOARCH=$GOARCH go build -o $outputDir/$outputName $mainAppPath
    if [ $? -ne 0 ]; then
        echo 'An error has occurred! Aborting the script execution...'
        exit 1
    fi

    if [ $GOOS != "windows" ]; then
        chmod +x $outputDir/$outputName
    fis
    
done

echo "Binaries compiled to ${outputDir}"
