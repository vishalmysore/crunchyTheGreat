import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { sentences } from '../text/TextUtil.js';

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
          const cleaned = sentence.replace(/^(todo|fixme)\s*[:\-]\s*/i, '');
          context.addExtract('todos', cleaned, Category.TODO, block);
        }
      }
    }
  }
}
