# Jira-Flow

Jira-Flow is a CLI tool designed to link git commits with JIRA issues.

### Installation

#### Using NPM (or any other package manager)

```sh
npm install -g jira-flow
```

#### From Source

To install Jira-Flow from source, including all associated binaries (`jiraflow`, `commitmsg`, `postco`), follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/JaleelB/jira-flow.git
   cd jira-flow
   ```

2. Build the project (assuming Go is installed):

   ```bash
   go build -o jiraflow ./cmd/jiraflow/main.go
   go build -o commitmsg ./hooks/commitmsg/main.go
   go build -o postco ./hooks/postco/main.go
   ```

3. Optionally, install the binary to a location in your PATH:

   ```bash
   sudo mv jiraflow /usr/local/bin
   sudo mv commitmsg /usr/local/bin
   sudo mv postco /usr/local/bin
   ```

   On Windows, move the `.exe` files to a directory that is included in your PATH.

#### Manual Installation

If you prefer not to use npm, you can manually download the binaries from the [GitHub Releases page](https://github.com/JaleelB/jira-flow/releases).

1. Navigate to the [Releases page](https://github.com/JaleelB/jira-flow/releases) of Jira-Flow.
2. Download the appropriate binary for your operating system and architecture.
3. Extract the downloaded archive and place the binary in a directory included in your system's PATH.

For example, on Unix-like systems:

```bash
tar -zxvf jiraflow_vX.X.X_os_arch.tar.gz
sudo mv jiraflow /usr/local/bin
tar -zxvf commitmsg_vX.X.X_os_arch.tar.gz
sudo mv commitmsg /usr/local/bin
tar -zxvf postco_vX.X.X_os_arch.tar.gz
sudo mv postco /usr/local/bin
```

On Windows, extract the files and add the folder to your PATH using the environment settings.

### Usage

Once installed, you can start using Jira-Flow with the following command:

```sh
jira-flow init
```

### A Quick Example

Here’s a quick example of initializing Jira-Flow and configuring it to automatically detect JIRA issue keys:

```bash
$ jira-flow init
# Welcome message and logo displayed
? How would you like to proceed:
  ▸ Configure Jira-Flow
    Remove Jira-Flow
    Exit Jira-Flow

# User selects 'Configure Jira-Flow'
? Choose configuration method:
  ▸ Automatically link commits to Jira issues based on branch name
    Manually link commits to Jira issues by entering the Jira issue key

# User chooses 'Automatically'
# Success message confirming automatic linking
"Success! The JIRA issue key will now be prepended to your commits."

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
