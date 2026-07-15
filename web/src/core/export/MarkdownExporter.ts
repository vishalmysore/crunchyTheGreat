import { CompressedContext } from '../model/CompressedContext.js';

/**
 * Renders the CIR as compact Markdown, ready to paste into an agent prompt.
 *
 * `ignoredContent` is deliberately omitted: it is a diagnostic for humans
 * auditing what was removed, and an agent should not spend context reading
 * "3 greetings removed". It remains available in the JSON CIR.
 */
export function toMarkdown(c: CompressedContext): string {
  const md: string[] = [];
  md.push(`# ${c.issue}\n`);
  if (c.summary.trim().length > 0) {
    md.push(`${c.summary}\n`);
  }
  if (c.businessGoal.trim().length > 0) {
    md.push(`**Business goal:** ${c.businessGoal}\n`);
  }
  section(md, 'Architecture', c.architecture);
  section(md, 'Decisions', c.decisions);
  section(md, 'Constraints', c.constraints);
  section(md, 'Acceptance Criteria', c.acceptanceCriteria);
  section(md, 'Risks', c.risks);
  section(md, 'TODOs', c.todos);
  section(md, 'Dependencies', c.dependencies);
  section(md, 'Related Issues', c.relatedIssues);
  md.push('---');
  md.push(
    `confidence: ${c.confidence} | compression: ${Math.round(c.compressionRatio * 100)}%`,
  );
  return md.join('\n') + '\n';
}

function section(md: string[], title: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }
  md.push(`## ${title}`);
  for (const item of items) {
    md.push(`- ${item}`);
  }
  md.push('');
}
