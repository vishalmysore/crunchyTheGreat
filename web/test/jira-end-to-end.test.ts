import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseJiraIssue } from '../src/connector/jira/JiraIssueParser.js';
import { NormalizedDocument } from '../src/core/model/NormalizedDocument.js';
import { CompressedContext } from '../src/core/model/CompressedContext.js';
import { CompressionLevel } from '../src/core/model/CompressionLevel.js';
import { CompressionPipeline } from '../src/core/pipeline/CompressionPipeline.js';

/**
 * Full-path test: messy Jira JSON export -> connector -> pipeline -> CIR.
 * Uses the sample under public/ so the web UI and the test exercise the same
 * fixture.
 */
let result: CompressedContext;
let document_: NormalizedDocument;

beforeAll(() => {
  const path = fileURLToPath(new URL('../public/messy-issue.json', import.meta.url));
  document_ = parseJiraIssue(readFileSync(path, 'utf8'));
  result = CompressionPipeline.standard().process(document_, CompressionLevel.FULL);
});

describe('Jira end to end', () => {
  it('normalizes the issue', () => {
    expect(document_.key).toBe('PAY-1421');
    expect(document_.comments.length).toBe(12);
    expect(document_.comments[3].bot).toBe(true); // Jenkins CI
    expect(document_.metadata.get('status')).toBe('In Progress');
  });

  it('keeps decisions including rejections', () => {
    expect(result.decisions.some((d) => d.includes('Kafka'))).toBe(true);
    expect(result.decisions.some((d) => d.includes('RabbitMQ'))).toBe(true);
    expect(result.decisions.some((d) => d.includes('Redis'))).toBe(true);
  });

  it('captures complete acceptance criteria', () => {
    expect(result.acceptanceCriteria.length).toBeGreaterThanOrEqual(4);
    expect(result.acceptanceCriteria.some((a) => a.includes('HMAC'))).toBe(true);
  });

  it('captures risks, todos and dependencies', () => {
    expect(result.risks.some((r) => r.toLowerCase().includes('retry storm'))).toBe(true);
    expect(result.todos.some((t) => t.includes('allowlist'))).toBe(true);
    expect(result.dependencies.some((d) => d.includes('PLAT-77'))).toBe(true);
  });

  it('lists related issues from text and links', () => {
    expect(result.relatedIssues).toContain('PAY-1388');
    expect(result.relatedIssues).toContain('PLAT-77');
  });

  it('removes and reports noise', () => {
    expect(result.ignoredContent.some((i) => i.includes('bot'))).toBe(true);
    expect(result.ignoredContent.some((i) => i.toLowerCase().includes('log'))).toBe(true);
    expect(result.ignoredContent.some((i) => i.includes('duplicate'))).toBe(true);
  });

  it('meets the compression target', () => {
    expect(result.compressionRatio).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
