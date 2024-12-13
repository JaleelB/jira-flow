package tests

import (
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

func TestExecuteGitCommand(t *testing.T) {
	// Test cases
	tests := []struct {
		name     string
		args     []string
		wantErr  bool
		wantCode int
	}{
		{
			name:     "git version",
			args:     []string{"version"},
			wantErr:  false,
			wantCode: 0,
		},
		{
			name:     "git help",
			args:     []string{"help"},
			wantErr:  false,
			wantCode: 0,
		},
		{
			name:     "git bogus",
			args:     []string{"bogus"},
			wantErr:  true,
			wantCode: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output, err := internal.ExecuteGitCommand(tt.args...)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExecuteGitCommand() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err == nil && tt.wantCode != 0 {
				t.Errorf("ExecuteGitCommand() code = %v, wantCode %v", 0, tt.wantCode)
				return
			}
			if err == nil && output == "" {
				t.Errorf("ExecuteGitCommand() output = %v, want non-empty", output)
				return
			}
		})
	}
}

func TestSetGitHookScript(
	t *testing.T,
) {
	// Test cases
	tests := []struct {
		name    string
		script  string
		wantErr bool
	}{
		{
			name:    "valid script",
			script:  "echo 'hello world'",
			wantErr: false,
		},
		{
			name:    "empty script",
			script:  "",
			wantErr: true,
		},
	}

	config := internal.NewConfig()

	for _, tt := range tests {

		t.Run(tt.name, func(t *testing.T) {
			// err := internal.SetGitHookScript(config)
			err := internal.SetGitHooks(config)
			if (err != nil) != tt.wantErr {
				t.Errorf("SetGitHookScript() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

