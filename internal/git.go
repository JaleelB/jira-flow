package internal

import (
	"fmt"
	"os"
	"os/exec"
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
	// hookPath := fmt.Sprintf("%sprepare-commit-msg", config.HookPath)
	hookPath := "."
	err := os.WriteFile(hookPath, []byte(fmt.Sprintf(hookScript, config.JiraKey)), 0755)
	if err != nil {
		return fmt.Errorf("os.WriteFile: %v", err)
	}

	// Make the hook script executable
	_, err = ExecuteGitCommand("add", "--chmod=+x", hookPath)
	if err != nil {
		return fmt.Errorf("git add --chmod=+x: %v", err)
	}

	_, err = ExecuteGitCommand("update-index", "--add", "--chmod=+x", hookPath)
	if err != nil {
		return fmt.Errorf("git update-index --add --chmod=+x: %v", err)
	}

	fmt.Println("\nGit hook installed successfully.")
	return nil
}
