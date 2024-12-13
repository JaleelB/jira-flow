package internal

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/logrusorgru/aurora"
)

func CheckStatus(config *Config) {
	// Check for git hooks
	hooksPath := ".git/hooks"
	commitMsgHook := filepath.Join(hooksPath, "commit-msg")
	postCheckoutHook := filepath.Join(hooksPath, "post-checkout")

	isActive := isHookPresent(commitMsgHook) && isHookPresent(postCheckoutHook)
	
	fmt.Println("\nJiraFlow Status:")
	fmt.Println("---------------")
	
	if isActive {
		fmt.Println(aurora.BrightGreen("✓ JiraFlow is active in this repository"))
		fmt.Println(aurora.White("\nInstalled hooks:"))
		fmt.Println(aurora.BrightCyan("  - commit-msg"))
		fmt.Println(aurora.BrightCyan("  - post-checkout"))
	} else {
		fmt.Println(aurora.BrightRed("✗ JiraFlow is not active in this repository"))
		fmt.Println(aurora.Gray(12, "\nRun 'jira-flow init' to configure JiraFlow"))
	}
	fmt.Println() // Add empty line for spacing
}

func isHookPresent(hookPath string) bool {
	_, err := os.Stat(hookPath)
	return err == nil
}

func ToggleJiraFlow(config *Config, enable bool) error {
	if enable {
		// Reuse existing hook installation logic
		if err := InstallHooks(config); err != nil {
			return fmt.Errorf("failed to enable JiraFlow: %w", err)
		}
		fmt.Println("✓ JiraFlow enabled successfully")
	} else {
		if err := RemoveHooks(config); err != nil {
			return fmt.Errorf("failed to disable JiraFlow: %w", err)
		}
		fmt.Println("✓ JiraFlow disabled successfully")
	}
	return nil
}

func RemoveHooks(config *Config) error {
	hooksPath := ".git/hooks"
	hooks := []string{"commit-msg", "post-checkout"}

	for _, hook := range hooks {
		hookPath := filepath.Join(hooksPath, hook)
		if err := os.Remove(hookPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove %s hook: %w", hook, err)
		}
	}
	return nil
}

func InstallHooks(config *Config) error {
	hooksPath := ".git/hooks"
	hooks := map[string]string{
		"commit-msg": getBinaryPath(config, "commitmsg"),
		"post-checkout": getBinaryPath(config, "postco"),
	}

	for hookName, binaryPath := range hooks {
		hookPath := filepath.Join(hooksPath, hookName)
		if err := os.Symlink(binaryPath, hookPath); err != nil && !os.IsExist(err) {
			return fmt.Errorf("failed to install %s hook: %w", hookName, err)
		}
	}
	return nil
}

func IsJiraFlowActive() bool {
	hooksPath := ".git/hooks"
	return isHookPresent(filepath.Join(hooksPath, "commit-msg")) && 
		   isHookPresent(filepath.Join(hooksPath, "post-checkout"))
} 