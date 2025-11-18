import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

interface CreatePaymentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentApiService {

  // poi spostiamo in environment se vuoi
  private readonly baseUrl = 'http://localhost:3000/api/payments';

  constructor(private http: HttpClient) {}

  /** Chiede al backend di creare un PaymentIntent Stripe */
  createPaymentIntent(payload: {
    amount: number;        // in centesimi
    currency?: string;
    description?: string;
  }): Observable<{ clientSecret: string; paymentIntentId: string }> {
    return this.http
      .post<CreatePaymentResponse>(`${this.baseUrl}/create`, payload)
      .pipe(
        map(res => ({
          clientSecret: res.clientSecret,
          paymentIntentId: res.paymentIntentId
        }))
      );
  }
}

