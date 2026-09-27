export interface StoryTitlePromptPort {
  prompt(jiraKey: string): Promise<string | null>;
}
