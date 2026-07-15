import { describe, it, expect } from 'vitest';
import { clean } from '../src/core/stage/HtmlCleaningStage.js';

describe('HtmlCleaningStage', () => {
  it('strips HTML but keeps block structure', () => {
    const cleaned = clean('<p>First paragraph</p><ul><li>item one</li><li>item two</li></ul>');
    expect(cleaned).toContain('First paragraph');
    expect(cleaned).toContain('item one');
    expect(cleaned).not.toContain('<');
    expect(cleaned.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('drops email quotes and signatures', () => {
    const cleaned = clean(
      'We should retry failed deliveries.\n' +
        'On Tue, May 3, 2026 at 9:00 AM Priya Nair wrote:\n' +
        '> earlier reply text\n' +
        '> more quoted text\n',
    );
    expect(cleaned).toBe('We should retry failed deliveries.');
  });

  it('passes plain text through unchanged', () => {
    expect(clean('Just plain text.')).toBe('Just plain text.');
  });

  // Real Jira content is full of U+00A0. JS trim() strips it but Java's strip()
  // does not, so leaving it in place silently forks the two implementations.
  it('normalises non-breaking spaces and CRLF', () => {
    const cleaned = clean('one file per partition. \r\n{code:java}');
    expect(cleaned).toBe('one file per partition.\n{code:java}');
    expect(cleaned).not.toMatch(/[ \r]/);
  });
});
