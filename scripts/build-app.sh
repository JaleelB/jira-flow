#!/bin/bash

# List of target OS/architectures
platforms=("windows/amd64" "darwin/amd64" "linux/amd64")

# Path to the main application entry point
mainAppPath="../cmd/app"

# Output directory for the binaries
outputDir="../bin"

for platform in "${platforms[@]}"
do
    platform_split=(${platform//\// })
    GOOS=${platform_split[0]}
    GOARCH=${platform_split[1]}
    outputName='jira-flow-'$GOOS'-'$GOARCH
    if [ $GOOS = "windows" ]; then
        outputN ame+='.exe'
    fi

    env GOOS=$GOOS GOARCH=$GOARCH go build -o $outputDir/$outputName $mainAppPath
    if [ $? -ne 0 ]; then
        echo 'An error has occurred! Aborting the script execution...'
        exit 1
    fi
done

echo "Building done."
