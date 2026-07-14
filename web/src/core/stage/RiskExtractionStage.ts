import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { normalizeForComparison, sentences } from '../text/TextUtil.js';

/**
 * Stage 7: surfaces risks (security, performance, migration, known issues)
 * and hard dependencies/blockers as separate CIR lists.
 */
const RISK =
  /\b(risk|risky|security|vulnerab\w+|injection|xss|csrf|data loss|race condition|performance|latency|slow|memory leak|timeout|scalab\w+|migration|breaking change|known issue|tech debt|concern|caveat|edge case|backwards? compat\w*)\b/i;
const DEPENDENCY =
  /\b(depends on|dependency|blocked (?:by|on)|blocker|waiting (?:on|for)|requires? (?:the )?(?:[A-Z][\w-]+ )?(?:team|service|api|library|upgrade|approval))\b/i;

export class RiskExtractionStage implements PipelineStage {
  readonly name = 'risk-extraction';

  process(context: ProcessingContext): void {
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      for (const sentence of sentences(block.text)) {
        if (DEPENDENCY.test(sentence)) {
          block.categories.add(Category.DEPENDENCY);
          this.addUnique(context.result.dependencies, sentence);
        } else if (RISK.test(sentence)) {
          block.categories.add(Category.RISK);
          this.addUnique(context.result.risks, sentence);
        }
      }
    }
  }

  private addUnique(target: string[], value: string): void {
    const normalized = normalizeForComparison(value);
    const exists = target.some((v) => normalizeForComparison(v) === normalized);
    if (!exists) {
      target.push(value);
    }
  }
}
