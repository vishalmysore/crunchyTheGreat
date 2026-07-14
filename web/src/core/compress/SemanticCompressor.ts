import { CompressedContext } from '../model/CompressedContext.js';

/**
 * Optional stage 9: an LLM-backed pass that rewrites the deterministic CIR
 * into tighter prose without losing requirements, architecture, constraints,
 * acceptance criteria or risks. Implementations wrap WebLLM, Ollama, OpenAI,
 * Claude or any OpenAI-compatible endpoint. The deterministic pipeline never
 * depends on this interface being implemented.
 */
export interface SemanticCompressor {
  compress(deterministic: CompressedContext): CompressedContext | Promise<CompressedContext>;
}

/** Default provider: pass-through, keeps the pipeline fully offline. */
export const noOpCompressor: SemanticCompressor = {
  compress: (deterministic) => deterministic,
};
