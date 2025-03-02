# jira-flow.rb
class JiraFlow < Formula
  desc "CLI tool to link git commits with JIRA issues"
  homepage "https://github.com/JaleelB/jira-flow"
  version "0.5.0"
  
  if OS.mac?
    if Hardware::CPU.arm?
      url "https://github.com/JaleelB/jira-flow/releases/download/v#{version}/jira-flow-darwin-arm64.tar.gz"
    else
      url "https://github.com/JaleelB/jira-flow/releases/download/v#{version}/jira-flow-darwin-amd64.tar.gz"
    end
  elsif OS.linux?
    if Hardware::CPU.arm?
      url "https://github.com/JaleelB/jira-flow/releases/download/v#{version}/jira-flow-linux-arm64.tar.gz"
    else
      url "https://github.com/JaleelB/jira-flow/releases/download/v#{version}/jira-flow-linux-amd64.tar.gz"
    end
  end
  
  def install
    bin.install "jira-flow"
    bin.install "commitmsg"
    bin.install "postco"
  end
  
  test do
    system "#{bin}/jira-flow", "--version"
  end
end
