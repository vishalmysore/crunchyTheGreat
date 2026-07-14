import { NormalizedDocument, comment } from '../../core/model/NormalizedDocument.js';

/**
 * Parses a Jira REST API v2 issue payload (GET /rest/api/2/issue/{key}
 * with comments expanded) into a {@link NormalizedDocument}. Works from a
 * saved JSON export too, so the pipeline can run without Jira credentials.
 */
const BOT_AUTHOR = /\b(bot|jenkins|automation|pipeline|github|dependabot|sonar|bamboo)\b/i;

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === 'object' ? (value as Json) : {};
}

function str(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value);
}

export function parseJiraIssue(input: string | Json): NormalizedDocument {
  const root: Json = typeof input === 'string' ? (JSON.parse(input) as Json) : input;
  const doc = new NormalizedDocument();
  doc.source = 'jira';
  doc.key = str(root.key);

  const fields = obj(root.fields);
  doc.title = str(fields.summary);
  doc.description = textOrRendered(root, fields, 'description');

  copyMetadata(fields, doc);
  parseComments(root, fields, doc);
  parseLinks(fields, doc);
  return doc;
}

/** Prefer the raw field; fall back to renderedFields HTML (the cleaner strips tags). */
function textOrRendered(root: Json, fields: Json, field: string): string {
  const raw = str(fields[field]);
  if (raw.trim().length > 0) {
    return raw;
  }
  return str(obj(root.renderedFields)[field]);
}

function copyMetadata(fields: Json, doc: NormalizedDocument): void {
  putIfPresent(doc, 'status', str(obj(fields.status).name));
  putIfPresent(doc, 'issueType', str(obj(fields.issuetype).name));
  putIfPresent(doc, 'priority', str(obj(fields.priority).name));
  putIfPresent(doc, 'assignee', str(obj(fields.assignee).displayName));
  const labels = fields.labels;
  if (Array.isArray(labels) && labels.length > 0) {
    doc.metadata.set('labels', labels.map((l) => str(l)).join(','));
  }
}

function parseComments(root: Json, fields: Json, doc: NormalizedDocument): void {
  let list = obj(fields.comment).comments ?? obj(root.comment).comments;
  if (!Array.isArray(list)) {
    list = [];
  }
  for (const raw of list as unknown[]) {
    const c = obj(raw);
    const author = obj(c.author);
    const name = str(author.displayName, str(author.name));
    const accountType = str(author.accountType);
    const bot = accountType.toLowerCase() === 'app' || BOT_AUTHOR.test(name);
    doc.comments.push(comment(name, str(c.created), str(c.body), bot));
  }
}

function parseLinks(fields: Json, doc: NormalizedDocument): void {
  const links = fields.issuelinks;
  if (!Array.isArray(links) || links.length === 0) {
    return;
  }
  const keys: string[] = [];
  for (const raw of links) {
    const link = obj(raw);
    const key = str(obj(link.outwardIssue).key, str(obj(link.inwardIssue).key));
    if (key.trim().length > 0) {
      keys.push(key);
    }
  }
  if (keys.length > 0) {
    doc.metadata.set('linkedIssues', keys.join(','));
  }
}

function putIfPresent(doc: NormalizedDocument, key: string, value: string): void {
  if (value && value.trim().length > 0) {
    doc.metadata.set(key, value);
  }
}
