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
		Use: "myapp",
		Run: func(cmd *cobra.Command, args []string) {
			// run the menu command by default, passing in the config
			menuCmd := internal.CLIMenu(config)
			menuCmd.Execute()
		},
	}

	// Execute the root command
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	
}