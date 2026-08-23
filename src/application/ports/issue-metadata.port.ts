export interface IssueMetadata {
  repositoryId: string;
  jiraKey: string;
  storyTitle: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface IssueMetadataPort {
  find(repositoryId: string, jiraKey: string): Promise<IssueMetadata | null>;
  save(repositoryId: string, jiraKey: string, storyTitle: string | null): Promise<IssueMetadata>;
}
