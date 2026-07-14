/**
 * Source-agnostic representation of a work item. Every connector (Jira, GitHub
 * Issues, Azure DevOps, ...) produces this shape; the pipeline only ever sees
 * this class, never a source-specific payload.
 */
export interface Comment {
  author: string;
  created: string;
  body: string;
  bot: boolean;
}

export function comment(
  author = '',
  created = '',
  body = '',
  bot = false,
): Comment {
  return { author: author ?? '', created: created ?? '', body: body ?? '', bot };
}

export class NormalizedDocument {
  source = 'unknown';
  key = '';
  title = '';
  description = '';
  comments: Comment[] = [];
  /** Insertion-ordered, mirroring the Java LinkedHashMap. */
  metadata = new Map<string, string>();

  /** Total characters of raw content, the denominator of the compression ratio. */
  rawLength(): number {
    let len = this.title.length + this.description.length;
    for (const c of this.comments) {
      len += c.body.length;
    }
    return len;
  }
}
