package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

func SetGitHookScript(config *Config) error {
    // Use a placeholder for the binary path
    hookScript := `#!/bin/sh
BINARY_PATH_PLACEHOLDER "$1"`

    // Path to the Git hook
    hookPath := filepath.Join(config.HookPath, "pre-commit")

    // Write the hook script to the hook path
    err := os.WriteFile(hookPath, []byte(hookScript), 0755)
    if err != nil {
        return fmt.Errorf("os.WriteFile: %v", err)
    }

    fmt.Println("\nGit hook placeholder script installed successfully.")
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

