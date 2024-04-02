package internal

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

var binaryNames = map[string]string{
    "windows/amd64": "commitmsg-windows-amd64.exe",
    "darwin/amd64":  "commitmsg-darwin-amd64",
    "linux/amd64":   "commitmsg-linux-amd64",
    "darwin/arm64":  "commitmsg-darwin-arm64",
}

// Function to execute git commands
func ExecuteGitCommand(args ...string) (string, error) {
    cmd := exec.Command("git", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return "", err
    }
    return strings.TrimSuffix(string(output), "\n"), nil
}

func SetGitHookScript(config *Config) error {
    globalBinPath, err := GetGlobalBinPath()
    if err != nil {
        return fmt.Errorf("getting global bin path: %v", err)
    }

    // Determine the correct binary based on the OS and architecture
    binaryName, ok := binaryNames[runtime.GOOS+"/"+runtime.GOARCH]
    if !ok {
        return fmt.Errorf("unsupported operating system or architecture")
    }

    binaryPath := filepath.Join(globalBinPath, binaryName)

    // Construct the hook script using the actual path to the binary.
    hookScript := fmt.Sprintf("#!/bin/sh\n%s \"$@\"", binaryPath)
    hookPath := filepath.Join(config.HookPath, "commit-msg")

    // Ensure the .git/hooks directory exists.
    if _, err := os.Stat(hookPath); os.IsNotExist(err) {
        os.MkdirAll(filepath.Dir(hookPath), 0755)
    }

    // Write the hook script to the commit-msg hook.
    err = os.WriteFile(hookPath, []byte(hookScript), 0755)
    if err != nil {
        return fmt.Errorf("writing commit-msg hook: %v", err)
    }

    fmt.Println("Git hook script set successfully.")
    return nil
}

func GetGlobalBinPath() (string, error) {
	// Each package manager has its own command to reveal the global bin directory.
	commands := map[string][]string{
		"npm":  {"npm", "root", "-g"},
		"pnpm": {"pnpm", "bin", "-g"},
		"yarn": {"yarn", "global", "bin"},
	}

	for _, cmdParts := range commands {
		// Prepare the command
		cmd := exec.Command(cmdParts[0], cmdParts[1:]...)

		// Capture the output
		var out bytes.Buffer
		cmd.Stdout = &out

		// Execute the command
		err := cmd.Run()
		if err == nil {
			// If the command succeeds, return the trimmed output
			return strings.TrimSpace(out.String()), nil
		}
		// If the command failed, log the error and try the next command
	}

	//If none of the commands succeeded, return an error
	return "", fmt.Errorf("failed to determine the global bin path using npm, pnpm, or yarn")
}


func CheckGitAndHooksDir() error {
    // Check if git is installed
    _, err := exec.LookPath("git")
    if err != nil {
        return fmt.Errorf("git is not installed: %w", err)
    }

    // Check if the script is being run from within a git repository
    gitRoot, err := ExecuteGitCommand("rev-parse", "--show-toplevel")
    if err != nil {
        return fmt.Errorf("this doesn't seem to be a git repository: %w", err)
    }

    // Construct the full path to the .git/hooks directory
    hooksDir := filepath.Join(gitRoot, ".git", "hooks")

    // Test writability by creating and removing a temporary file
    testFilePath := filepath.Join(hooksDir, ".tmp-hook-test")
    testFile, err := os.Create(testFilePath)
    if err != nil {
        return fmt.Errorf("failed to create a file in the hooks directory to test writability: %w", err)
    }
    testFile.Close()

    // Clean up the temporary file
    err = os.Remove(testFilePath)
    if err != nil {
        return fmt.Errorf("failed to remove the temporary file in the hooks directory: %w", err)
    }

    return nil
}

func GetCurrentBranchName() (string, error) {
    branchName, err := ExecuteGitCommand("rev-parse", "--abbrev-ref", "HEAD")
    if err != nil {
        return "", fmt.Errorf("failed to get the current branch name: %w", err)
    }
    return strings.TrimSpace(branchName), nil
}

func (jm *JiraManager) ExtractIssueKeyFromBranchName(branchName string) (string, error) {
	pattern := regexp.MustCompile(jm.Config.BranchPattern)
	matches := pattern.FindStringSubmatch(branchName)
	if len(matches) == 0 {
		return "", fmt.Errorf("no JIRA issue key found in branch name")
	}
	// Assuming the first match is the issue key
	return matches[0], nil
}

