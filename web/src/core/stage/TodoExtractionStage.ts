import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { normalizeForComparison, sentences } from '../text/TextUtil.js';

/** Stage 6: open work items — TODO/FIXME markers and follow-up phrasing. */
const TODO =
  /\b(todo|fixme|follow[- ]up|still pending|remaining work|remains to|yet to be|we still need|need(?:s)? to (?:add|implement|write|update|fix|migrate|document|test))\b/i;

export class TodoExtractionStage implements PipelineStage {
  readonly name = 'todo-extraction';

  process(context: ProcessingContext): void {
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      for (const sentence of sentences(block.text)) {
        if (TODO.test(sentence)) {
          block.categories.add(Category.TODO);
          const cleaned = sentence.replace(/^(todo|fixme)\s*[:\-]\s*/i, '');
          this.addUnique(context, cleaned);
        }
      }
    }
  }

  private addUnique(context: ProcessingContext, value: string): void {
    const normalized = normalizeForComparison(value);
    const exists = context.result.todos.some((v) => normalizeForComparison(v) === normalized);
    if (!exists) {
      context.result.todos.push(value);
    }
  }
}
