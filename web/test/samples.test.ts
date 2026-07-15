import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseJiraIssue } from '../src/connector/jira/JiraIssueParser.js';
import { CompressionLevel } from '../src/core/model/CompressionLevel.js';
import { CompressionPipeline } from '../src/core/pipeline/CompressionPipeline.js';

/**
 * Every bundled demo ticket must parse and compress into a useful CIR. This
 * guards against a hand-authored sample whose phrasing quietly stops matching
 * the extractors. Domains are intentionally non-finance (healthcare, insurance,
 * logistics, plus the generic payments webhook example).
 */
const SAMPLES = [
  'messy-issue.json',
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
});
