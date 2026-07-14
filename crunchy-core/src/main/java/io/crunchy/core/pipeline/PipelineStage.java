package io.crunchy.core.pipeline;

/** One deterministic step of the compression pipeline. */
public interface PipelineStage {

    /** Human-readable stage name, used in diagnostics. */
    String name();

    void process(ProcessingContext context);
}
