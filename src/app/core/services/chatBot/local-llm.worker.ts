/// <reference lib="webworker" />

import { env, pipeline } from '@huggingface/transformers';

type LlmRuntimeStatus = 'idle' | 'loading-model' | 'generating' | 'error';

interface WorkerGenerateRequest {
  type: 'generate';
  requestId: string;
  modelId: string;
  prompt: string;
  maxNewTokens: number;
  temperature: number;
  topP: number;
  repetitionPenalty: number;
  timeoutMs: number;
}

interface WorkerStatusMessage {
  type: 'status';
  status: LlmRuntimeStatus;
}

interface WorkerResultMessage {
  type: 'result';
  requestId: string;
  text: string | null;
  error?: string;
}

type WorkerOutgoingMessage = WorkerStatusMessage | WorkerResultMessage;

let generator: any | null = null;
let loadPromise: Promise<any | null> | null = null;
let disabled = false;

function postStatus(status: LlmRuntimeStatus): void {
  const msg: WorkerStatusMessage = { type: 'status', status };
  postMessage(msg satisfies WorkerOutgoingMessage);
}

function pickDevice(): 'webgpu' | 'wasm' {
  if (isWindowsBrowser()) return 'wasm';
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu';
  return 'wasm';
}

function isWindowsBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (ua.includes('windows')) return true;
  const platform = String((navigator as any).platform || '').toLowerCase();
  return platform.includes('win');
}

async function getGenerator(modelId: string): Promise<any | null> {
  if (disabled) return null;
  if (generator) return generator;
  if (loadPromise) return loadPromise;

  loadPromise = loadGenerator(modelId);
  generator = await loadPromise;
  return generator;
}

async function loadGenerator(modelId: string): Promise<any | null> {
  try {
    postStatus('loading-model');

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

    const device = pickDevice();
    try {
      const model = await pipeline('text-generation', modelId, {
        device,
        dtype: device === 'webgpu' ? 'q4' : 'q8'
      });
      postStatus('idle');
      return model;
    } catch (firstErr) {
      console.warn('[local-llm.worker] init retry base', firstErr);
      const model = await pipeline('text-generation', modelId, { device });
      postStatus('idle');
      return model;
    }
  } catch (err) {
    console.warn('[local-llm.worker] load error', err);
    disabled = true;
    postStatus('error');
    return null;
  }
}

function extractGeneratedText(output: any): string {
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first?.generated_text === 'string') return first.generated_text;
    if (typeof first?.text === 'string') return first.text;
  }
  if (typeof output?.generated_text === 'string') return output.generated_text;
  if (typeof output === 'string') return output;
  return '';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM timeout (${timeoutMs}ms)`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

addEventListener('message', async ({ data }) => {
  const msg = data as WorkerGenerateRequest;
  if (!msg || msg.type !== 'generate') return;

  try {
    const model = await getGenerator(msg.modelId);
    if (!model) {
      const res: WorkerResultMessage = {
        type: 'result',
        requestId: msg.requestId,
        text: null,
        error: 'generator-unavailable'
      };
      postMessage(res satisfies WorkerOutgoingMessage);
      return;
    }

    postStatus('generating');

    const output = await withTimeout(
      model(msg.prompt, {
        max_new_tokens: msg.maxNewTokens,
        temperature: msg.temperature,
        top_p: msg.topP,
        repetition_penalty: msg.repetitionPenalty,
        return_full_text: false,
        do_sample: true
      }),
      msg.timeoutMs
    );

    const res: WorkerResultMessage = {
      type: 'result',
      requestId: msg.requestId,
      text: extractGeneratedText(output)
    };
    postMessage(res satisfies WorkerOutgoingMessage);
  } catch (err) {
    postStatus('error');
    const res: WorkerResultMessage = {
      type: 'result',
      requestId: msg.requestId,
      text: null,
      error: String((err as any)?.message ?? err ?? 'worker-error')
    };
    postMessage(res satisfies WorkerOutgoingMessage);
  } finally {
    postStatus('idle');
  }
});
