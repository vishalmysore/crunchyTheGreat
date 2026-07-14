package io.crunchy.core.pipeline;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;
import io.crunchy.core.stage.AcceptanceCriteriaExtractionStage;
import io.crunchy.core.stage.AssemblyStage;
import io.crunchy.core.stage.BlockSplittingStage;
import io.crunchy.core.stage.DecisionExtractionStage;
import io.crunchy.core.stage.DuplicateDetectionStage;
import io.crunchy.core.stage.HtmlCleaningStage;
import io.crunchy.core.stage.NoiseFilterStage;
import io.crunchy.core.stage.RankingStage;
import io.crunchy.core.stage.RiskExtractionStage;
import io.crunchy.core.stage.TodoExtractionStage;

import java.util.List;

/**
 * Orchestrates the deterministic compression stages. The default pipeline
 * needs no LLM; a semantic compressor can be layered on top of the CIR output.
 */
public final class CompressionPipeline {

    private final List<PipelineStage> stages;

    public CompressionPipeline(List<PipelineStage> stages) {
        this.stages = List.copyOf(stages);
    }

    public static CompressionPipeline standard() {
        return new CompressionPipeline(List.of(
                new HtmlCleaningStage(),
                new NoiseFilterStage(),
                new BlockSplittingStage(),
                new DuplicateDetectionStage(),
                new DecisionExtractionStage(),
                new AcceptanceCriteriaExtractionStage(),
                new TodoExtractionStage(),
                new RiskExtractionStage(),
                new RankingStage(),
                new AssemblyStage()
        ));
    }

    public CompressedContext process(NormalizedDocument document, CompressionLevel level) {
        ProcessingContext context = new ProcessingContext(document, level);
        for (PipelineStage stage : stages) {
            stage.process(context);
        }
        return context.getResult();
    }
}
