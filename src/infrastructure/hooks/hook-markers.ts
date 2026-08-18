/**
 * Managed-block ownership markers (ADR-0005, architecture §15-16).
 *
 * Hook file presence never implies JiraFlow ownership; ownership is proven
 * only by these exact markers.
 */

export const MANAGED_BLOCK_VERSION = 1;

export const BLOCK_ID = "jiraflow-v1";

export const BEGIN_MARKER = `# >>> jiraflow managed block v${MANAGED_BLOCK_VERSION}`;

export const END_MARKER = `# <<< jiraflow managed block v${MANAGED_BLOCK_VERSION}`;

export function containsManagedBlock(content: string): boolean {
  return content.includes(BEGIN_MARKER) && content.includes(END_MARKER);
}

/** Number of managed-block begin markers found in the content. */
export function countManagedBlocks(content: string): number {
  return content.split(BEGIN_MARKER).length - 1;
}

/**
 * True when the marker pair is structurally valid: exactly one block,
 * begin marker before end marker. Damaged markers are treated as a
 * conflict, never silently repaired (architecture §16.4).
 */
export function hasValidManagedMarkers(content: string): boolean {
  const beginCount = countManagedBlocks(content);
  if (beginCount !== 1) {
    return false;
  }
  const endCount = content.split(END_MARKER).length - 1;
  if (endCount !== 1) {
    return false;
  }
  return content.indexOf(BEGIN_MARKER) < content.indexOf(END_MARKER);
}
