import { CompressedContext } from '../model/CompressedContext.js';
import { levelThreshold } from '../model/CompressionLevel.js';
import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { CirListName, ProcessingContext } from '../pipeline/ProcessingContext.js';
import { weightOf } from '../pipeline/Weights.js';
import { nearDuplicate } from '../text/TextSimilarity.js';
import { sentences } from '../text/TextUtil.js';

/**
 * Final stage: assembles the CIR document.
 *
 * This is where the compression level actually bites. Extraction ran earlier
 * and only *recorded* candidates; here each one is admitted to the output only
 * if its category weight clears the level's threshold. That is what makes
 * TINY genuinely smaller than FULL rather than merely differently reported.
 */
// The trailing (?!-) stops us matching a prefix of a longer identifier: real
// Kafka tickets cite CVE-2019-12399, and without it we'd file "CVE-2019" as a
// related Jira issue.
const ISSUE_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b(?!-)/g;
const BUSINESS_GOAL_SENTENCE = /\b(so that|in order to|business goal|objective|the goal is)\b/i;

const LISTS: CirListName[] = [
  'decisions',
  'constraints',
  'acceptanceCriteria',
  'risks',
  'todos',
  'dependencies',
];

export class AssemblyStage implements PipelineStage {
  readonly name = 'assembly';

  process(context: ProcessingContext): void {
    const result = context.result;
    const document = context.document;

    result.issue = `${document.key} ${document.title}`.trim();
    result.summary = this.buildSummary(context);
    result.businessGoal = this.findBusinessGoal(context, result.summary);
    this.collectLists(context);
    this.collectArchitecture(context);
    this.collectRelatedIssues(context);
    result.ignoredContent.push(...context.ignoredContent);
    result.confidence = this.confidence(result);
    result.compressionRatio = this.compressionRatio(context);
  }

  /** Admits extracts whose category clears the level threshold, collapsing near-duplicates. */
  private collectLists(context: ProcessingContext): void {
    const threshold = levelThreshold(context.level);
    for (const list of LISTS) {
      const target = context.result[list];
      for (const extract of context.extracts) {
        if (extract.list !== list || weightOf(extract.category) < threshold) {
          continue;
        }
        this.addUnique(target, extract.text);
      }
    }
  }

  /**
   * Adds a value unless the list already says the same thing. When a near
   * duplicate is longer (and so more informative) it replaces the incumbent —
   * "Let's use SQS." should not survive alongside
   * "For ingestion, let's use SQS FIFO queues per carrier."
   */
  private addUnique(target: string[], value: string): void {
    for (let i = 0; i < target.length; i++) {
      if (nearDuplicate(target[i], value)) {
        if (value.length > target[i].length) {
          target[i] = value;
        }
        return;
      }
    }
    target.push(value);
  }

  private buildSummary(context: ProcessingContext): string {
    // First surviving description block, capped at two sentences.
    for (const block of context.liveBlocks()) {
      if (block.origin === 'description') {
        const s = sentences(block.text);
        return s.slice(0, Math.min(2, s.length)).join(' ');
      }
    }
    return context.document.title;
  }

  /** Omitted when the summary already states it — no point paying twice. */
  private findBusinessGoal(context: ProcessingContext, summary: string): string {
    for (const block of context.liveBlocks()) {
      for (const sentence of sentences(block.text)) {
        if (BUSINESS_GOAL_SENTENCE.test(sentence)) {
          return summary.includes(sentence) || nearDuplicate(summary, sentence) ? '' : sentence;
        }
      }
    }
    return '';
  }

  /** Architecture notes that the decisions list does not already carry. */
  private collectArchitecture(context: ProcessingContext): void {
    if (levelThreshold(context.level) > weightOf(Category.ARCHITECTURE)) {
      return;
    }
    const decisions = context.result.decisions;
    for (const block of context.liveBlocks()) {
      if (!block.categories.has(Category.ARCHITECTURE)) {
        continue;
      }
      for (const sentence of sentences(block.text)) {
        if (decisions.some((d) => nearDuplicate(d, sentence))) {
          continue;
        }
        if (block.categories.has(Category.DECISION)) {
          continue; // the decisions list is the canonical home
        }
        this.addUnique(context.result.architecture, sentence);
      }
    }
  }

  private collectRelatedIssues(context: ProcessingContext): void {
    const keys = new Set<string>();
    const ownKey = context.document.key;
    for (const m of context.document.title.matchAll(ISSUE_KEY)) {
      keys.add(m[1]);
    }
    for (const block of context.liveBlocks()) {
      for (const m of block.text.matchAll(ISSUE_KEY)) {
        keys.add(m[1]);
      }
    }
    const linked = context.document.metadata.get('linkedIssues');
    if (linked && linked.trim().length > 0) {
      for (const key of linked.split(',')) {
        keys.add(key.trim());
      }
    }
    keys.delete(ownKey);
    context.result.relatedIssues.push(...keys);
  }

  private confidence(result: CompressedContext): number {
    let confidence = 0.5;
    if (result.summary.trim().length > 0) confidence += 0.1;
    if (result.decisions.length > 0) confidence += 0.15;
    if (result.acceptanceCriteria.length > 0) confidence += 0.15;
    if (result.businessGoal.trim().length > 0 || result.summary.trim().length > 0) confidence += 0.05;
    return Math.min(0.95, this.round2(confidence));
  }

  /**
   * Measured against the text the agent actually receives — every string the
   * CIR emits — not against surviving blocks. An honest number here is worth
   * more than a flattering one.
   */
  private compressionRatio(context: ProcessingContext): number {
    const original = context.document.rawLength();
    if (original === 0) {
      return 0.0;
    }
    const r = context.result;
    let emitted = r.issue.length + r.summary.length + r.businessGoal.length;
    for (const list of [...LISTS, 'architecture' as const, 'relatedIssues' as const]) {
      for (const item of r[list]) {
        emitted += item.length;
      }
    }
    return this.round2(Math.max(0.0, 1.0 - emitted / original));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
