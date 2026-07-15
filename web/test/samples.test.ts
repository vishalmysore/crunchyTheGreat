import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseJiraIssue } from '../src/connector/jira/JiraIssueParser.js';
import { CompressionLevel } from '../src/core/model/CompressionLevel.js';
import { CompressionPipeline } from '../src/core/pipeline/CompressionPipeline.js';
import { toMarkdown } from '../src/core/export/MarkdownExporter.js';

/**
 * Every bundled demo ticket must parse and compress into a useful CIR. This
 * guards against a hand-authored sample whose phrasing quietly stops matching
 * the extractors. Domains are intentionally non-finance.
 */
const SAMPLES = [
  'healthcare-issue.json',
  'insurance-issue.json',
  'logistics-issue.json',
];

function load(file: string) {
  const path = fileURLToPath(new URL(`../public/${file}`, import.meta.url));
  return parseJiraIssue(readFileSync(path, 'utf8'));
}

describe.each(SAMPLES)('sample %s', (file) => {
  const doc = load(file);
  const result = CompressionPipeline.standard().process(doc, CompressionLevel.FULL);

  it('parses into a normalized document with comments', () => {
    expect(doc.key).not.toBe('');
    expect(doc.comments.length).toBeGreaterThan(0);
  });

  it('extracts decisions and acceptance criteria', () => {
    expect(result.decisions.length).toBeGreaterThanOrEqual(1);
    expect(result.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
  });

  it('captures at least one risk or dependency', () => {
    expect(result.risks.length + result.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('removes and reports noise (bots, dupes, logs, greetings)', () => {
    expect(result.ignoredContent.length).toBeGreaterThanOrEqual(1);
    expect(result.ignoredContent.some((i) => i.toLowerCase().includes('log'))).toBe(true);
    expect(result.ignoredContent.some((i) => i.includes('duplicate'))).toBe(true);
  });

  it('compresses meaningfully with high confidence', () => {
    // Full fidelity keeps everything except detected noise, so the floor is
    // modest; the tighter levels are where big reductions happen.
    expect(result.compressionRatio).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('compresses harder at the tiny level than at full', () => {
    const tiny = CompressionPipeline.standard().process(doc, CompressionLevel.TINY);
    expect(tiny.compressionRatio).toBeGreaterThan(result.compressionRatio);
    expect(tiny.compressionRatio).toBeGreaterThanOrEqual(0.6);
  });

  // Regression guard: levels once reported different ratios while emitting
  // identical content, so tiny could even be larger than full.
  it('emits strictly less content as the level tightens', () => {
    const emitted = (level: CompressionLevel): number =>
      toMarkdown(CompressionPipeline.standard().process(doc, level)).length;

    const full = emitted(CompressionLevel.FULL);
    const medium = emitted(CompressionLevel.MEDIUM);
    const small = emitted(CompressionLevel.SMALL);
    const tiny = emitted(CompressionLevel.TINY);

    expect(tiny).toBeLessThan(small);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(full);
  });

  it('keeps decisions and acceptance criteria at every level', () => {
    for (const level of [
      CompressionLevel.FULL,
      CompressionLevel.MEDIUM,
      CompressionLevel.SMALL,
      CompressionLevel.TINY,
    ]) {
      const cir = CompressionPipeline.standard().process(doc, level);
      expect(cir.decisions.length, `decisions at ${level}`).toBeGreaterThanOrEqual(1);
      expect(cir.acceptanceCriteria.length, `criteria at ${level}`).toBeGreaterThanOrEqual(3);
    }
  });
});
