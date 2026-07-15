/**
 * Lazy tiktoken. Until the encoder is ready, callers get the length/4
 * approximation (within ~5% for English prose), so the first paint never waits
 * on it. Adapted from the ragCompressionDemo/headroom-demo tokenizer.
 */
type Encoder = { encode(text: string): unknown[] };

let enc: Encoder | null = null;
let loading: Promise<void> | null = null;

/** Kick off loading in the background; safe to call repeatedly. */
export function preloadTokenizer(): void {
  if (enc || loading) return;
  loading = import('js-tiktoken')
    .then(({ getEncoding }) => {
      enc = getEncoding('cl100k_base') as unknown as Encoder;
    })
    .catch(() => {
      /* silent — the approximation stays active */
    });
}

/** Real token count once tiktoken is loaded, otherwise a fast approximation. */
export function countTokens(text: string): number {
  if (enc) {
    try {
      return enc.encode(text).length;
    } catch {
      /* fall through to approximation */
    }
  }
  return Math.ceil(text.length / 4);
}

/** True once counts are exact rather than approximate. */
export function tokenizerReady(): boolean {
  return enc !== null;
}
