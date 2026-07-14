package io.crunchy.core.compress;

import io.crunchy.core.model.CompressedContext;

/**
 * Optional stage 9: an LLM-backed pass that rewrites the deterministic CIR
 * into tighter prose without losing requirements, architecture, constraints,
 * acceptance criteria or risks. Implementations wrap WebLLM, Ollama, OpenAI,
 * Claude or any OpenAI-compatible endpoint. The deterministic pipeline never
 * depends on this interface being implemented.
 */
public interface SemanticCompressor {

    CompressedContext compress(CompressedContext deterministic);

    /** Default provider: pass-through, keeps the pipeline fully offline. */
    static SemanticCompressor noOp() {
        return deterministic -> deterministic;
    }
}
