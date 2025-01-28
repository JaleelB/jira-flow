package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/JaleelB/jira-flow/internal"
	"github.com/spf13/cobra"
)

// checks if the current directory is a git repository.
func checkIfGitRepo() bool {
    cmd := exec.Command("git", "rev-parse", "--is-inside-work-tree")
    err := cmd.Run()
    return err == nil
}

func main() {

	if !checkIfGitRepo() {
        fmt.Println("This command must be run inside a Git repository.")
        os.Exit(1)
    }

	config := internal.NewConfig()  // create a new config object

	rootCmd := &cobra.Command{
		Use:   "jira-flow",
		Short: "JiraFlow CLI tool",
		Run: func(cmd *cobra.Command, args []string) {
			// run the menu command by default, passing in the config
			menuCmd := internal.CLIMenu(config)
			menuCmd.Execute()
		},
	}

	// Add status command
	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Check or modify JiraFlow status in current repository",
		Run: func(cmd *cobra.Command, args []string) {
			internal.CheckStatus(config)
			
			// Only prompt for action if JiraFlow is in a different state than desired
			if len(args) > 0 && args[0] == "--toggle" {
				active := internal.IsJiraFlowActive()
				if err := internal.ToggleJiraFlow(config, !active); err != nil {
					fmt.Printf("Error: %v\n", err)
					os.Exit(1)
				}
			}
		},
	}
	rootCmd.AddCommand(statusCmd)

	// Add init command
	initCmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize JiraFlow in the current repository",
		Run: func(cmd *cobra.Command, args []string) {
			menuCmd := internal.CLIMenu(config)
			menuCmd.Execute()
		},
	}
	rootCmd.AddCommand(initCmd)

	// Execute the root command
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	
}