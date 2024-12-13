package internal

import (
	"fmt"
	"os"
	"strings"

	"github.com/logrusorgru/aurora"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

type options struct {
	Name string
	Context string
}

func removeJiraFlow(jiraManager *JiraManager) {
    fmt.Println(aurora.BrightMagenta("\nRemoving Jira-Flow..."))

    if err := RemoveGitHooks(jiraManager.Config.HookPath); err != nil {
        fmt.Printf("Error removing Git hooks: %v\n", err)
        return
    }

    fmt.Println(aurora.BrightMagenta("Jira-Flow has been successfully removed from this repository."))
}

func configureJiraFlow(jiraManager *JiraManager) {
	
	options := []options{
		{Name: "Automatically", Context: "Automatically link commits to Jira issues based on branch name"},
		{Name: "Manually", Context: "Manually link commits to Jira issues by entering the Jira issue key"},
	}

	templates := &promptui.SelectTemplates{
		Label:    "\u003F {{ . | white }}",
		Active:   "\u27A4 {{ .Name | cyan }}", 
		Inactive: "  {{ .Name }}",
		Selected: "\u2713 How would you like to link your commits to a Jira issue: {{ .Context }}", 
		Details: `
+ {{ .Context | faint }}
`,
	}

	searcher := func(input string, index int) bool {
		option := options[index]
		name := strings.Replace(strings.ToLower(option.Name), " ", "", -1)
		input = strings.Replace(strings.ToLower(input), " ", "", -1)

		return strings.Contains(name, input)
	}

	selectPrompt := promptui.Select{
		Label: "How would you like to link your commits to a Jira issue?",
		Items: options,
		Templates: templates,
		Size: 4,
		Searcher: searcher,
	}

	idx, _, err := selectPrompt.Run()

	if err != nil {
		fmt.Printf("Prompt failed %v\n", err)
		return
	}

	selectedOption := options[idx]

	switch selectedOption.Name {
		case "Automatically":
			jiraManager.Config.AutoLink = true

			branchName, _ := GetCurrentBranchName()
			issueKey, err := jiraManager.ExtractIssueKeyFromBranchName(branchName)

			if err != nil {
				fmt.Printf("\nFailed to extract JIRA issue key from branch name: %v\n", err)
				return
			}

			jiraManager.Config.JiraKey = issueKey

			checkDirErr := CheckGitAndHooksDir()
			if checkDirErr != nil {
				fmt.Printf("\nFailed to check git and hooks directory: %v\n", checkDirErr)
				return
			}

			setHookErr := SetGitHooks(jiraManager.Config)
			if setHookErr != nil {
				fmt.Printf("\nFailed to set git hooks: %v\n", setHookErr)
				return
			}

			msg := fmt.Sprintf("\nSuccess! The issue key %q will now be prepended to your commits linking them to your JIRA issue.", issueKey)
			fmt.Printf("%s", aurora.BrightMagenta(msg))			
			
		case "Manually":

			prompt := promptui.Prompt{
				Label: "JIRA Issue Key: ",
				Validate: func(input string) error {
					_, err := jiraManager.ValidateJiraKey(input)
					return err
				},
				Templates: &promptui.PromptTemplates{
					Prompt:  "\u003F {{ . }}",
					Valid:   "\u003F {{ . | white }}",
					Invalid: "\u003F {{ . | white }}",
					Success: "\u2713 {{ . | white }}",
				},
			}

			result, err := prompt.Run()

			if err != nil {
				fmt.Printf("Prompt failed %v\n", err)
				return
			}

			jiraManager.Config.JiraKey = result
			jiraManager.Config.AutoLink = false

			checkDirErr := CheckGitAndHooksDir()
			if checkDirErr != nil {
				fmt.Printf("\nFailed to check git and hooks directory: %v\n", checkDirErr)
				return
			}

			setHookErr := SetGitHooks(jiraManager.Config)
			if setHookErr != nil {
				fmt.Printf("\nFailed to set git hooks: %v\n", setHookErr)
				return
			}
			
			msg := fmt.Sprintf("\nYou have entered JIRA issue key: %q. The issue key will now prepeded to your commmits linking them to your JIRA issue.", result)
			fmt.Printf("%s", aurora.BrightMagenta(msg))			
	}
}

func CLIMenu(
	config *Config,
) *cobra.Command {

	jiraManager := NewJiraManager(config)

	logo := `
     __ ____ ___   ___    ____ __   ____  _      __
 __ / //  _// _ \ / _ |  / __// /  / __ \| | /| / /
/ // /_/ / / , _// __ | / _/ / /__/ /_/ /| |/ |/ / 
\___//___//_/|_|/_/ |_|/_/  /____/\____/ |__/|__/                                                                  
	`

	cmd := &cobra.Command{
		Use:   "jira-flow init",
		Short: "Initialize JiraFlow",
		Long:  `JiraFlow lets you link your commits with JIRA tickets directly from your command line.`,
		Run: func(cmd *cobra.Command, args []string) {

			fmt.Printf("%s", aurora.BrightYellow(logo))

			description := aurora.BrightMagenta("\nWelcome to JiraFlow! JiraFlow will help you link your commits with JIRA tickets directly from your command line.\n")
			fmt.Println(description)

			mainOptions := []options{
				{Name: "Configure", Context: "Configure JiraFlow for this repository"},
				{Name: "Status", Context: "Check JiraFlow status in this repository"},
				{Name: "Remove", Context: "Remove JiraFlow from this repository"},
				{Name: "Exit", Context: "Exit JiraFlow"},
			}

			mainTemplates := &promptui.SelectTemplates{
                Label:    "\u003F {{ . | white }}",
                Active:   "\u27A4 {{ .Context | cyan }}",
                Inactive: "  {{ .Context }}",
                Selected: "\u2713 {{ .Context }}",
				Details: `
+ {{ .Context | faint }}
`,
            }

            mainSelectPrompt := promptui.Select{
                Label:     "What would you like to do?",
                Items:     mainOptions,
                Templates: mainTemplates,
                Size:      3,
            }

            idx, _, err := mainSelectPrompt.Run()
            if err != nil {
                fmt.Printf("Prompt failed %v\n", err)
                return
            }

            switch mainOptions[idx].Name {
				case "Configure":
					configureJiraFlow(jiraManager)
				case "Status":
					CheckStatus(config)
				case "Remove":
					removeJiraFlow(jiraManager)
				case "Exit":
					fmt.Print(aurora.BrightMagenta("\nExiting JiraFlow..."))
					os.Exit(0)
            }
			
		},
	}

	return cmd
}