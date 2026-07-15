import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { sentences } from '../text/TextUtil.js';

/**
 * Stage 4: pulls architecture/technology decisions out of prose. Sentences
 * matching a decision pattern land in {@code decisions}; explicit rejections
 * are kept too ("Rejected: Memcached") because knowing what NOT to use is as
 * valuable to a coding agent as knowing what to use.
 */
const DECISION =
  /\b(decided to|decision:|final decision|we(?:'ll| will| should) (?:use|go with|adopt|switch to)|let'?s (?:use|go with|adopt)|going with|agreed (?:on|to)|we chose|settled on)\b/i;
const REJECTION =
  /\b(rejected|won'?t use|will not use|ruled out|decided against|dropping|not going with|instead of)\b/i;
const ARCHITECTURE_HINT =
  /\b(architecture|service|microservice|gateway|queue|topic|database|schema|cache|endpoint|api|event|stream|partition|shard|cluster|deployment|container)\b/i;

export class DecisionExtractionStage implements PipelineStage {
  readonly name = 'decision-extraction';

  process(context: ProcessingContext): void {
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      for (const sentence of sentences(block.text)) {
        const decision = DECISION.test(sentence);
        const rejection = REJECTION.test(sentence);
        if (decision || rejection) {
          context.addExtract('decisions', sentence, Category.DECISION, block);
          if (ARCHITECTURE_HINT.test(sentence)) {
            block.categories.add(Category.ARCHITECTURE);
          }
        }
      }
    }
  }
}
