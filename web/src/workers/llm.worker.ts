/**
 * WebLLM inference worker. The engine lives here, isolated from the main
 * thread, so a GPU crash cannot corrupt UI state.
 *
 * Adapted from the ragCompressionDemo/headroom-demo worker, which already
 * handles the awkward parts: WebGPU capability detection, adapter loss after a
 * GPU-process crash, and unloading cleanly when switching models.
 */
import { CreateMLCEngine } from '@mlc-ai/web-llm';

type Engine = Awaited<ReturnType<typeof CreateMLCEngine>>;

let engine: Engine | null = null;
let loadAborted = false;

function post(msg: Record<string, unknown>): void {
  (self as unknown as Worker).postMessage(msg);
}

async function disposeCurrent(): Promise<void> {
  if (engine) {
    try {
      await engine.unload();
    } catch {
      /* already gone */
    }
    engine = null;
  }
}

async function webGpuAvailable(): Promise<string | null> {
  const nav = self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
  if (!nav.gpu) {
    return 'WebGPU is not available. Use Chrome/Edge 113+ on a machine with a GPU.';
  }
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return "WebGPU adapter lost — the browser's GPU process may have crashed. Reopen the browser and try again.";
    }
  } catch (err) {
    return `WebGPU check failed: ${(err as Error)?.message ?? err}`;
  }
  return null;
}

self.onmessage = async (e: MessageEvent) => {
  const { action, modelId, messages } = e.data ?? {};

  if (action === 'load') {
    loadAborted = false;
    await disposeCurrent();

    if (!modelId) {
      post({ status: 'error', error: 'No model id provided.' });
      return;
    }

    const gpuError = await webGpuAvailable();
    if (gpuError) {
      post({ status: 'error', error: gpuError, noWebGpu: true });
      return;
    }

    try {
      engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress: { text?: string; progress?: number }) => {
          if (loadAborted) return;
          post({
            status: 'progress',
            text: progress.text ?? '',
            progress: Math.round((progress.progress ?? 0) * 100),
          });
        },
      });
      if (loadAborted) {
        await disposeCurrent();
        return;
      }
      post({ status: 'ready', modelId });
    } catch (err) {
      if (loadAborted) return;
      await disposeCurrent();
      post({ status: 'error', error: (err as Error)?.message ?? String(err) });
    }
    return;
  }

  if (action === 'generate') {
    if (!engine) {
      post({ status: 'error', error: 'No model loaded.' });
      return;
    }
    try {
      const started = performance.now();
      let firstTokenAt = 0;
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: 400,
        temperature: 0, // deterministic: this is a comparison, not a creative task
      });
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          if (!firstTokenAt) firstTokenAt = performance.now() - started;
          full += delta;
          post({ status: 'token', delta, full });
        }
      }
      post({
        status: 'success',
        full,
        ttftMs: Math.round(firstTokenAt),
        totalMs: Math.round(performance.now() - started),
      });
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      const deviceLost = /disposed|device.?lost|device.?hung|DEVICE_HUNG|0x887A/i.test(message);
      if (deviceLost) await disposeCurrent();
      post({ status: 'error', error: message, deviceLost });
    }
    return;
  }

  if (action === 'dispose') {
    loadAborted = true;
    await disposeCurrent();
    post({ status: 'disposed' });
  }
};

export {};
