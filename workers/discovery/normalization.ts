const TRACKING_KEYS = new Set(["source", "src", "ref", "refid", "gh_src"]);

export function canonicalizeJobUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLocaleLowerCase().startsWith("utm_") || TRACKING_KEYS.has(key.toLocaleLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

export function plainText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stableCompositeKey(parts: string[]): string {
  return parts.map((part) => `${part.length}:${part.toLocaleLowerCase().trim()}`).join("|");
}

export function parseRelativePostedAt(label: string | null | undefined, anchor: string) {
  if (!label) return null;
  const match = label.trim().match(/^(\d+)\s*(minute|hour|day)s?\s+ago$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLocaleLowerCase();
  const anchorDate = new Date(anchor);
  if (!Number.isFinite(amount) || Number.isNaN(anchorDate.getTime())) return null;
  const multiplier = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  return new Date(anchorDate.getTime() - amount * multiplier).toISOString();
}
