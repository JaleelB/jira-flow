package testing

import (
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

var branchPattern = internal.NewConfig().BranchPattern

func TestValidateJiraKey(t *testing.T) {
    // Test cases
    tests := []struct {
        name           string
        input          string
        branchPattern  string
        wantErr        bool
    }{
        {
            name:          "valid JIRA key",
            input:         "ABC-1234",
            branchPattern: branchPattern,
            wantErr:       false,
        },
        {
            name:          "invalid JIRA key",
            input:         "ABC1234",
            branchPattern: branchPattern,
            wantErr:       true,
        },
        {
			name:          "invalid JIRA key",
			input:         "abx-1234",
			branchPattern: branchPattern,
			wantErr:       true,
		},
    }

    jira := &internal.JiraManager{Config: &internal.Config{}}

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := jira.ValidateJiraKey(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateJiraKey() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}

func TestExtractIssueKeyFromBranchName(t *testing.T) {
    config := &internal.Config{BranchPattern: `([A-Z]+-\d+)`}
    manager := internal.NewJiraManager(config)

    tests := []struct {
        name      string
        branch    string
        want      string
        wantError bool
    }{
        {
            name:      "valid branch name",
            branch:    "feature/ABC-1234-add-login",
            want:      "ABC-1234",
            wantError: false,
        },
        {
            name:      "invalid branch name",
            branch:    "feature/add-login",
            want:      "",
            wantError: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := manager.ExtractIssueKeyFromBranchName(tt.branch)
            if (err != nil) != tt.wantError {
                t.Errorf("ExtractIssueKeyFromBranchName() error = %v, wantError %v", err, tt.wantError)
                return
            }
            if got != tt.want {
                t.Errorf("ExtractIssueKeyFromBranchName() = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestAppendIssueKeyToCommitMessage(t *testing.T) {
    config := &internal.Config{}
    manager := internal.NewJiraManager(config)

    tests := []struct {
        name     string
        commit   string
        issueKey string
        want     string
    }{
        {
            name:     "valid commit message",
            commit:   "Implement login feature",
            issueKey: "ABC-1234",
            want:     "ABC-1234 Implement login feature",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := manager.AppendIssueKeyToCommitMessage(tt.commit, tt.issueKey); got != tt.want {
                t.Errorf("AppendIssueKeyToCommitMessage() = %v, want %v", got, tt.want)
            }
        })
    }
}
