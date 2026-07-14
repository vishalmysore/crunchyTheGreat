import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { NormalizedDocument } from './core/model/NormalizedDocument.js';
import { CompressionLevel, parseLevel } from './core/model/CompressionLevel.js';
import { CompressionPipeline } from './core/pipeline/CompressionPipeline.js';
import { toJson } from './core/export/JsonExporter.js';
import { toMarkdown } from './core/export/MarkdownExporter.js';
import { parseJiraIssue } from './connector/jira/JiraIssueParser.js';

interface Args {
  input?: string;
  source: string;
  level: string;
  format: string;
  output?: string;
  help: boolean;
}

const USAGE = `crunchy 0.1.0 — compresses Jira issue context into a compact CIR document.

Usage: crunchy -i <file> [options]

  -i, --input   <file>   Jira REST issue JSON export, or plain text with --source text
  -s, --source  <kind>   jira | text                       (default: jira)
  -l, --level   <level>  tiny | small | medium | full       (default: full)
  -f, --format  <fmt>    json | markdown                    (default: json)
  -o, --output  <file>   output file                        (default: stdout)
  -h, --help             show this help
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { source: 'jira', level: 'full', format: 'json', help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-i':
      case '--input':
        args.input = argv[++i];
        break;
      case '-s':
      case '--source':
        args.source = argv[++i];
        break;
      case '-l':
      case '--level':
        args.level = argv[++i];
        break;
      case '-f':
      case '--format':
        args.format = argv[++i];
        break;
      case '-o':
      case '--output':
        args.output = argv[++i];
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function readDocument(args: Args): NormalizedDocument {
  const raw = readFileSync(args.input as string, 'utf8');
  if (args.source.toLowerCase() === 'text') {
    const doc = new NormalizedDocument();
    doc.source = 'text';
    doc.title = basename(args.input as string);
    doc.description = raw;
    return doc;
  }
  return parseJiraIssue(raw);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 1);
  }

  const level: CompressionLevel = parseLevel(args.level);
  const document = readDocument(args);

  const start = performance.now();
  const result = CompressionPipeline.standard().process(document, level);
  const elapsedMs = Math.round(performance.now() - start);

  const format = args.format.toLowerCase();
  let rendered: string;
  if (format === 'markdown' || format === 'md') {
    rendered = toMarkdown(result);
  } else if (format === 'json') {
    rendered = toJson(result);
  } else {
    throw new Error(`Unknown format: ${args.format}`);
  }

  if (args.output) {
    writeFileSync(args.output, rendered);
    process.stderr.write(
      `Wrote ${args.output} (${rendered.length} chars, ` +
        `${Math.round(result.compressionRatio * 100)}% reduction, ${elapsedMs} ms)\n`,
    );
  } else {
    process.stdout.write(rendered + '\n');
  }
}

main();
