import { CompressedContext } from '../model/CompressedContext.js';
import { CompressionLevel } from '../model/CompressionLevel.js';
import { NormalizedDocument } from '../model/NormalizedDocument.js';
import { AcceptanceCriteriaExtractionStage } from '../stage/AcceptanceCriteriaExtractionStage.js';
import { AssemblyStage } from '../stage/AssemblyStage.js';
import { BlockSplittingStage } from '../stage/BlockSplittingStage.js';
import { DecisionExtractionStage } from '../stage/DecisionExtractionStage.js';
import { DuplicateDetectionStage } from '../stage/DuplicateDetectionStage.js';
import { HtmlCleaningStage } from '../stage/HtmlCleaningStage.js';
import { NoiseFilterStage } from '../stage/NoiseFilterStage.js';
import { RankingStage } from '../stage/RankingStage.js';
import { RiskExtractionStage } from '../stage/RiskExtractionStage.js';
import { TodoExtractionStage } from '../stage/TodoExtractionStage.js';
import { PipelineStage } from './PipelineStage.js';
import { ProcessingContext } from './ProcessingContext.js';

/**
 * Orchestrates the deterministic compression stages. The default pipeline
 * needs no LLM; a semantic compressor can be layered on top of the CIR output.
 */
export class CompressionPipeline {
  private readonly stages: readonly PipelineStage[];

  constructor(stages: PipelineStage[]) {
    this.stages = [...stages];
  }

  static standard(): CompressionPipeline {
    return new CompressionPipeline([
      new HtmlCleaningStage(),
      new NoiseFilterStage(),
      new BlockSplittingStage(),
      new DuplicateDetectionStage(),
      new DecisionExtractionStage(),
      new AcceptanceCriteriaExtractionStage(),
      new TodoExtractionStage(),
      new RiskExtractionStage(),
      new RankingStage(),
      new AssemblyStage(),
    ]);
  }

  process(document: NormalizedDocument, level: CompressionLevel): CompressedContext {
    const context = new ProcessingContext(document, level);
    for (const stage of this.stages) {
      stage.process(context);
    }
    return context.result;
  }
}
