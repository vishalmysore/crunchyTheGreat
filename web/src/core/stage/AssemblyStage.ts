import { CompressedContext } from '../model/CompressedContext.js';
import { Category } from '../pipeline/Block.js';
import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';
import { normalizeForComparison, sentences } from '../text/TextUtil.js';

/**
 * Final stage: assembles the CIR document — summary, business goal,
 * architecture notes, related issues, ignored-content report, confidence and
 * the measured compression ratio.
 */
const ISSUE_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/g;
const BUSINESS_GOAL_SENTENCE =
  /\b(so that|in order to|business goal|objective|the goal is)\b/i;

export class AssemblyStage implements PipelineStage {
  readonly name = 'assembly';

  process(context: ProcessingContext): void {
    const result = context.result;
    const document = context.document;

    result.issue = `${document.key} ${document.title}`.trim();
    result.summary = this.buildSummary(context);
    result.businessGoal = this.findBusinessGoal(context);
    this.collectArchitecture(context);
    this.collectRelatedIssues(context);
    result.ignoredContent.push(...context.ignoredContent);
    result.confidence = this.confidence(result);
    result.compressionRatio = this.compressionRatio(context);
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

  private findBusinessGoal(context: ProcessingContext): string {
    for (const block of context.liveBlocks()) {
      for (const sentence of sentences(block.text)) {
        if (BUSINESS_GOAL_SENTENCE.test(sentence)) {
          return sentence;
        }
      }
    }
    return '';
  }

  private collectArchitecture(context: ProcessingContext): void {
    for (const block of context.liveBlocks()) {
      if (!block.categories.has(Category.ARCHITECTURE)) {
        continue;
      }
      const text = block.text;
      // Keep architecture entries sentence-sized, not whole paragraphs.
      for (const sentence of sentences(text)) {
        if (!context.result.decisions.some((d) => d === sentence)) {
          continue;
        }
        this.addUnique(context, sentence);
      }
      if (context.result.architecture.length === 0) {
        this.addUnique(context, sentences(text)[0]);
      }
    }
  }

  private addUnique(context: ProcessingContext, value: string): void {
    const normalized = normalizeForComparison(value);
    const exists = context.result.architecture.some(
      (v) => normalizeForComparison(v) === normalized,
    );
    if (!exists) {
      context.result.architecture.push(value);
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
    if (result.businessGoal.trim().length > 0) confidence += 0.05;
    return Math.min(0.95, this.round2(confidence));
  }

  private compressionRatio(context: ProcessingContext): number {
    const original = context.document.rawLength();
    if (original === 0) {
      return 0.0;
    }
    let compressed = 0;
    for (const b of context.liveBlocks()) {
      compressed += b.text.length;
    }
    return this.round2(Math.max(0.0, 1.0 - compressed / original));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
