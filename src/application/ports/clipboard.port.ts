export interface ClipboardResult {
  copied: boolean;
  warning?: string;
}

export interface ClipboardPort {
  copy(value: string): Promise<ClipboardResult>;
}
