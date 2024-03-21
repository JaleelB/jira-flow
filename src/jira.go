package main

import (
	"fmt"
	"regexp"
)

func ValidateJiraKey(
	input string, 
	branchPattern string,
	) (string, error) {
	//the regex pattern for JIRA issue key validation
	jiraIssueKeyPattern := regexp.MustCompile(branchPattern)
	if !jiraIssueKeyPattern.MatchString(input) {
		return "", fmt.Errorf("invalid JIRA issue key format. Valid format is <project_key>-<ticket_number> e.g. ABC-1234. Please try again")
	}
	return input, nil
}
