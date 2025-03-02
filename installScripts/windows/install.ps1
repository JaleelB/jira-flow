# install.ps1
$ErrorActionPreference = "Stop"

Write-Host "Installing JiraFlow..."

# Determine architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }

# Download binaries
$releaseUrl = "https://github.com/JaleelB/jira-flow/releases/latest/download"
$installDir = "$env:USERPROFILE\JiraFlow"

Write-Host "Downloading JiraFlow binaries for windows-$arch..."
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Invoke-WebRequest -Uri "$releaseUrl/jira-flow-windows-$arch.exe" -OutFile "$installDir\jira-flow.exe"
Invoke-WebRequest -Uri "$releaseUrl/commitmsg-windows-$arch.exe" -OutFile "$installDir\commitmsg.exe"
Invoke-WebRequest -Uri "$releaseUrl/postco-windows-$arch.exe" -OutFile "$installDir\postco.exe"

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $currentPath.Contains($installDir)) {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "User")
    Write-Host "Added JiraFlow to your PATH"
}

Write-Host "JiraFlow installed successfully! Run 'jira-flow init' to get started."
