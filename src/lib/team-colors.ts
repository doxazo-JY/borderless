export const TEAM_COLOR_VAR: Record<string, string> = {
  A: "var(--color-team-a)",
  B: "var(--color-team-b)",
  C: "var(--color-team-c)",
  D: "var(--color-team-d)",
};

export function teamColor(teamName: string): string {
  return TEAM_COLOR_VAR[teamName] ?? "var(--color-ink)";
}
