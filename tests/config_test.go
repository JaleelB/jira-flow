package tests

import (
	"testing"

	"github.com/JaleelB/jira-flow/internal"
)

func TestConfig(t *testing.T) {
	config := internal.NewConfig()
	t.Log("Testing NewConfig", config)
	if config.BranchPattern != `[A-Z]+-\d+` {
		t.Errorf("Expected branch pattern to be `([A-Z]+-\\d+)`, got %s", config.BranchPattern)
	}
	if config.HookPath != ".git/hooks/" {
        t.Errorf("Expected HookPath to be `.git/hooks/`, but got %v", config.HookPath)
    }

    if config.JiraKey != "" {
        t.Errorf("Expected JiraKey to be empty, but got %v", config.JiraKey)
    }

}