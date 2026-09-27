import { createInterface } from "node:readline/promises";
import type { StoryTitlePromptPort } from "../../application/ports/story-title-prompt.port";

export class TerminalStoryTitlePrompt implements StoryTitlePromptPort {
  async prompt(jiraKey: string): Promise<string | null> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await terminal.question(`Story title for ${jiraKey}: `)).trim();
      return answer.length === 0 ? null : answer;
    } finally {
      terminal.close();
    }
  }
}
