package main

import (
	"fmt"
	"regexp"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

func validateJiraKey(
	input string, 
	branchPattern string,
	) (string, error) {
	//the regex pattern for JIRA issue key validation
	jiraIssueKeyPattern := regexp.MustCompile(branchPattern)
	if !jiraIssueKeyPattern.MatchString(input) {
		return "", fmt.Errorf("invalid JIRA issue key format. Valid format is <project_key>-<ticket_number> e.g. ABC-1234. Please try again")
	}
	return input, nil
}

func CreateMenu(
	config *Config,
) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "menu",
		Short: "Create a CLI menu",
		Long:  `This command creates a CLI menu using promptui.`,
		Run: func(cmd *cobra.Command, args []string) {

			templates := &promptui.SelectTemplates{
				Label:    "{{ . }}?",
				Active:   "\U000027A1 {{ . | cyan }}", 
				Inactive: "  {{ . | cyan }}",
				Selected: "\u2714 {{ . | red }}", 
			}

			selectPrompt := promptui.Select{
				Label: "How would you like to link your commits to a Jira issue?",
				Items: []string{
					"Automatically link commits to Jira issues",
					"Manually link commits to Jira issues",
				},
				Templates: templates,
			}

			_, result, err := selectPrompt.Run()

			if err != nil {
				fmt.Printf("Prompt failed %v\n", err)
				return
			}

			switch result {
				case "Automatically link commits to Jira issues":
					config.AutoLink = true
					fmt.Println("Automatic JIRA issue key tracking is enabled. The issue key will be extracted from the branch name and prepended to your commits, linking them to your JIRA issue.")
					
				case "Manually link commits to Jira issues":
	
					prompt := promptui.Prompt{
						Label: "JIRA Issue Key",
						Validate: func(input string) error {
							_, err := validateJiraKey(input, config.BranchPattern)
							return err
						},
					}

					result, err := prompt.Run()

					if err != nil {
						fmt.Printf("Prompt failed %v\n", err)
						return
					}

					config.JiraKey = result
					config.AutoLink = false

					fmt.Printf("You have entered JIRA issue key: %q\n. The issue key will now prepeded to your commmits linking them to your JIRA issue.", result)
			
			}
		},
	}

	return cmd
}