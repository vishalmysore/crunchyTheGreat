import { Block } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { nearDuplicate } from '../text/TextSimilarity.js';

/**
 * Stage 3: exact and near-duplicate blocks collapse into the first occurrence,
 * which records how often the point was repeated (a useful emphasis signal for
 * ranking).
 */
export class DuplicateDetectionStage implements PipelineStage {
  readonly name = 'duplicate-detection';

  process(context: ProcessingContext): void {
    const kept: Block[] = [];
    let duplicates = 0;
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      const original = this.findDuplicate(kept, block);
      if (original) {
        original.incrementDuplicates();
        block.drop(`duplicate of ${original.origin}`);
        duplicates++;
      } else {
        kept.push(block);
      }
    }
    if (duplicates > 0) {
      context.ignoredContent.push(`${duplicates} duplicate/near-duplicate paragraph(s) collapsed`);
    }
  }

  private findDuplicate(kept: Block[], candidate: Block): Block | undefined {
    return kept.find((existing) => nearDuplicate(existing.text, candidate.text));
  }
}
