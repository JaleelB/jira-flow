package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

// TestBranchKeyExtraction tests the JIRA key extraction from branch names
func TestBranchKeyExtraction(t *testing.T) {
	config := internal.NewConfig()
	jiraManager := internal.NewJiraManager(config)

	tests := []struct {
		name       string
		branchName string
		wantKey    string
		wantErr    bool
	}{
		{
			name:       "Feature branch with JIRA key",
			branchName: "feature/ABC-123-new-feature",
			wantKey:    "ABC-123",
			wantErr:    false,
		},
		{
			name:       "Branch with JIRA key in middle",
			branchName: "user/john/ABC-456-bugfix",
			wantKey:    "ABC-456",
			wantErr:    false,
		},
		{
			name:       "Branch without JIRA key",
			branchName: "feature/new-feature",
			wantKey:    "",
			wantErr:    true,
		},
		{
			name:       "Main branch",
			branchName: "main",
			wantKey:    "",
			wantErr:    false, // No error for main branch
		},
		{
			name:       "Master branch",
			branchName: "master",
			wantKey:    "",
			wantErr:    false, // No error for master branch
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotKey, err := jiraManager.ExtractIssueKeyFromBranchName(tt.branchName)
			
			// Check error
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractIssueKeyFromBranchName() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			
			// Check key
			if gotKey != tt.wantKey {
				t.Errorf("ExtractIssueKeyFromBranchName() gotKey = %v, want %v", gotKey, tt.wantKey)
			}
		})
	}
}

// TestIsJiraFlowActive tests the status check functionality
func TestIsJiraFlowActive(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "jira-flow-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create a fake .git/hooks directory
	hooksDir := filepath.Join(tempDir, ".git", "hooks")
	err = os.MkdirAll(hooksDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create hooks dir: %v", err)
	}

	// Test when hooks are not present
	t.Run("No hooks present", func(t *testing.T) {
		// Override the hooks path for testing
		oldHooksPath := internal.GetHooksPath
		internal.GetHooksPath = func() string {
			return hooksDir
		}
		defer func() { internal.GetHooksPath = oldHooksPath }()

		if internal.IsJiraFlowActive() {
			t.Error("IsJiraFlowActive() should return false when hooks are not present")
		}
	})

	// Create fake hook files
	commitMsgHook := filepath.Join(hooksDir, "commit-msg")
	postCheckoutHook := filepath.Join(hooksDir, "post-checkout")
	
	err = os.WriteFile(commitMsgHook, []byte("#!/bin/sh\necho test"), 0755)
	if err != nil {
		t.Fatalf("Failed to create commit-msg hook: %v", err)
	}
	
	err = os.WriteFile(postCheckoutHook, []byte("#!/bin/sh\necho test"), 0755)
	if err != nil {
		t.Fatalf("Failed to create post-checkout hook: %v", err)
	}

	// Test when hooks are present
	t.Run("Hooks present", func(t *testing.T) {
		// Override the hooks path for testing
		oldHooksPath := internal.GetHooksPath
		internal.GetHooksPath = func() string {
			return hooksDir
		}
		defer func() { internal.GetHooksPath = oldHooksPath }()

		if !internal.IsJiraFlowActive() {
			t.Error("IsJiraFlowActive() should return true when hooks are present")
		}
	})
}

// TestJiraFlowToggle tests enabling and disabling JiraFlow
func TestJiraFlowToggle(t *testing.T) {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "jira-flow-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create a fake .git/hooks directory
	hooksDir := filepath.Join(tempDir, ".git", "hooks")
	err = os.MkdirAll(hooksDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create hooks dir: %v", err)
	}

	config := internal.NewConfig()
	config.HookPath = hooksDir

	// Override GetHooksPath for this test
	oldHooksPath := internal.GetHooksPath
	internal.GetHooksPath = func() string {
		return hooksDir
	}
	defer func() { internal.GetHooksPath = oldHooksPath }()

	// Create dummy hook files directly instead of using symlinks
	createDummyHook := func() {
		commitMsgPath := filepath.Join(hooksDir, "commit-msg")
		postCheckoutPath := filepath.Join(hooksDir, "post-checkout")
		os.WriteFile(commitMsgPath, []byte("#!/bin/sh\necho test"), 0755)
		os.WriteFile(postCheckoutPath, []byte("#!/bin/sh\necho test"), 0755)
	}

	// Test enabling JiraFlow
	t.Run("Enable JiraFlow", func(t *testing.T) {
		// Mock InstallHooks to create dummy files instead of symlinks
		oldInstallHooks := internal.InstallHooks
		internal.InstallHooks = func(config *internal.Config) error {
			createDummyHook()
			return nil
		}
		defer func() { internal.InstallHooks = oldInstallHooks }()

		err := internal.ToggleJiraFlow(config, true)
		if err != nil {
			t.Errorf("ToggleJiraFlow(true) failed: %v", err)
		}

		// Check if hooks were created
		if _, err := os.Stat(filepath.Join(hooksDir, "commit-msg")); os.IsNotExist(err) {
			t.Error("commit-msg hook was not created")
		}
		if _, err := os.Stat(filepath.Join(hooksDir, "post-checkout")); os.IsNotExist(err) {
			t.Error("post-checkout hook was not created")
		}
	})

	// Test disabling JiraFlow
	t.Run("Disable JiraFlow", func(t *testing.T) {
		err := internal.ToggleJiraFlow(config, false)
		if err != nil {
			t.Errorf("ToggleJiraFlow(false) failed: %v", err)
		}

		// Check if hooks were removed
		if _, err := os.Stat(filepath.Join(hooksDir, "commit-msg")); !os.IsNotExist(err) {
			t.Error("commit-msg hook was not removed")
		}
		if _, err := os.Stat(filepath.Join(hooksDir, "post-checkout")); !os.IsNotExist(err) {
			t.Error("post-checkout hook was not removed")
		}
	})
} 