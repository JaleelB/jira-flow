# Jira-Flow

Jira-Flow is a CLI tool designed to link git commits with JIRA issues.

### Installation

#### Using NPM (or any other package manager)

```sh
npm install -g jira-flow
```

#### From Source

If you want to install Jira-Flow from source, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/JaleelB/jira-flow.git
   cd jira-flow
   ```

2. Build the project (assuming Go is installed):

   ```bash
   go build -o jira-flow ./cmd/jira-flow
   ```

3. Optionally, install the binary to a location in your PATH:

   ```bash
   sudo mv jira-flow /usr/local/bin
   ```

   On Windows, you may simply move `jira-flow.exe` to a directory that is included in your PATH.

#### Manual Installation

If you prefer not to use npm, you can manually download the binaries from the [GitHub Releases page](https://github.com/JaleelB/jira-flow/releases).

1. Navigate to the [Releases page](https://github.com/JaleelB/jira-flow/releases) of Jira-Flow.
2. Download the appropriate binary for your operating system and architecture.
3. Extract the downloaded archive and place the binary in a directory included in your system's PATH.

For example, on Unix-like systems:

```bash
tar -zxvf jiraflow_vX.X.X_os_arch.tar.gz
sudo mv jiraflow /usr/local/bin
```

On Windows, extract the files and add the folder to your PATH using the environment settings.

### Usage

Once installed, you can start using Jira-Flow with the following command:

```sh
jira-flow init
```

### A Quick Example

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
