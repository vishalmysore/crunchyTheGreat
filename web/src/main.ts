import './style.css';
import { NormalizedDocument } from './core/model/NormalizedDocument.js';
import { parseLevel } from './core/model/CompressionLevel.js';
import { CompressionPipeline } from './core/pipeline/CompressionPipeline.js';
import { toJson } from './core/export/JsonExporter.js';
import { toMarkdown } from './core/export/MarkdownExporter.js';
import { parseJiraIssue } from './connector/jira/JiraIssueParser.js';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const inputEl = $<HTMLTextAreaElement>('input');
const outputEl = $<HTMLPreElement>('output');
const statsEl = $<HTMLDivElement>('stats');
const inputSizeEl = $<HTMLSpanElement>('input-size');
const copyBtn = $<HTMLButtonElement>('copy');

const sourceEl = $<HTMLSelectElement>('source');
const levelEl = $<HTMLSelectElement>('level');
const formatEl = $<HTMLSelectElement>('format');
const sampleNameEl = $<HTMLSelectElement>('sampleName');

/** Bundled demo tickets across different (non-finance) software domains. */
const SAMPLES: ReadonlyArray<{ file: string; label: string }> = [
  { file: 'messy-issue.json', label: 'Payments · webhook notifications' },
  { file: 'healthcare-issue.json', label: 'Healthcare · FHIR / EHR sync' },
  { file: 'insurance-issue.json', label: 'Insurance · claims adjudication' },
  { file: 'logistics-issue.json', label: 'Logistics · shipment tracking' },
];

for (const s of SAMPLES) {
  const opt = document.createElement('option');
  opt.value = s.file;
  opt.textContent = s.label;
  sampleNameEl.appendChild(opt);
}

/** Rough token estimate: ~4 chars per token, the common rule of thumb. */
const tokens = (chars: number): number => Math.round(chars / 4);

function updateInputSize(): void {
  const chars = inputEl.value.length;
  inputSizeEl.textContent = chars > 0 ? `${chars.toLocaleString()} chars · ~${tokens(chars)} tok` : '';
}

function buildDocument(): NormalizedDocument {
  const raw = inputEl.value.trim();
  if (raw.length === 0) {
    throw new Error('Nothing to compress — paste an issue or click “Load sample”.');
  }
  if (sourceEl.value === 'text') {
    const doc = new NormalizedDocument();
    doc.source = 'text';
    doc.title = 'Pasted text';
    doc.description = raw;
    return doc;
  }
  try {
    return parseJiraIssue(raw);
  } catch (e) {
    throw new Error(`That does not look like valid Jira issue JSON. (${(e as Error).message})`);
  }
}

function stat(value: string, label: string, hero = false): string {
  return `<div class="stat${hero ? ' hero' : ''}"><span class="val">${value}</span><span class="lbl">${label}</span></div>`;
}

function compress(): void {
  copyBtn.hidden = true;
  statsEl.hidden = true;
  try {
    const document_ = buildDocument();
    const level = parseLevel(levelEl.value);

    const start = performance.now();
    const result = CompressionPipeline.standard().process(document_, level);
    const elapsed = Math.max(1, Math.round(performance.now() - start));

    const rendered = formatEl.value === 'json' ? toJson(result) : toMarkdown(result);
    outputEl.textContent = rendered;
    outputEl.classList.remove('muted', 'err');

    const before = document_.rawLength();
    const after = rendered.length;
    statsEl.innerHTML =
      stat(`${Math.round(result.compressionRatio * 100)}%`, 'reduction', true) +
      stat(`${tokens(before).toLocaleString()}→${tokens(after).toLocaleString()}`, 'tokens') +
      stat(result.confidence.toFixed(2), 'confidence') +
      stat(`${elapsed} ms`, 'time');
    statsEl.hidden = false;
    copyBtn.hidden = false;
  } catch (e) {
    outputEl.textContent = (e as Error).message;
    outputEl.classList.remove('muted');
    outputEl.classList.add('err');
  }
}

async function loadSample(): Promise<void> {
  const file = sampleNameEl.value || SAMPLES[0].file;
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
  inputEl.value = await res.text();
  sourceEl.value = 'jira';
  updateInputSize();
  compress();
}

async function copyOutput(): Promise<void> {
  await navigator.clipboard.writeText(outputEl.textContent ?? '');
  copyBtn.textContent = 'Copied';
  setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
}

$<HTMLButtonElement>('compress').addEventListener('click', compress);
$<HTMLButtonElement>('sample').addEventListener('click', () => void loadSample());
sampleNameEl.addEventListener('change', () => void loadSample());
copyBtn.addEventListener('click', () => void copyOutput());
inputEl.addEventListener('input', updateInputSize);
[levelEl, formatEl, sourceEl].forEach((el) =>
  el.addEventListener('change', () => {
    if (!statsEl.hidden) compress();
  }),
);
