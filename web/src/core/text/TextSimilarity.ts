import { normalizeForComparison } from './TextUtil.js';

/** Near-duplicate detection via Jaccard similarity over word sets. */
export const NEAR_DUPLICATE_THRESHOLD = 0.75;

function shingles(text: string): Set<string> {
  const normalized = normalizeForComparison(text);
  const words = new Set<string>();
  if (normalized.length > 0) {
    for (const word of normalized.split(' ')) {
      words.add(word);
    }
  }
  return words;
}

export function jaccard(a: string, b: string): number {
  const shinglesA = shingles(a);
  const shinglesB = shingles(b);
  if (shinglesA.size === 0 && shinglesB.size === 0) {
    return normalizeForComparison(a) === normalizeForComparison(b) ? 1.0 : 0.0;
  }
  if (shinglesA.size === 0 || shinglesB.size === 0) {
    return 0.0;
  }
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) {
      intersection++;
    }
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return intersection / union;
}

export function nearDuplicate(a: string, b: string): boolean {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);
  if (na === nb) {
    return true;
  }
  // One text fully containing a short other text counts as a repeat.
  if (na.length > 20 && nb.length > 20 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return jaccard(a, b) >= NEAR_DUPLICATE_THRESHOLD;
}
