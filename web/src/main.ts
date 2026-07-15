import './style.css';
import { NormalizedDocument } from './core/model/NormalizedDocument.js';
import { parseLevel } from './core/model/CompressionLevel.js';
import { CompressionPipeline } from './core/pipeline/CompressionPipeline.js';
import { toJson } from './core/export/JsonExporter.js';
import { toMarkdown } from './core/export/MarkdownExporter.js';
import { parseJiraIssue } from './connector/jira/JiraIssueParser.js';
import { countTokens, preloadTokenizer } from './lib/tokenizer.js';
import { MODELS, PRESET_QUESTIONS, rawContextOf, runAb } from './lib/validate.js';
import { llm } from './lib/llm-bridge.js';

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

/**
 * Bundled demo tickets. The first three are synthetic, across different
 * (non-finance) software domains. The last two are real Apache tickets pulled
 * from the public Jira — they are messier, noisier, and compress far harder
 * than anything hand-written.
 */
const SAMPLES: ReadonlyArray<{ file: string; label: string }> = [
  { file: 'healthcare-issue.json', label: 'Healthcare · FHIR / EHR sync' },
  { file: 'insurance-issue.json', label: 'Insurance · claims adjudication' },
  { file: 'logistics-issue.json', label: 'Logistics · shipment tracking' },
  { file: 'real-spark-40588.json', label: 'REAL · Apache Spark SPARK-40588' },
  { file: 'real-kafka-9366.json', label: 'REAL · Apache Kafka KAFKA-9366' },
];

for (const s of SAMPLES) {
  const opt = document.createElement('option');
  opt.value = s.file;
  opt.textContent = s.label;
  sampleNameEl.appendChild(opt);
}

/** Real tiktoken count once loaded; a length/4 approximation until then. */
const tokens = (text: string): number => countTokens(text);

function updateInputSize(): void {
  const chars = inputEl.value.length;
  inputSizeEl.textContent = chars > 0
    ? `${chars.toLocaleString()} chars · ${tokens(inputEl.value).toLocaleString()} tok`
    : '';
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

/** The two contexts the A/B panel compares; set on every successful compress. */
let lastRawContext = '';
let lastCompressedContext = '';

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

    // Everything below is derived from the same two strings the A/B panel
    // feeds the model, so no stat can contradict another.
    lastRawContext = rawContextOf(
      document_.title,
      document_.description,
      document_.comments.map((c) => c.body),
    );
    lastCompressedContext = toMarkdown(result);

    const beforeTok = tokens(lastRawContext);
    const afterTok = tokens(rendered);
    const reduction = beforeTok > 0 ? Math.max(0, 1 - afterTok / beforeTok) : 0;
    statsEl.innerHTML =
      stat(`${Math.round(reduction * 100)}%`, 'reduction', true) +
      stat(`${beforeTok.toLocaleString()}→${afterTok.toLocaleString()}`, 'tokens') +
      stat(result.confidence.toFixed(2), 'confidence') +
      stat(`${elapsed} ms`, 'time');
    statsEl.hidden = false;
    copyBtn.hidden = false;
  } catch (e) {
    lastRawContext = '';
    lastCompressedContext = '';
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

// ── A/B validation panel ──────────────────────────────────────────────────
const abToggle = $<HTMLButtonElement>('ab-toggle');
const abBody = $<HTMLDivElement>('ab-body');
const abModel = $<HTMLSelectElement>('ab-model');
const abQuestion = $<HTMLSelectElement>('ab-question');
const abCustom = $<HTMLInputElement>('ab-custom');
const abRun = $<HTMLButtonElement>('ab-run');
const abStatus = $<HTMLParagraphElement>('ab-status');
const abRaw = $<HTMLPreElement>('ab-raw');
const abCmp = $<HTMLPreElement>('ab-cmp');
const abRawMeta = $<HTMLSpanElement>('ab-raw-meta');
const abCmpMeta = $<HTMLSpanElement>('ab-cmp-meta');
const abVerdict = $<HTMLDivElement>('ab-verdict');

for (const m of MODELS) {
  const opt = document.createElement('option');
  opt.value = m.id;
  opt.textContent = `${m.label} · ${m.size}`;
  abModel.appendChild(opt);
}
for (const q of PRESET_QUESTIONS) {
  const opt = document.createElement('option');
  opt.value = q.question;
  opt.textContent = q.label;
  abQuestion.appendChild(opt);
}

abToggle.addEventListener('click', () => {
  const show = abBody.hidden;
  abBody.hidden = !show;
  abToggle.textContent = show ? 'Hide' : 'Show';
  abToggle.setAttribute('aria-expanded', String(show));
  if (show) {
    // Exact token counts matter for the comparison, but tiktoken's rank tables
    // are megabytes — so they load here, not on first paint. Until then the
    // length/4 approximation stands in.
    preloadTokenizer();
  }
});

function setAbStatus(text: string, kind: 'muted' | 'err' = 'muted'): void {
  abStatus.textContent = text;
  abStatus.classList.toggle('err', kind === 'err');
  abStatus.classList.toggle('muted', kind === 'muted');
}

async function runValidation(): Promise<void> {
  if (!lastCompressedContext || !lastRawContext) {
    setAbStatus('Compress a ticket first, then run the comparison.', 'err');
    return;
  }
  const question = abCustom.value.trim() || abQuestion.value;

  abRun.disabled = true;
  abVerdict.hidden = true;
  abRaw.textContent = '—';
  abCmp.textContent = '—';
  abRawMeta.textContent = '';
  abCmpMeta.textContent = '';
  abRaw.classList.add('muted');
  abCmp.classList.add('muted');

  try {
    if (llm.getModelId() !== abModel.value) {
      setAbStatus('Loading model — first run downloads weights, then they are cached…');
      await llm.loadModel(abModel.value, (p) => {
        setAbStatus(`${p.text || 'Loading model'} — ${p.progress}%`);
      });
    }

    setAbStatus('Asking the model the same question over both contexts…');
    const result = await runAb(question, lastRawContext, lastCompressedContext, {
      onArmStart: (arm) => {
        setAbStatus(arm === 'raw' ? 'Answering from the raw ticket…' : 'Answering from the compressed brief…');
      },
      onToken: (arm, full) => {
        const el = arm === 'raw' ? abRaw : abCmp;
        el.classList.remove('muted');
        el.textContent = full;
      },
    });

    abRaw.textContent = result.raw.answer || '(empty)';
    abCmp.textContent = result.compressed.answer || '(empty)';
    abRaw.classList.remove('muted');
    abCmp.classList.remove('muted');
    abRawMeta.textContent = `${result.raw.promptTokens.toLocaleString()} tok · ${result.raw.totalMs} ms`;
    abCmpMeta.textContent = `${result.compressed.promptTokens.toLocaleString()} tok · ${result.compressed.totalMs} ms`;

    const faster = result.raw.totalMs - result.compressed.totalMs;
    abVerdict.innerHTML =
      `<strong>${result.percentSaved}% fewer prompt tokens</strong> ` +
      `(${result.raw.promptTokens.toLocaleString()} → ${result.compressed.promptTokens.toLocaleString()}, ` +
      `${result.tokensSaved.toLocaleString()} saved)` +
      (faster > 0 ? ` · <strong>${faster} ms faster</strong>` : '') +
      ` — now compare the two answers above. Same model, same question, same temperature.`;
    abVerdict.hidden = false;
    setAbStatus('Done. Both answers came from this tab; nothing was uploaded.');
  } catch (e) {
    setAbStatus((e as Error).message, 'err');
  } finally {
    abRun.disabled = false;
  }
}

abRun.addEventListener('click', () => void runValidation());
abModel.addEventListener('change', () => {
  // Switching models must free GPU memory before the next load.
  if (llm.getModelId() && llm.getModelId() !== abModel.value) {
    llm.dispose();
    setAbStatus('Model changed — the next run will load it.');
  }
});

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
