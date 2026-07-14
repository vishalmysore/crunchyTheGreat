import { ProcessingContext } from './ProcessingContext.js';

/** One deterministic step of the compression pipeline. */
export interface PipelineStage {
  /** Human-readable stage name, used in diagnostics. */
  readonly name: string;

  process(context: ProcessingContext): void;
}
