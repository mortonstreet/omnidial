export function parseCustomFields(customFields: unknown): [string, string][] {
  try {
    const parsed =
      typeof customFields === "string"
        ? JSON.parse(customFields)
        : ((customFields as Record<string, string>) || {});
    return Object.entries(parsed);
  } catch {
    return [];
  }
}

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
