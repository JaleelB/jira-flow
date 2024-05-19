package internal

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func GetGlobalBinPath() (string, error) {
    npmVersion, err := ExecuteCommand("npm", "-v")
    if err != nil {
        return "", fmt.Errorf("failed to check npm version: %w", err)
    }
    globalBinPath := ""

    if compareVersions(npmVersion, "8.19.4") <= 0 {
        globalBinPath, err = ExecuteCommand("npm", "bin", "-g")
        if err != nil {
            return "", fmt.Errorf("failed to get global bin path using 'npm bin -g': %w", err)
        }
    } else {
        prefix, err := ExecuteCommand("npm", "config", "--global", "get", "prefix")
        if err != nil {
            return "", fmt.Errorf("failed to get npm global prefix: %w", err)
        }
        globalBinPath = filepath.Join(strings.TrimSpace(prefix), "bin")
    }

    return strings.TrimSpace(globalBinPath), nil
}

func compareVersions(version1, version2 string) int {
	v1 := strings.Split(version1, ".")
	v2 := strings.Split(version2, ".")

	for i := 0; i < len(v1) || i < len(v2); i++ {
		var num1, num2 int
		if i < len(v1) {
			num1, _ = strconv.Atoi(v1[i])
		}
		if i < len(v2) {
			num2, _ = strconv.Atoi(v2[i])
		}

		if num1 < num2 {
			return -1
		} else if num1 > num2 {
			return 1
		}
	}

	return 0
}

func ExecuteCommand(command string, args ...string) (string, error) {
	cmd := exec.Command(command, args...)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to execute command: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}