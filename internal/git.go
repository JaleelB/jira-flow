package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

// Function to execute git commands
func ExecuteGitCommand(args ...string) (string, error) {
    cmd := exec.Command("git", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return "", err
    }
    return strings.TrimSuffix(string(output), "\n"), nil
}

// configures all necessary Git hooks
func SetGitHooks(config *Config) error {
	if err := SetCommitMsgHook(config); err != nil {
		return fmt.Errorf("setting commit message hook: %w", err)
	}

	if err := SetPostCheckoutHook(config); err != nil {
		return fmt.Errorf("setting post-checkout hook: %w", err)
	}

	return nil
}

func SetCommitMsgHook(config *Config) error {
	hookPath := filepath.Join(config.HookPath, "commit-msg")
	hookScript := generateHookScript(config, "commitmsg")

	return installHookScript(hookScript, hookPath)
}

func SetPostCheckoutHook(config *Config) error {
	hookPath := filepath.Join(config.HookPath, "post-checkout")
	hookScript := generateHookScript(config, "postco")  

	return installHookScript(hookScript, hookPath)
}

// func generateHookScript(config *Config, scriptName string) string {
// 	binaryPath := getBinaryPath(config, scriptName)
// 	return fmt.Sprintf("#!/bin/sh\n%s \"$@\"", binaryPath)
// }
func generateHookScript(config *Config, scriptName string) string {
    binaryPath := getBinaryPath(config, scriptName)
    // For Windows, ensure backslashes are properly escaped and the path is quoted
    if runtime.GOOS == "windows" {
        binaryPath = strings.ReplaceAll(binaryPath, `\`, `\\`) // Escape backslashes
        binaryPath = `"` + binaryPath + `"` // Quote the path
    }
    return fmt.Sprintf("#!/bin/sh\n%s \"$@\"", binaryPath)
}


func getBinaryPath(config *Config, scriptName string) string {
	globalBinPath, _ := GetGlobalBinPath()  // Handle error appropriately
	platform := runtime.GOOS
	binaryName := scriptName
	if platform == "windows" {
		binaryName += ".exe"
	}
	return filepath.Join(globalBinPath, binaryName)
}

func installHookScript(hookScript, hookPath string) error {
	if _, err := os.Stat(hookPath); os.IsNotExist(err) {
		if err := os.MkdirAll(filepath.Dir(hookPath), 0755); err != nil {
			return fmt.Errorf("creating hook directory: %w", err)
		}
	}

	return os.WriteFile(hookPath, []byte(hookScript), 0755)
}

func CheckGitAndHooksDir() error {
    // Check if git is installed
    _, err := exec.LookPath("git")
    if err != nil {
        // return fmt.Errorf("git is not installed: %w", err)
        fmt.Printf("git is not installed: %v\n", err)
        return err
    }

    // Check if the script is being run from within a git repository
    gitRoot, err := ExecuteGitCommand("rev-parse", "--show-toplevel")
    if err != nil {
        // return fmt.Errorf("this doesn't seem to be a git repository: %w", err)
        fmt.Printf("this doesn't seem to be a git repository: %v\n", err)
        return err
    }

    // Construct the full path to the .git/hooks directory
    hooksDir := filepath.Join(gitRoot, ".git", "hooks")

    // Test writability by creating and removing a temporary file
    testFilePath := filepath.Join(hooksDir, ".tmp-hook-test")
    testFile, err := os.Create(testFilePath)
    if err != nil {
        // return fmt.Errorf("failed to create a file in the hooks directory to test writability: %w", err)
        fmt.Printf("failed to create a file in the hooks directory to test writability: %v\n", err)
        return err
    }
    testFile.Close()

    // Clean up the temporary file
    err = os.Remove(testFilePath)
    if err != nil {
        // return fmt.Errorf("failed to remove the temporary file in the hooks directory: %w", err)
        fmt.Printf("failed to remove the temporary file in the hooks directory: %v\n", err)
        return err
    }

    return nil
}

func GetCurrentBranchName() (string, error) {
    branchName, err := ExecuteGitCommand("rev-parse", "--abbrev-ref", "HEAD")
    if err != nil {
        return "", fmt.Errorf("failed to get the current branch name: %w", err)
    }
    return strings.TrimSpace(branchName), nil
}

func (jm *JiraManager) ExtractIssueKeyFromBranchName(branchName string) (string, error) {
	// Skip extraction for main/master branches
	if branchName == "main" || branchName == "master" {
		return "", nil // Return empty string without error for main/master
	}
	
	pattern := regexp.MustCompile(jm.Config.BranchPattern)
	matches := pattern.FindStringSubmatch(branchName)
	if len(matches) == 0 {
		return "", fmt.Errorf("no JIRA issue key found in branch name")
	}
	// Assuming the first match is the issue key
	return matches[0], nil
}

