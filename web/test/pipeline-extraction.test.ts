import { describe, it, expect } from 'vitest';
import { NormalizedDocument, comment } from '../src/core/model/NormalizedDocument.js';
import { CompressionLevel } from '../src/core/model/CompressionLevel.js';
import { CompressionPipeline } from '../src/core/pipeline/CompressionPipeline.js';
import { CompressedContext } from '../src/core/model/CompressedContext.js';

function run(doc: NormalizedDocument): CompressedContext {
  return CompressionPipeline.standard().process(doc, CompressionLevel.FULL);
}

describe('CompressionPipeline extraction', () => {
  it('extracts decisions including rejections', () => {
    const doc = new NormalizedDocument();
    doc.key = 'ABC-1';
    doc.title = 'Pick a cache';
    doc.description =
      'We decided to use Redis for the session cache. Memcached was rejected because it lacks persistence.';

    const result = run(doc);
    expect(result.decisions.some((d) => d.includes('Redis'))).toBe(true);
    expect(result.decisions.some((d) => d.includes('Memcached'))).toBe(true);
  });

  it('extracts acceptance criteria from section and Gherkin', () => {
    const doc = new NormalizedDocument();
    doc.key = 'ABC-2';
    doc.title = 'Login';
    doc.description = [
      'Acceptance Criteria',
      '- User can log in with email and password',
      '- Account locks after 5 failed attempts',
      '',
      'Given a locked account',
      'When the user resets the password',
      'Then the account unlocks',
    ].join('\n');

    const result = run(doc);
    expect(result.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
    expect(result.acceptanceCriteria.some((a) => a.startsWith('Given'))).toBe(true);
  });

  it('does not mistake prose starting with "When" for a Gherkin scenario', () => {
    const doc = new NormalizedDocument();
    doc.key = 'ABC-5';
    doc.title = 'Booking';
    doc.description =
      'When a patient books a visit, the appointment must appear in the EHR so that staff stop re-typing it.';

    const result = run(doc);
    expect(result.acceptanceCriteria).toEqual([]);
  });

  it('collapses repeated comments into one decision', () => {
    const doc = new NormalizedDocument();
    doc.key = 'ABC-3';
    doc.title = 'Broker choice';
    doc.description = 'Pick the message broker for order events.';
    doc.comments.push(comment('a', '', "Let's use Kafka for order events.", false));
    doc.comments.push(comment('b', '', "Let's use Kafka for order events.", false));
    doc.comments.push(comment('c', '', 'lets use kafka for order events', false));

    const result = run(doc);
    const kafka = result.decisions.filter((d) => d.toLowerCase().includes('kafka'));
    expect(kafka.length).toBe(1);
    expect(result.ignoredContent.some((i) => i.includes('duplicate'))).toBe(true);
  });

  it('keeps only high-value content at the tiny level', () => {
    const doc = new NormalizedDocument();
    doc.key = 'ABC-4';
    doc.title = 'Notifications';
    doc.description = 'We decided to use Kafka for events.';
    doc.comments.push(
      comment(
        'a',
        '',
        'I was on vacation last week, sorry for the slow reply. The weather was great by the way.',
        false,
      ),
    );

    const full = CompressionPipeline.standard().process(doc, CompressionLevel.FULL);
    const tiny = CompressionPipeline.standard().process(doc, CompressionLevel.TINY);
    expect(tiny.compressionRatio).toBeGreaterThanOrEqual(full.compressionRatio);
    expect(tiny.decisions.some((d) => d.includes('Kafka'))).toBe(true);
  });
});
