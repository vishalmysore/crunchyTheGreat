import LLMWorker from '../workers/llm.worker.ts?worker';

/**
 * Promise-based facade over the WebLLM worker. Adapted from the
 * ragCompressionDemo/headroom-demo bridge.
 */
export type LlmStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LoadProgress {
  text: string;
  progress: number;
}

export interface GenerationResult {
  text: string;
  ttftMs: number;
  totalMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

let worker: Worker | null = null;
let status: LlmStatus = 'idle';
let modelId: string | null = null;

let loadResolve: ((id: string) => void) | null = null;
let loadReject: ((e: Error) => void) | null = null;
let genResolve: ((r: GenerationResult) => void) | null = null;
let genReject: ((e: Error) => void) | null = null;
let onProgress: ((p: LoadProgress) => void) | null = null;
let onToken: ((full: string) => void) | null = null;

function settleLoad(err: Error | null, id?: string): void {
  if (err) loadReject?.(err);
  else if (id) loadResolve?.(id);
  loadResolve = loadReject = null;
}

function settleGen(err: Error | null, result?: GenerationResult): void {
  if (err) genReject?.(err);
  else if (result) genResolve?.(result);
  genResolve = genReject = null;
}

function handleMessage(e: MessageEvent): void {
  const msg = e.data;
  switch (msg.status) {
    case 'progress':
      onProgress?.({ text: msg.text, progress: msg.progress });
      break;
    case 'ready':
      status = 'ready';
      modelId = msg.modelId;
      settleLoad(null, msg.modelId);
      break;
    case 'token':
      onToken?.(msg.full);
      break;
    case 'success':
      settleGen(null, { text: msg.full, ttftMs: msg.ttftMs, totalMs: msg.totalMs });
      break;
    case 'error': {
      const err = new Error(msg.error);
      if (loadReject) {
        status = 'error';
        settleLoad(err);
      }
      if (genReject) settleGen(err);
      if (msg.deviceLost || msg.noWebGpu) {
        status = 'idle';
        modelId = null;
      }
      break;
    }
    case 'disposed':
      status = 'idle';
      modelId = null;
      break;
  }
}

function ensureWorker(): void {
  if (worker) return;
  worker = new LLMWorker();
  worker.onmessage = handleMessage;
  worker.onerror = (e) => {
    status = 'error';
    const err = new Error(e.message ?? 'LLM worker crashed');
    settleLoad(err);
    settleGen(err);
  };
}

export const llm = {
  getStatus: (): LlmStatus => status,
  getModelId: (): string | null => modelId,

  loadModel(id: string, progress?: (p: LoadProgress) => void): Promise<string> {
    ensureWorker();
    status = 'loading';
    onProgress = progress ?? null;
    return new Promise((resolve, reject) => {
      loadResolve = resolve;
      loadReject = reject;
      worker!.postMessage({ action: 'load', modelId: id });
    });
  },

  generate(messages: ChatMessage[], token?: (full: string) => void): Promise<GenerationResult> {
    if (status !== 'ready' || !worker) {
      return Promise.reject(new Error('No model loaded.'));
    }
    onToken = token ?? null;
    return new Promise((resolve, reject) => {
      genResolve = resolve;
      genReject = reject;
      worker!.postMessage({ action: 'generate', messages });
    });
  },

  dispose(): void {
    worker?.postMessage({ action: 'dispose' });
    status = 'idle';
    modelId = null;
  },
};
