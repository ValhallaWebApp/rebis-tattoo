import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map, Observable, catchError, throwError, tap } from 'rxjs';
import { environment } from '../../../../environment';
import { mapHttpError } from '../../http/http-error.mapper';
import { withCriticalHttpPolicy } from '../../http/http-policy';
import {
  CreatePaymentIntentRequestDto,
  CreatePaymentIntentResponseDto
} from '../../models/api/payment-bridge.dto';

export type CreatePaymentRequest = CreatePaymentIntentRequestDto;

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
      .post<CreatePaymentIntentResponseDto>(`${this.baseUrl}/create`, requestBody)
      .pipe(
        withCriticalHttpPolicy(),
        map(res => this.mapCreatePaymentResponse(res)),
        tap(({ paymentIntentId }) => this.logDevPaymentIntent(paymentIntentId, requestBody.bookingId)),
        catchError((err: unknown) => {
          const mapped = mapHttpError(err, {
            fallbackMessage: 'Errore pagamento non previsto.',
            timeoutMessage: 'Timeout chiamata pagamento. Riprova.',
            networkMessage: 'Backend pagamenti non raggiungibile.',
            badRequestMessage: 'Dati pagamento non validi.',
            unauthorizedMessage: 'Non autorizzato alla creazione pagamento.',
            serverMessage: 'Errore interno del backend pagamenti.'
          });
          return throwError(() => ({
            message: mapped.message,
            status: mapped.status,
            original: mapped.original
          }));
        })
      );
  }

  async createPaymentIntentSafe(payload: CreatePaymentRequest): Promise<PaymentIntentResult> {
    try {
      const data = await firstValueFrom(this.createPaymentIntent(payload));
      return { ok: true, data };
    } catch (err: unknown) {
      const mapped = mapHttpError(err, {
        fallbackMessage: 'Errore creazione pagamento'
      });
      return {
        ok: false,
        error: mapped.message,
        status: mapped.status
      };
    }
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

  private mapCreatePaymentResponse(res: CreatePaymentIntentResponseDto): { clientSecret: string; paymentIntentId: string } {
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

