import { Block, Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { normalizeForComparison, sentences } from '../text/TextUtil.js';

/**
 * Stage 5: collects acceptance criteria from three shapes commonly found in
 * Jira — "Acceptance Criteria"/"Definition of Done" sections, Gherkin-style
 * Given/When/Then lines, and checkbox lists. Standalone "must/should"
 * requirement sentences are captured as constraints.
 */
const SECTION_HEADING =
  /^\s*(?:h\d\.\s*|#{1,6}\s*|\*{0,2})\s*(acceptance criteria|definition of done|dod)\b.*$/i;
const GHERKIN_LINE = /^\s*(?:[-*]\s*)?(given|when|then|and)\b\s+.+$/i;
const LIST_ITEM = /^\s*(?:[-*+]\s*(?:\[[ xX]\]\s*)?|\d+[.)]\s+)(.+)$/;
const REQUIREMENT_SENTENCE = /\b(must(?: not)?|shall|should(?: not)?|is required to|has to)\b/i;

export class AcceptanceCriteriaExtractionStage implements PipelineStage {
  readonly name = 'acceptance-criteria-extraction';

  process(context: ProcessingContext): void {
    for (const block of context.blocks) {
      if (block.dropped) {
        continue;
      }
      let found = this.extractFromSections(context, block);
      found = this.extractGherkin(context, block) || found;
      if (found) {
        block.categories.add(Category.ACCEPTANCE_CRITERIA);
      }
      this.extractConstraints(context, block);
    }
  }

  private extractFromSections(context: ProcessingContext, block: Block): boolean {
    const lines = block.text.split(/\r?\n/);
    let inSection = false;
    let found = false;
    for (const line of lines) {
      if (SECTION_HEADING.test(line)) {
        inSection = true;
        continue;
      }
      if (!inSection) {
        continue;
      }
      const item = LIST_ITEM.exec(line);
      if (item) {
        this.addUnique(context.result.acceptanceCriteria, item[1].trim());
        found = true;
      } else if (line.trim().length > 0 && !GHERKIN_LINE.test(line)) {
        inSection = false; // prose after the list ends the section
      }
    }
    return found;
  }

  private extractGherkin(context: ProcessingContext, block: Block): boolean {
    let scenario: string[] = [];
    let found = false;

    // A real scenario spans at least two clauses (Given/When/Then). A single
    // line is ordinary prose that happens to open with "When…" or "And…", not
    // an acceptance criterion.
    const flush = (): void => {
      if (scenario.length >= 2) {
        this.addUnique(context.result.acceptanceCriteria, scenario.join(' '));
        found = true;
      }
      scenario = [];
    };

    for (const line of block.text.split(/\r?\n/)) {
      if (GHERKIN_LINE.test(line)) {
        scenario.push(line.trim().replace(/^[-*]\s*/, ''));
      } else {
        flush();
      }
    }
    flush();
    return found;
  }

  private extractConstraints(context: ProcessingContext, block: Block): void {
    for (const sentence of sentences(block.text)) {
      if (
        REQUIREMENT_SENTENCE.test(sentence) &&
        !this.coveredByAcceptanceCriteria(context, sentence)
      ) {
        block.categories.add(Category.CONSTRAINT);
        this.addUnique(context.result.constraints, sentence);
      }
    }
  }

  /** Avoids re-listing a requirement that already appears as an AC item. */
  private coveredByAcceptanceCriteria(context: ProcessingContext, sentence: string): boolean {
    const normalized = normalizeForComparison(sentence);
    return context.result.acceptanceCriteria
      .map(normalizeForComparison)
      .some((ac) => normalized.includes(ac) || ac.includes(normalized));
  }

  private addUnique(target: string[], value: string): void {
    const normalized = normalizeForComparison(value);
    const exists = target.some((v) => normalizeForComparison(v) === normalized);
    if (!exists) {
      target.push(value);
    }
  }
}
