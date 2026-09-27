export const PR_TITLE_VARIABLES = [
  "jiraKey",
  "storyTitle",
  "branch",
  "repo",
  "date",
  "quarter",
] as const;

export type PrTitleVariable = (typeof PR_TITLE_VARIABLES)[number];
export type PrTitleVariables = Record<PrTitleVariable, string>;

export function renderPrTitle(template: string, variables: PrTitleVariables): string {
  return template.replace(
    /\{(jiraKey|storyTitle|branch|repo|date|quarter)\}/g,
    (_, key: PrTitleVariable) => variables[key],
  );
}

export function calendarQuarter(date: Date): "Q1" | "Q2" | "Q3" | "Q4" {
  return `Q${Math.floor(date.getMonth() / 3) + 1}` as "Q1" | "Q2" | "Q3" | "Q4";
}

export function formatLocalDate(date: Date, format: string): string {
  const values = {
    YYYY: String(date.getFullYear()).padStart(4, "0"),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    DD: String(date.getDate()).padStart(2, "0"),
  };
  return format.replace(/YYYY|MM|DD/g, (token) => values[token as keyof typeof values]);
}
