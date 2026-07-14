// Newlines always end a sentence: Jira content is line-structured (list items,
// Gherkin lines) and rarely punctuated at line ends.
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z"'(\[])|\n+/;

/** Lowercase, drop apostrophes, strip punctuation, collapse whitespace — comparisons only. */
export function normalizeForComparison(text: string): string {
  // Apostrophes are deleted (not spaced) so "let's" and "lets" compare equal.
  const lower = text.toLowerCase().replace(/['’]/g, '');
  return lower.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sentences(paragraph: string): string[] {
  return paragraph
    .trim()
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** True when the text looks like a log dump or stack trace rather than prose. */
export function looksLikeLogDump(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (lines.length < 3) {
    return false;
  }
  let logLike = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0) {
      continue;
    }
    if (
      t.startsWith('at ') ||
      t.startsWith('Caused by:') ||
      /^\d{4}-\d{2}-\d{2}[T ].*$/.test(t) ||
      /^\[?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\]?\b.*$/.test(t) ||
      /^\w+(\.\w+)+(Exception|Error)(:.*)?$/.test(t)
    ) {
      logLike++;
    }
  }
  return logLike >= Math.max(3, Math.floor(lines.length * 0.5));
}
