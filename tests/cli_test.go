package tests

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

// Option 1: Remove the unused function
// Delete the entire mockCLIMenu function

// Option 2: Add a test that uses it
func TestCLIMenuOutput(t *testing.T) {
	t.Run("Status Output", func(t *testing.T) {
		mockCLIMenu(t, "2\n", "JiraFlow Status")
	})
}

// Mock the CLI menu for testing
func mockCLIMenu(t *testing.T, input string, expectedOutput string) {
	// Save original stdin/stdout
	oldStdin := os.Stdin
	oldStdout := os.Stdout
	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
	}()

	// Create pipes
	r, w, _ := os.Pipe()
	os.Stdin = r
	
	outR, outW, _ := os.Pipe()
	os.Stdout = outW

	// Write test input
	io.WriteString(w, input)
	w.Close()

	// Run the function to test
	config := internal.NewConfig()
	internal.CheckStatus(config)

	// Capture output
	outW.Close()
	var buf bytes.Buffer
	io.Copy(&buf, outR)

	// Check output
	output := buf.String()
	if !strings.Contains(output, expectedOutput) {
		t.Errorf("expected output to contain %q, got %q", expectedOutput, output)
	}
}

func TestStatusCommand(t *testing.T) {
	// Override GetHooksPath for testing
	oldHooksPath := internal.GetHooksPath
	tempDir, _ := os.MkdirTemp("", "jira-flow-test")
	defer os.RemoveAll(tempDir)
	
	hooksDir := tempDir
	internal.GetHooksPath = func() string {
		return hooksDir
	}
	defer func() { internal.GetHooksPath = oldHooksPath }()

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

		output := buf.String()
		if !strings.Contains(output, "not active") {
			t.Errorf("expected status to show as not active, got: %s", output)
		}
	})
}

func TestToggleJiraFlow(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "jira-flow-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Override GetHooksPath for testing
	oldHooksPath := internal.GetHooksPath
	internal.GetHooksPath = func() string {
		return tempDir
	}
	defer func() { internal.GetHooksPath = oldHooksPath }()

	// Override InstallHooks for testing
	oldInstallHooks := internal.InstallHooks
	internal.InstallHooks = func(config *internal.Config) error {
		// Create dummy hook files
		commitMsgPath := tempDir + "/commit-msg"
		postCheckoutPath := tempDir + "/post-checkout"
		os.WriteFile(commitMsgPath, []byte("#!/bin/sh\necho test"), 0755)
		os.WriteFile(postCheckoutPath, []byte("#!/bin/sh\necho test"), 0755)
		return nil
	}
	defer func() { internal.InstallHooks = oldInstallHooks }()

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