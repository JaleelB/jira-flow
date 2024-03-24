package main

import (
	"fmt"
	"os"

	"github.com/JaleelB/jira-flow/internal"
	"github.com/spf13/cobra"
)

func main() {

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