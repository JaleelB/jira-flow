package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"

	"github.com/JaleelB/jira-flow/internal"
)

func main() {
    if len(os.Args) != 2 {
        fmt.Println("Usage: commitmsg <path to commit message file>")
        os.Exit(1)
    }

    commitMsgFilePath := os.Args[1]

    // Extract the current branch name
    branchName, err := internal.GetCurrentBranchName()
    if err != nil {
        fmt.Printf("Error getting current branch name: %v\n", err)
        os.Exit(1)
    }

    issueKeyPattern := regexp.MustCompile(`[A-Z]+-\d+`)

    // Attempt to find an issue key in the branch name
    matches := issueKeyPattern.FindStringSubmatch(branchName)
    if len(matches) == 0 {
        fmt.Println("No JIRA issue key found in branch name. Skipping.")
        os.Exit(0) // Exit successfully without modifying the commit message
    }

    issueKey := matches[0]

    // Prepend the issue key to the commit message
    if err := prependIssueKeyToCommitMsg(commitMsgFilePath, issueKey); err != nil {
        fmt.Printf("Error prepending JIRA issue key to commit message: %v\n", err)
        os.Exit(1)
    }

    fmt.Println("JIRA issue key prepended to commit message successfully.")
}

func prependIssueKeyToCommitMsg(filePath, issueKey string) error {
    file, err := os.Open(filePath)
    if err != nil {
        return err
    }
    defer file.Close()

    // Read the existing commit message
    scanner := bufio.NewScanner(file)
    var lines []string
    for scanner.Scan() {
        lines = append(lines, scanner.Text())
    }

    // Open the same file for writing, truncating it first
    file, err = os.Create(filePath)
    if err != nil {
        return err
    }
    defer file.Close()

    // Prepend the issue key to the first line
    if len(lines) > 0 {
        lines[0] = fmt.Sprintf("%s %s", issueKey, lines[0])
    } else {
        // If the file was empty, just write the issue key
        lines = append(lines, issueKey)
    }

    // Write the modified commit message back to the file
    for _, line := range lines {
        _, err := file.WriteString(line + "\n")
        if err != nil {
            return err
        }
    }

    return nil
}
