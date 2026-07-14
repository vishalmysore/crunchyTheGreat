import { describe, it, expect } from 'vitest';
import { nearDuplicate } from '../src/core/text/TextSimilarity.js';

describe('TextSimilarity', () => {
  it('matches exact duplicates ignoring case and apostrophes', () => {
    expect(nearDuplicate("Let's use Kafka.", 'lets use kafka')).toBe(true);
  });

  it('matches near duplicates', () => {
    expect(
      nearDuplicate(
        'For the event backbone we should use Kafka because it already runs in production.',
        'For the event backbone we should use Kafka since it already runs in production.',
      ),
    ).toBe(true);
  });

  it('does not match different statements', () => {
    expect(
      nearDuplicate(
        'We should cap concurrent deliveries per merchant.',
        'All notification payloads are signed with HMAC-SHA256.',
      ),
    ).toBe(false);
  });
});
