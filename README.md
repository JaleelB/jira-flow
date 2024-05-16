# Jira-Flow

Jira-Flow is a CLI tool designed to link git commits with JIRA issues.

## Installation

To install Jira-Flow, run the following command:

```sh
npm install -g jira-flow
```

## Usage

Once installed, you can start using Jira-Flow with the following command:

```sh
jira-flow init
```

## A Quick Example

Here's a glimpse of how Jira-Flow will work:

```bash
# Running Jira-Flow for the first time in a repository
$ jira-flow init

# The interactive CLI will present the user with a menu:
1. Auto-detect JIRA issue key from branch name.
2. Manually enter the JIRA issue key.

# User selects option 1 and the tool configures the Git hook automatically.

```

Once set up, Jira-Flow will prepend commit messages with the JIRA issue key, either detected from the branch name or entered manually, enhancing the integration between the developer's code repository and the JIRA tracking system.

### Linking Commits to JIRA Issues

For more information on how JIRA issue keys can be used to reference issues in your development work, including commits, branches, and pull requests, see the official [Atlassian documentation](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/).

### Contributing

- Fork the repository
- Create a branch
  ```bash
  git checkout -b fix/amazingFix
  ```
- Commit your changes and push to your branch
  ```bash
  git commit -m "made an amazingFix"
  git push origin fix/amazingFix
  ```
- Open a pull request
