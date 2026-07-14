/**
 * How aggressively low-scoring content is discarded. The threshold is the
 * minimum rank score a block needs to survive into the compressed output.
 */
export enum CompressionLevel {
  TINY = 'TINY',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  FULL = 'FULL',
}

const THRESHOLDS: Record<CompressionLevel, number> = {
  [CompressionLevel.TINY]: 0.9,
  [CompressionLevel.SMALL]: 0.75,
  [CompressionLevel.MEDIUM]: 0.5,
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
