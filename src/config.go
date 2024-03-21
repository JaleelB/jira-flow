package main

type Config struct {
	AutoLink      bool   // Enable automatic JIRA key linking from branch name
	JiraKey       string // Default JIRA key if provided
	BranchPattern string // The pattern to use for matching JIRA keys in branch names
	HookPath      string // Path to the Git hooks directory
}

// New returns a new Config instance with default settings.
func New() *Config {
	return &Config{
		AutoLink:      true, // By default, we want to auto-link JIRA keys
		BranchPattern: `[A-Z]+-\d+`, // Regex pattern for JIRA keys like "JIRA-1234"
		HookPath:      ".git/hooks/", // Default path to the Git hooks
		// JiraKey doesn't have a default since it must be provided by the user if needed
	}
}
