import { PipelineStage } from '../pipeline/PipelineStage.js';
import { ProcessingContext } from '../pipeline/ProcessingContext.js';

/**
 * Stage 2 (cleaning): HTML -> plain text, then strip email quotes, signatures
 * and whitespace noise. Runs on every source text before block splitting.
 *
 * The Java version used JSoup; here we stay dependency-free so the same code
 * runs in the browser, in Node and in tests. Block-level tags become newlines
 * so list structure survives for the acceptance-criteria stage.
 */
const HTML_HINT = /<\s*(p|div|br|span|table|ul|ol|li|b|i|strong|em|h[1-6]|a)\b/i;
const EMAIL_QUOTE_HEADER = /^On .{5,120} wrote:\s*$/im;
const QUOTED_LINE = /^\s*>.*$/gm;
const SIGNATURE = /^--\s*$[\s\S]*/m;
const EXCESS_BLANK_LINES = /\n{3,}/g;
const TRAILING_SPACES = /[ \t]+$/gm;

const NAMED_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&amp;': '&',
};

function decodeEntities(text: string): string {
  let out = text;
  for (const [entity, value] of Object.entries(NAMED_ENTITIES)) {
    // &amp; is decoded last (it is last in insertion order) to avoid double-decoding.
    out = out.split(entity).join(value);
  }
  out = out.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
  return out;
}

function htmlToText(html: string): string {
  let t = html;
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n'); // line breaks
  t = t.replace(/<\s*li[^>]*>/gi, '- '); // list items get a bullet
  // Block boundaries become newlines. Note: <ul>/<ol> themselves do NOT emit a
  // newline, so a heading stays in the same block as the list it introduces
  // (the acceptance-criteria section extractor depends on that).
  t = t.replace(/<\/?\s*(p|div|li|tr|h[1-6])[^>]*>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ''); // strip remaining inline tags
  t = decodeEntities(t);
  return t;
}

export function clean(raw: string): string {
  let text = raw;
  if (HTML_HINT.test(text)) {
    text = htmlToText(text);
  }
  // Drop everything from an email-quote header onward.
  const quoteHeader = EMAIL_QUOTE_HEADER.exec(text);
  if (quoteHeader) {
    text = text.substring(0, quoteHeader.index);
  }
  text = text.replace(QUOTED_LINE, '');
  text = text.replace(SIGNATURE, '');
  text = text.replace(TRAILING_SPACES, '');
  text = text.replace(EXCESS_BLANK_LINES, '\n\n');
  return text.trim();
}

export class HtmlCleaningStage implements PipelineStage {
  readonly name = 'html-cleaning';

  process(context: ProcessingContext): void {
    for (const source of context.sources) {
      source.text = clean(source.text);
    }
  }
}
