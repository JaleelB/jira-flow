package internal

import (
	"fmt"
	"os"
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

func RemoveGitHooks(hookPath string) error {
    hooks := []string{"commit-msg", "post-checkout"}
    var errors []string

    for _, hook := range hooks {
        hookFile := filepath.Join(hookPath, hook)
        if _, err := os.Stat(hookFile); os.IsNotExist(err) {
            // If the hook file does not exist, skip the removal and continue.
            fmt.Printf("No %s hook to remove.\n", hook)
            continue
        }
        
        if err := os.Remove(hookFile); err != nil {
            // Collect errors instead of returning immediately.
            errors = append(errors, fmt.Sprintf("failed to remove %s: %v", hook, err))
        } else {
            fmt.Printf("Successfully removed %s hook.\n", hook)
        }
    }

    // If there were any errors during the removal process, concatenate them and return as a single error.
    if len(errors) > 0 {
        return fmt.Errorf("errors occurred while removing hooks: %s", strings.Join(errors, ", "))
    }

    return nil
}
