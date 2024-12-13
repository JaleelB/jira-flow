package internal

import (
	"fmt"
	"path/filepath"
)

func CheckStatus(config *Config) {
	// Check for git hooks
	hooksPath := ".git/hooks"
	commitMsgHook := filepath.Join(hooksPath, "commit-msg")
	postCheckoutHook := filepath.Join(hooksPath, "post-checkout")

	isActive := isHookPresent(commitMsgHook) && isHookPresent(postCheckoutHook)
	
	if isActive {
		fmt.Println("✓ JiraFlow is active in this repository")
		fmt.Println("Installed hooks:")
		fmt.Println("  - commit-msg")
		fmt.Println("  - post-checkout")
	} else {
		fmt.Println("✗ JiraFlow is not active in this repository")
	}
}