import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { ChatMessage } from './chat-bot.service';

export type ChatActorRole = 'guest' | 'public' | 'client' | 'user' | 'staff' | 'admin';
export type LlmRuntimeStatus = 'idle' | 'loading-model' | 'generating' | 'error';

interface SupportGenerationParams {
  role: ChatActorRole;
  userMessage: string;
  history: ChatMessage[];
}

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

type WorkerIncomingMessage = WorkerStatusMessage | WorkerResultMessage;

interface PendingWorkerRequest {
  resolve: (text: string | null) => void;
  reject: (reason?: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class LocalLlmService {
  private readonly modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
  private readonly maxPromptChars = 2200;
  private readonly generationTimeoutMs = 25000;
  private readonly firstWorkerRequestTimeoutMs = 180000;

  private generator: any | null = null;
  private loadPromise: Promise<any | null> | null = null;
  private disabled = false;

  private worker: Worker | null = null;
  private workerUnavailable = false;
  private workerReady = false;
  private readonly pendingWorkerRequests = new Map<string, PendingWorkerRequest>();

  private readonly statusSubject = new BehaviorSubject<LlmRuntimeStatus>('idle');
  readonly status$: Observable<LlmRuntimeStatus> = this.statusSubject.asObservable();

  async generateSupportReply(params: SupportGenerationParams): Promise<string | null> {
    if (this.disabled) return null;

    const prompt = this.buildPrompt(params);

    const worker = this.ensureWorker();
    if (worker) {
      try {
        const workerText = await this.generateWithWorker(worker, prompt);
        const cleaned = this.cleanAnswer(workerText || '');
        if (cleaned) return cleaned;
        return null;
      } catch (err) {
        if (this.isTimeoutError(err)) {
          console.warn('[LocalLlmService] worker lento o in warmup, nessun fallback main thread:', err);
          return null;
        }

        console.warn('[LocalLlmService] worker path fallita, disattivo worker:', err);
        this.disableWorker(err);
        return null;
      }
    }

    return this.generateOnMainThread(prompt);
  }

  private ensureWorker(): Worker | null {
    if (this.workerUnavailable) return null;
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;

    try {
      const worker = new Worker(new URL('./local-llm.worker', import.meta.url), { type: 'module' });

      worker.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'status') {
          this.setStatus(data.status);
          return;
        }

        if (data.type === 'result') {
          const pending = this.pendingWorkerRequests.get(data.requestId);
          if (!pending) return;
          this.pendingWorkerRequests.delete(data.requestId);

          if (data.error) {
            pending.reject(new Error(data.error));
            return;
          }

          pending.resolve(data.text ?? null);
        }
      };

      worker.onerror = (err) => {
        console.warn('[LocalLlmService] worker error:', err);
        this.setStatus('error');
        this.disableWorker(err);
      };

      this.worker = worker;
      return worker;
    } catch (err) {
      console.warn('[LocalLlmService] impossibile creare worker:', err);
      this.workerUnavailable = true;
      return null;
    }
  }

  private disableWorker(error?: unknown): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.workerUnavailable = true;
    this.workerReady = false;

    if (this.pendingWorkerRequests.size > 0) {
      for (const pending of this.pendingWorkerRequests.values()) {
        pending.reject(error ?? new Error('LLM worker unavailable'));
      }
      this.pendingWorkerRequests.clear();
    }
  }

  private async generateWithWorker(worker: Worker, prompt: string): Promise<string | null> {
    const requestId = this.buildRequestId();
    const requestTimeoutMs = this.workerReady
      ? this.generationTimeoutMs
      : this.firstWorkerRequestTimeoutMs;

    const promise = new Promise<string | null>((resolve, reject) => {
      this.pendingWorkerRequests.set(requestId, { resolve, reject });

      const payload: WorkerGenerateRequest = {
        type: 'generate',
        requestId,
        modelId: this.modelId,
        prompt,
        maxNewTokens: 180,
        temperature: 0.1,
        topP: 0.9,
        repetitionPenalty: 1.08,
        timeoutMs: requestTimeoutMs
      };

      worker.postMessage(payload);
    });

    try {
      const text = await this.withTimeout(promise, requestTimeoutMs + 5000);
      this.workerReady = true;
      return text;
    } finally {
      this.pendingWorkerRequests.delete(requestId);
    }
  }

  private async generateOnMainThread(prompt: string): Promise<string | null> {
    const generator = await this.getGenerator();
    if (!generator) return null;

    try {
      this.setStatus('generating');

      const output = await this.withTimeout(
        generator(prompt, {
          max_new_tokens: 180,
          temperature: 0.1,
          top_p: 0.9,
          repetition_penalty: 1.08,
          return_full_text: false,
          do_sample: true
        }),
        this.generationTimeoutMs
      );

      const text = this.extractGeneratedText(output);
      const cleaned = this.cleanAnswer(text);
      if (!cleaned) return null;
      return cleaned;
    } catch (err) {
      this.setStatus('error');
      console.warn('[LocalLlmService] generation error su main thread:', err);
      return null;
    } finally {
      this.setStatus('idle');
    }
  }

  private async getGenerator(): Promise<any | null> {
    if (this.generator) return this.generator;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadGenerator();
    const gen = await this.loadPromise;
    this.generator = gen;
    return gen;
  }

  private async loadGenerator(): Promise<any | null> {
    try {
      this.setStatus('loading-model');
      const { pipeline, env } = await import('@huggingface/transformers');

      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      const device = this.pickDevice();
      try {
        const model = await pipeline('text-generation', this.modelId, {
          device,
          dtype: device === 'webgpu' ? 'q4' : 'q8'
        });
        this.setStatus('idle');
        return model;
      } catch (firstErr) {
        console.warn('[LocalLlmService] primo tentativo init fallito, retry base', firstErr);
        const model = await pipeline('text-generation', this.modelId, { device });
        this.setStatus('idle');
        return model;
      }
    } catch (err) {
      console.warn('[LocalLlmService] modello non disponibile, fallback disabilitato', err);
      this.disabled = true;
      this.setStatus('error');
      return null;
    }
  }

  private setStatus(status: LlmRuntimeStatus): void {
    if (this.statusSubject.value === status) return;
    this.statusSubject.next(status);
  }

  private pickDevice(): 'webgpu' | 'wasm' {
    if (this.isWindowsBrowser()) {
      return 'wasm';
    }

    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      return 'webgpu';
    }
    return 'wasm';
  }

  private isWindowsBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = String(navigator.userAgent || '').toLowerCase();
    if (ua.includes('windows')) return true;

    const platform = String((navigator as any).platform || '').toLowerCase();
    return platform.includes('win');
  }

  private buildPrompt(params: SupportGenerationParams): string {
    const roleGuide = this.roleGuide(params.role);
    const chatTail = this.renderHistory(params.history);

    const prompt = [
      'Sei Assistente Rebis (studio tatuaggi).',
      'Rispondi in italiano semplice, tono professionale e breve (max 6 righe).',
      'Non inventare dati tecnici o prezzi precisi se non presenti.',
      'Per azioni sensibili invita a usare dashboard o login.',
      `Contesto ruolo utente: ${params.role}. ${roleGuide}`,
      '',
      'Conversazione recente:',
      chatTail,
      '',
      `Utente: ${params.userMessage}`,
      'Assistente:'
    ].join('\n');

    return prompt.slice(-this.maxPromptChars);
  }

  private roleGuide(role: ChatActorRole): string {
    if (role === 'admin') {
      return 'Puoi citare in modo sintetico supervisione ticket, permessi e gestione operativa.';
    }
    if (role === 'staff') {
      return 'Puoi citare in modo sintetico gestione agenda, ticket clienti e aggiornamento prenotazioni.';
    }
    if (role === 'client') {
      return 'Dai priorita a assistenza prenotazioni, stato richiesta e percorso in area personale.';
    }
    if (role === 'user') {
      return 'Tratta il ruolo user come client: assistenza prenotazioni e supporto area personale.';
    }
    return 'Per guest indica sempre login per conferme e operazioni su dati personali.';
  }

  private renderHistory(history: ChatMessage[]): string {
    const tail = history.slice(-8);
    return tail
      .map((m) => `${m.from === 'user' ? 'Utente' : 'Assistente'}: ${m.text}`)
      .join('\n');
  }

  private extractGeneratedText(output: any): string {
    if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      if (typeof first?.generated_text === 'string') return first.generated_text;
      if (typeof first?.text === 'string') return first.text;
    }

    if (typeof output?.generated_text === 'string') return output.generated_text;
    if (typeof output === 'string') return output;
    return '';
  }

  private cleanAnswer(text: string): string {
    return String(text ?? '')
      .replace(/\s+/g, ' ')
      .replace(/^assistente:\s*/i, '')
      .trim()
      .slice(0, 700);
  }

  private buildRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private isTimeoutError(err: unknown): boolean {
    const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
    return msg.includes('timeout');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
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
}
