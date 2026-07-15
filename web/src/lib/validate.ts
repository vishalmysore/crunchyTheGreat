import { ChatMessage, GenerationResult, llm } from './llm-bridge.js';
import { countTokens } from './tokenizer.js';

/**
 * The A/B experiment: ask one local model the *same* question twice — once
 * over the raw ticket, once over the compressed brief — and compare. If the
 * compressed answer matches on a fraction of the tokens, the compression kept
 * what mattered. If it doesn't, the compression dropped something it shouldn't
 * have, and this is how you find out.
 */
export interface ModelOption {
  id: string;
  label: string;
  size: string;
}

/**
 * Small instruct models only: these download into the browser, so weight size
 * is the dominant cost. All are q4f16 MLC builds.
 *
 * Order matters — the first is the default. 0.5B loads fastest but answers
 * thinly (it will often miss a rejected option even when reading the raw
 * ticket), which makes it a poor judge of whether compression lost anything.
 * 1B is the smallest model that reliably reads both contexts, so it leads.
 */
export const MODELS: ReadonlyArray<ModelOption> = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — recommended', size: '~880 MB' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B — fastest, thin answers', size: '~350 MB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B — best answers', size: '~1.1 GB' },
];

export interface PresetQuestion {
  label: string;
  question: string;
}

/** Questions whose answers live in the *signal*, not the noise. */
export const PRESET_QUESTIONS: ReadonlyArray<PresetQuestion> = [
  {
    label: 'Decision + rejection',
    question:
      'Which technology was chosen for this work, and which option was considered and rejected? Answer in one sentence.',
  },
  {
    label: 'Blocker',
    question: 'What is currently blocking this ticket? Answer in one short sentence.',
  },
  {
    label: 'Acceptance criteria',
    question: 'List the acceptance criteria for this ticket as bullet points.',
  },
  {
    label: 'Risk',
    question: 'What is the single biggest risk called out on this ticket?',
  },
];

const SYSTEM_PROMPT =
  'You answer questions about a software ticket using ONLY the context provided. ' +
  'Be concise. If the context does not contain the answer, say "Not in the context."';

function buildMessages(question: string, context: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${question}\n\n--- TICKET CONTEXT ---\n${context}` },
  ];
}

export interface Arm {
  answer: string;
  promptTokens: number;
  ttftMs: number;
  totalMs: number;
}

export interface AbResult {
  raw: Arm;
  compressed: Arm;
  tokensSaved: number;
  percentSaved: number;
}

/** Raw ticket text as the agent would otherwise receive it. */
export function rawContextOf(title: string, description: string, comments: string[]): string {
  return [title, description, ...comments].filter((s) => s.trim().length > 0).join('\n\n');
}

async function runArm(
  question: string,
  context: string,
  onToken?: (full: string) => void,
): Promise<Arm> {
  const messages = buildMessages(question, context);
  const promptTokens = countTokens(messages.map((m) => m.content).join('\n'));
  const result: GenerationResult = await llm.generate(messages, onToken);
  return {
    answer: result.text.trim(),
    promptTokens,
    ttftMs: result.ttftMs,
    totalMs: result.totalMs,
  };
}

export async function runAb(
  question: string,
  rawContext: string,
  compressedContext: string,
  hooks?: {
    onArmStart?: (arm: 'raw' | 'compressed') => void;
    onToken?: (arm: 'raw' | 'compressed', full: string) => void;
  },
): Promise<AbResult> {
  hooks?.onArmStart?.('raw');
  const raw = await runArm(question, rawContext, (t) => hooks?.onToken?.('raw', t));

  hooks?.onArmStart?.('compressed');
  const compressed = await runArm(question, compressedContext, (t) =>
    hooks?.onToken?.('compressed', t),
  );

  const tokensSaved = raw.promptTokens - compressed.promptTokens;
  return {
    raw,
    compressed,
    tokensSaved,
    percentSaved: raw.promptTokens > 0 ? Math.round((tokensSaved / raw.promptTokens) * 100) : 0,
  };
}
