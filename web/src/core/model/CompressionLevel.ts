/**
 * How aggressively low-scoring content is discarded. The threshold is the
 * minimum value score content needs to survive into the compressed output,
 * and it gates whole CIR sections by category weight:
 *
 *   TINY   0.90  decisions + acceptance criteria (the irreducible brief)
 *   SMALL  0.86  + constraints
 *   MEDIUM 0.84  + risks
 *   FULL   0.00  + dependencies, todos — everything except detected noise
 */
export enum CompressionLevel {
  TINY = 'TINY',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  FULL = 'FULL',
}

const THRESHOLDS: Record<CompressionLevel, number> = {
  [CompressionLevel.TINY]: 0.9,
  [CompressionLevel.SMALL]: 0.86,
  [CompressionLevel.MEDIUM]: 0.84,
  [CompressionLevel.FULL]: 0.0,
};

export function levelThreshold(level: CompressionLevel): number {
  return THRESHOLDS[level];
}

export function parseLevel(text: string): CompressionLevel {
  const upper = text.toUpperCase();
  if (upper in CompressionLevel) {
    return CompressionLevel[upper as keyof typeof CompressionLevel];
  }
  throw new Error(`Unknown compression level: ${text}`);
}
