/** Trim, replace spaces with underscores, strip invalid chars, uppercase. */
export function displayNameToPlanKey(displayName: string): string {
  return displayName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

export function isValidPlanKey(planKey: string): boolean {
  return /^[A-Z0-9_]{2,40}$/.test(planKey);
}

export function formatPlanCode(planKey: string | undefined | null): string {
  return String(planKey ?? '')
    .trim()
    .toUpperCase();
}
