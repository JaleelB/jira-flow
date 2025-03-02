package main

import (
	"fmt"
	"os"

	"github.com/JaleelB/jira-flow/internal"
	"github.com/logrusorgru/aurora"
)

func main() {
	// Get the new branch name
	newBranchName, err := internal.GetCurrentBranchName()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting branch name: %v\n", err)
		os.Exit(0)
	}

	// Skip for main/master branches
	if newBranchName == "main" || newBranchName == "master" {
		fmt.Println("Switched to", newBranchName, "branch")
		os.Exit(0)
	}

	config := internal.NewConfig()
	jiraManager := internal.NewJiraManager(config)

	// Extract JIRA issue key from branch name
	issueKey, err := jiraManager.ExtractIssueKeyFromBranchName(newBranchName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "No JIRA issue key found in branch name\n")
		os.Exit(0)
	}

	if err == nil {
		description := aurora.BrightMagenta(fmt.Sprintf("Switched to branch '%s' with JIRA issue key: %s\n", newBranchName, issueKey))
		fmt.Println(description)
	} else {
		description := aurora.BrightMagenta(fmt.Sprintf("Switched to branch '%s' with no associated JIRA issue key.\n", newBranchName))
		fmt.Println(description)
	}
}
