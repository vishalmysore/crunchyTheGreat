import { Block } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';

/**
 * Splits every surviving source text into paragraph blocks. List items stay
 * attached to the paragraph that introduces them so that extraction stages see
 * headings ("Acceptance Criteria") together with their items.
 */
export class BlockSplittingStage implements PipelineStage {
  readonly name = 'block-splitting';

  process(context: ProcessingContext): void {
    for (const source of context.sources) {
      if (source.removed) {
        continue;
      }
      for (const paragraph of source.text.split(/\n\s*\n/)) {
        const trimmed = paragraph.trim();
        if (trimmed.length > 0) {
          context.blocks.push(new Block(trimmed, source.origin, source.author));
        }
      }
    }
  }
}
