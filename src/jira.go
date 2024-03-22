package main

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

func (jm *JiraManager) ExtractIssueKeyFromBranchName(branchName string) (string, error) {
	pattern := regexp.MustCompile(jm.Config.BranchPattern)
	matches := pattern.FindStringSubmatch(branchName)
	if len(matches) == 0 {
		return "", fmt.Errorf("no JIRA issue key found in branch name")
	}
	// Assuming the first match is the issue key
	return matches[0], nil
}

func (jm *JiraManager) AppendIssueKeyToCommitMessage(commitMsg, issueKey string) string {
	return fmt.Sprintf("%s %s", issueKey, commitMsg)
}

