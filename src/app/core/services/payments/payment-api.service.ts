import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map, Observable, catchError, throwError, timeout, tap } from 'rxjs';
import { environment } from '../../../../environment';

export interface CreatePaymentRequest {
  amount: number; // in centesimi
  bookingId: string;
  currency?: string;
  description?: string;
}

interface CreatePaymentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
}

export interface PaymentIntentResultOk {
  ok: true;
  data: { clientSecret: string; paymentIntentId: string };
}

export interface PaymentIntentResultErr {
  ok: false;
  error: string;
  status?: number;
}

export type PaymentIntentResult = PaymentIntentResultOk | PaymentIntentResultErr;

@Injectable({
  providedIn: 'root'
})
export class PaymentApiService {
  private readonly baseUrl = environment.paymentApiBaseUrl;
  private readonly requestTimeoutMs = 15000;

  constructor(private http: HttpClient) {}

  /** Chiede al backend di creare un PaymentIntent Stripe */
  createPaymentIntent(payload: CreatePaymentRequest): Observable<{ clientSecret: string; paymentIntentId: string }> {
    const validationError = this.validateCreatePayload(payload);
    if (validationError) {
      return throwError(() => ({
        message: validationError,
        status: 400
      }));
    }

    const requestBody: CreatePaymentRequest = {
      amount: payload.amount,
      bookingId: payload.bookingId.trim(),
      currency: payload.currency ?? 'eur',
      description: payload.description
    };

    return this.http
      .post<CreatePaymentResponse>(`${this.baseUrl}/create`, requestBody)
      .pipe(
        timeout(this.requestTimeoutMs),
        map(res => this.mapCreatePaymentResponse(res)),
        tap(({ paymentIntentId }) => this.logDevPaymentIntent(paymentIntentId, requestBody.bookingId)),
        catchError((err: any) => {
          const msg = this.normalizeErrorMessage(err);
          return throwError(() => ({
            message: msg,
            status: err?.status,
            original: err
          }));
        })
      );
  }

  async createPaymentIntentSafe(payload: CreatePaymentRequest): Promise<PaymentIntentResult> {
    try {
      const data = await firstValueFrom(this.createPaymentIntent(payload));
      return { ok: true, data };
    } catch (err: any) {
      return {
        ok: false,
        error: String(err?.message ?? 'Errore creazione pagamento'),
        status: err?.status
      };
    }
  }

  private normalizeErrorMessage(err: any): string {
    if (!err) return 'Errore di rete durante la richiesta pagamento.';
    if (err?.name === 'TimeoutError') return 'Timeout chiamata pagamento. Riprova.';

    const status = Number(err?.status ?? 0);
    if (status === 0) return 'Backend pagamenti non raggiungibile.';
    if (status === 400) return err?.error?.error || 'Dati pagamento non validi.';
    if (status === 401 || status === 403) return 'Non autorizzato alla creazione pagamento.';
    if (status >= 500) return 'Errore interno del backend pagamenti.';

    return err?.error?.error || err?.message || 'Errore pagamento non previsto.';
  }

  private validateCreatePayload(payload: CreatePaymentRequest): string | null {
    if (!payload) return 'Payload pagamento mancante.';

    const amount = Number(payload.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return 'Importo pagamento non valido.';
    }

    if (!payload.bookingId || !payload.bookingId.trim()) {
      return 'bookingId obbligatorio.';
    }

    const currency = String(payload.currency ?? 'eur').trim().toLowerCase();
    if (!['eur', 'usd', 'gbp'].includes(currency)) {
      return 'Valuta non supportata.';
    }

    return null;
  }

  private mapCreatePaymentResponse(res: CreatePaymentResponse): { clientSecret: string; paymentIntentId: string } {
    if (!res?.success || !res?.clientSecret || !res?.paymentIntentId) {
      throw {
        message: 'Risposta backend pagamenti non valida.',
        status: 502
      };
    }

    return {
      clientSecret: res.clientSecret,
      paymentIntentId: res.paymentIntentId
    };
  }

  private logDevPaymentIntent(paymentIntentId: string, bookingId: string) {
    if (environment.production) return;
    console.debug('[payments] paymentIntent created', { paymentIntentId, bookingId });
  }
}

