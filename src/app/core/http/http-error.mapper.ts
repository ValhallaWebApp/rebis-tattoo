export type HttpErrorMapOptions = {
  fallbackMessage: string;
  timeoutMessage?: string;
  networkMessage?: string;
  badRequestMessage?: string;
  unauthorizedMessage?: string;
  serverMessage?: string;
  statusMessages?: Partial<Record<number, string>>;
};

export type HttpMappedError = {
  message: string;
  status?: number;
  original: unknown;
};

type HttpErrorLike = {
  status?: unknown;
  name?: unknown;
  message?: unknown;
  error?: unknown;
};

function toStatus(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function extractPayloadMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== 'object') return '';

  const source = payload as Record<string, unknown>;
  const direct = source['error'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const message = source['message'];
  if (typeof message === 'string' && message.trim()) return message.trim();

  const detail = source['detail'];
  if (typeof detail === 'string' && detail.trim()) return detail.trim();

  return '';
}

export function mapHttpError(error: unknown, options: HttpErrorMapOptions): HttpMappedError {
  const e = (error ?? {}) as HttpErrorLike;
  const status = toStatus(e.status);
  const isTimeout = String(e.name ?? '') === 'TimeoutError';

  const payloadMessage = extractPayloadMessage(e.error);
  const directMessage = typeof e.message === 'string' ? e.message : '';

  let message = options.fallbackMessage;
  if (isTimeout) {
    message = options.timeoutMessage ?? 'Timeout richiesta. Riprova.';
  } else if (status === 0) {
    message = options.networkMessage ?? 'Servizio non raggiungibile.';
  } else if (status === 400) {
    message = payloadMessage || options.badRequestMessage || options.fallbackMessage;
  } else if (status === 401 || status === 403) {
    message = options.unauthorizedMessage ?? 'Non autorizzato.';
  } else if (status && status >= 500) {
    message = options.serverMessage ?? 'Errore interno del server.';
  } else if (status && options.statusMessages?.[status]) {
    message = options.statusMessages[status] as string;
  } else if (payloadMessage) {
    message = payloadMessage;
  } else if (directMessage.trim()) {
    message = directMessage.trim();
  }

  return {
    message,
    status,
    original: error
  };
}
