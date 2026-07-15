import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseJiraIssue } from '../src/connector/jira/JiraIssueParser.js';
import { CompressionLevel } from '../src/core/model/CompressionLevel.js';
import { CompressionPipeline } from '../src/core/pipeline/CompressionPipeline.js';
import { toMarkdown } from '../src/core/export/MarkdownExporter.js';

/**
 * Every bundled synthetic ticket must parse and compress into a useful CIR.
 * This guards against a hand-authored sample whose phrasing quietly stops
 * matching the extractors. Domains are intentionally non-finance.
 */
const SAMPLES = [
  'healthcare-issue.json',
  'insurance-issue.json',
  'logistics-issue.json',
];

/**
 * Real Apache tickets, held to a deliberately weaker bar. They compress much
 * harder than the synthetic ones (87-91% vs ~33%), but they carry no
 * "Acceptance Criteria" heading and almost no "let's use X" decision sentence,
 * so the extractors barely fire. That gap is real and known — these tests
 * record today's behaviour rather than pretend otherwise, and should tighten
 * as the heuristics learn real-world phrasing.
 */
const REAL_SAMPLES = ['real-kafka-9366.json', 'real-spark-40588.json'];

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

describe.each(REAL_SAMPLES)('real Apache sample %s', (file) => {
  const doc = load(file);
  const result = CompressionPipeline.standard().process(doc, CompressionLevel.FULL);

  it('parses a real Jira payload', () => {
    expect(doc.key).toMatch(/^[A-Z]+-\d+$/);
    expect(doc.comments.length).toBeGreaterThan(5);
  });

  it('compresses hard — this is what a noisy real ticket looks like', () => {
    expect(result.compressionRatio).toBeGreaterThanOrEqual(0.8);
  });

  it('never reports a CVE id as a related Jira issue', () => {
    expect(result.relatedIssues.some((k) => k.startsWith('CVE'))).toBe(false);
  });

  it('produces a brief that is not empty', () => {
    expect(result.summary.trim().length).toBeGreaterThan(0);
  });
});
