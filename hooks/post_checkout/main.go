package main

import (
	"fmt"
	"os"

	"github.com/JaleelB/jira-flow/internal"
	"github.com/logrusorgru/aurora"
)

func main() {
    branchName, err := internal.GetCurrentBranchName()
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
        os.Exit(1)
    }

    config := internal.NewConfig()
    jiraManager := internal.NewJiraManager(config)

    issueKey, err := jiraManager.ExtractIssueKeyFromBranchName(branchName)
    if err == nil {
        description := aurora.BrightMagenta(fmt.Sprintf("Switched to branch '%s' with JIRA issue key: %s\n", branchName, issueKey))
        fmt.Println(description)
    } else {
        description := aurora.BrightMagenta(fmt.Sprintf("Switched to branch '%s' with no associated JIRA issue key.\n", branchName))
        fmt.Println(description)
    }
}
