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

var architectureMapping = map[string]string{
    "x64":  "amd64",
    "arm":  "arm",
    "arm64": "arm64",
    "ia32": "386",
}

var platformMapping = map[string]string{
  "darwin": "darwin",
  "win32": "windows",
  "linux": "linux",
  "freebsd": "freebsd",
};


// Function to execute git commands
func ExecuteGitCommand(args ...string) (string, error) {
    cmd := exec.Command("git", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return "", err
    }
    return strings.TrimSuffix(string(output), "\n"), nil
}

func SetGitHookScript(config *Config) error {
    globalBinPath, err := GetGlobalBinPath()
    if err != nil {
       fmt.Printf("getting global bin path: %v\n", err)
        return err
    }

    platform := runtime.GOOS
    mappedPlatform, ok := platformMapping[platform]
    if !ok {
        fmt.Printf("unsupported operating system\n")
        return err
    }

    binaryName := "commitmsg"
    if mappedPlatform == "windows" {
        binaryName += ".exe"
    }
    binaryPath := filepath.Join(globalBinPath, binaryName)

    hookScript := fmt.Sprintf("#!/bin/sh\n%s \"$@\"", binaryPath)
    hookPath := filepath.Join(config.HookPath, "commit-msg")

    fmt.Printf("Using binary path: %s\n", binaryPath)
    fmt.Printf("Hook script path: %s\n", hookPath)

    if _, err := os.Stat(hookPath); os.IsNotExist(err) {
        if err := os.MkdirAll(filepath.Dir(hookPath), 0755); err != nil {
            fmt.Printf("creating hook directory: %v\n", err)
            return err
        }
    }

    err = os.WriteFile(hookPath, []byte(hookScript), 0755)
    if err != nil {
        fmt.Printf("writing commit-msg hook: %v\n", err)
        return err
    }

    fmt.Println("Git hook script set successfully.")
    return nil
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
	pattern := regexp.MustCompile(jm.Config.BranchPattern)
	matches := pattern.FindStringSubmatch(branchName)
	if len(matches) == 0 {
		return "", fmt.Errorf("no JIRA issue key found in branch name")
	}
	// Assuming the first match is the issue key
	return matches[0], nil
}

