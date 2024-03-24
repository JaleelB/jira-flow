package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	// Hook script content
	hookScript := `
		#!/bin/sh
		# This hook will prepend the JIRA issue key to commit messages

		# Get the name of the current branch
		BRANCH_NAME=$(git symbolic-ref --short HEAD)

		# Define the regex to match the JIRA issue ID
		JIRA_ISSUE_REGEX='[A-Z]+-[0-9]+'

		# Extract the JIRA issue ID from the branch name using the regex
		if [[ $BRANCH_NAME =~ $JIRA_ISSUE_REGEX ]]; then
			JIRA_ISSUE_ID=${BASH_REMATCH[0]}
		else
			# If not found in branch name, use manual input (if provided)
			JIRA_ISSUE_ID='%s'
		fi

		# Prepend the JIRA issue ID to the commit message
		if [[ -n "$JIRA_ISSUE_ID" ]]; then
			sed -i.bak -e "1s/^/$JIRA_ISSUE_ID /" "$1"
		else
			echo "JIRA issue key not provided or extracted. Commit message not modified."
		fi
	`

	// Write the hook script to the hook path
	hookFileName := "pre-commit" 
	hookPath := filepath.Join(config.HookPath, hookFileName)

	err := os.WriteFile(hookPath, []byte(fmt.Sprintf(hookScript, config.JiraKey)), 0755)
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
