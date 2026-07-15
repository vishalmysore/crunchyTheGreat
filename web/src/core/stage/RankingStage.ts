import { Block, Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { levelThreshold } from '../model/CompressionLevel.js';
import { looksLikeLogDump } from '../text/TextUtil.js';
import { DEFAULT_WEIGHT, WEIGHTS } from '../pipeline/Weights.js';

/**
 * Stage 8: every block gets a value score; blocks under the compression
 * level's threshold are dropped. This governs the prose-derived fields
 * (summary, business goal, architecture); the assembly stage gates the
 * extracted CIR lists by the same thresholds.
 */
const BUSINESS_GOAL =
  /\b(so that|in order to|business goal|objective|the goal is|customers? (?:want|need)|revenue|compliance)\b/i;

export class RankingStage implements PipelineStage {
  readonly name = 'ranking';

  process(context: ProcessingContext): void {
    let dropped = 0;
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      if (BUSINESS_GOAL.test(block.text)) {
        block.categories.add(Category.BUSINESS_GOAL);
      }
      if (looksLikeLogDump(block.text)) {
        block.categories.add(Category.NOISE);
      }
      if (block.categories.size === 0) {
        block.categories.add(Category.DISCUSSION);
      }
      block.score = this.score(block);
      if (block.score < levelThreshold(context.level)) {
        block.drop(`below rank threshold (${block.score})`);
        dropped++;
      }
    }
    if (dropped > 0) {
      context.ignoredContent.push(
        `${dropped} low-value paragraph(s) dropped below the ${context.level.toLowerCase()} threshold`,
      );
    }
  }

  private score(block: Block): number {
    if (block.categories.has(Category.NOISE)) {
      return WEIGHTS[Category.NOISE];
    }
    let best = DEFAULT_WEIGHT;
    for (const c of block.categories) {
      best = Math.max(best, WEIGHTS[c] ?? DEFAULT_WEIGHT);
    }
    // Repetition is an emphasis signal: a point made three times mattered to
    // the team even if phrased as plain discussion.
    const repetitionBoost = Math.min(0.1, (block.duplicateCount - 1) * 0.05);
    return Math.min(0.99, best + repetitionBoost);
  }
}
