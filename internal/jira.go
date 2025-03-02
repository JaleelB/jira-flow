package internal

import (
	"fmt"
	"regexp"
)

// JiraManager handles operations related to JIRA issues.
type JiraManager struct {
	Config *Config
}

// NewJiraManager creates a new instance of JiraManager with the provided configuration.
func NewJiraManager(config *Config) *JiraManager {
	return &JiraManager{
		Config: config,
	}
}

func (jm *JiraManager) ValidateJiraKey(
	input string,
) (string, error) {
	//the regex pattern for JIRA issue key validation
	jiraIssueKeyPattern := regexp.MustCompile(jm.Config.BranchPattern)

	if !jiraIssueKeyPattern.MatchString(input) {
		return "", fmt.Errorf("invalid JIRA issue key format. Valid format is <project_key>-<ticket_number> e.g. ABC-1234. Please try again")
	}
	return input, nil
}

// ConfigureAutomatic sets up automatic JIRA issue key extraction from branch names
func (jm *JiraManager) ConfigureAutomatic() error {
	// Set the config to use automatic linking
	jm.Config.AutoLink = true

	// Try to extract the JIRA key from the current branch as a test
	branchName, err := GetCurrentBranchName()
	if err != nil {
		return fmt.Errorf("failed to get current branch name: %w", err)
	}

	// Don't fail if we're on main/master
	if branchName == "main" || branchName == "master" {
		fmt.Println("Currently on", branchName, "branch. JiraFlow will extract JIRA keys when you switch to feature branches.")
		return nil
	}

	// For other branches, try to extract the key as a test
	_, err = jm.ExtractIssueKeyFromBranchName(branchName)
	if err != nil {
		return fmt.Errorf("failed to extract JIRA issue key from branch name: %w", err)
	}

	return nil
}



