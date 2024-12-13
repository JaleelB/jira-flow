package tests

import (
	"bytes"
	"io"
	"os"
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

func TestCLIMenu(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Status Check",
			input:    "2\n",  // Select Status option
			expected: "JiraFlow Status:",
		},
		{
			name:     "Exit Option",
			input:    "4\n",  // Select Exit option
			expected: "Exiting JiraFlow",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			config := internal.NewConfig()
			oldStdin := os.Stdin
			oldStdout := os.Stdout

			// Create pipes for input/output
			r, w, _ := os.Pipe()
			os.Stdin = r
			
			outR, outW, _ := os.Pipe()
			os.Stdout = outW

			// Write test input
			io.WriteString(w, tt.input)
			w.Close()

			// Run CLI
			cmd := internal.CLIMenu(config)
			cmd.Execute()

			// Capture output
			outW.Close()
			var buf bytes.Buffer
			io.Copy(&buf, outR)

			// Cleanup
			os.Stdin = oldStdin
			os.Stdout = oldStdout

			// Assert
			if !bytes.Contains(buf.Bytes(), []byte(tt.expected)) {
				t.Errorf("expected output to contain %q, got %q", tt.expected, buf.String())
			}
		})
	}
}

func TestStatusCommand(t *testing.T) {
	config := internal.NewConfig()
	
	// Test when JiraFlow is not active
	t.Run("Inactive Status", func(t *testing.T) {
		var buf bytes.Buffer
		oldStdout := os.Stdout
		r, w, _ := os.Pipe()
		os.Stdout = w

		internal.CheckStatus(config)

		w.Close()
		io.Copy(&buf, r)
		os.Stdout = oldStdout

		if !bytes.Contains(buf.Bytes(), []byte("not active")) {
			t.Error("expected status to show as not active")
		}
	})
}

func TestToggleJiraFlow(t *testing.T) {
	config := internal.NewConfig()
	
	t.Run("Enable JiraFlow", func(t *testing.T) {
		err := internal.ToggleJiraFlow(config, true)
		if err != nil {
			t.Errorf("failed to enable JiraFlow: %v", err)
		}
		
		if !internal.IsJiraFlowActive() {
			t.Error("JiraFlow should be active after enabling")
		}
	})

	t.Run("Disable JiraFlow", func(t *testing.T) {
		err := internal.ToggleJiraFlow(config, false)
		if err != nil {
			t.Errorf("failed to disable JiraFlow: %v", err)
		}
		
		if internal.IsJiraFlowActive() {
			t.Error("JiraFlow should not be active after disabling")
		}
	})
} 