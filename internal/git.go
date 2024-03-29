package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// Function to execute git commands
func ExecuteGitCommand(args ...string) (string, error) {
    cmd := exec.Command("git", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return "", err
    }
    return strings.TrimSuffix(string(output), "\n"), nil
}

// Map of OS and architecture to binary names
var binaryNames = map[string]string{
    "windows/amd64": "commitmsg-windows-amd64.exe",
    "darwin/amd64":  "commitmsg-darwin-amd64",
    "linux/amd64":   "commitmsg-linux-amd64",
    "darwin/arm64":  "commitmsg-darwin-arm64",
}

func SetGitHookScript(config *Config) error {
    // Determine the correct binary based on the OS and architecture
    binaryName, ok := binaryNames[runtime.GOOS+"/"+runtime.GOARCH]
    if !ok {
        return fmt.Errorf("unsupported operating system or architecture")
    }

    binaryPath := filepath.Join("bin", binaryName)

    // Check if binary exists
    if _, err := os.Stat(binaryPath); os.IsNotExist(err) {
        return fmt.Errorf("binary does not exist: %v", binaryPath)
    }

    // Path to the Git hook
    hookPath := filepath.Join(config.HookPath, "pre-commit")

    // Prepare the hook script that will execute the binary
    hookScript := fmt.Sprintf("#!/bin/sh\n%s \"$1\"", binaryPath)

    // Write the hook script to the hook path
    err := os.WriteFile(hookPath, []byte(hookScript), 0755)
    if err != nil {
        return fmt.Errorf("os.WriteFile: %v", err)
    }

    fmt.Println("\nGit hook installed successfully.")
    return nil
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

