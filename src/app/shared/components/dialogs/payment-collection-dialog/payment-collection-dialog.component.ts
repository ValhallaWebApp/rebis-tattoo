import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { PaymentApiService } from '../../../../core/services/payments/payment-api.service';
import { StripePaymentComponent } from '../../stripe-payment/stripe-payment.component';
import { environment } from '../../../../../environment';

export interface PaymentCollectionDialogData {
  title: string;
  subtitle?: string;
  defaultAmountEuro?: number;
  bookingId: string;
  description: string;
  referenceType?: 'booking' | 'project' | 'session' | 'gift_card' | string;
  referenceId?: string;
  referenceLabel?: string;
}

export interface PaymentCollectionDialogResult {
  ok: boolean;
  amountEuro: number;
  paymentIntentId?: string;
}

@Component({
  selector: 'app-payment-collection-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, MatDialogModule, StripePaymentComponent],
  templateUrl: './payment-collection-dialog.component.html',
  styleUrl: './payment-collection-dialog.component.scss'
})
export class PaymentCollectionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly paymentApi = inject(PaymentApiService);

  readonly publishableKey = environment.stripePublishableKey;

  readonly form = this.fb.nonNullable.group({
    amountEuro: [0, [Validators.required, Validators.min(0.5)]]
  });

  creatingIntent = false;
  clientSecret: string | null = null;
  paymentIntentId: string | null = null;
  error: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PaymentCollectionDialogData,
    private readonly dialogRef: MatDialogRef<PaymentCollectionDialogComponent, PaymentCollectionDialogResult>
  ) {
    this.form.patchValue({ amountEuro: data.defaultAmountEuro ?? 0 });
  }

  async createIntent(): Promise<void> {
    if (this.form.invalid || this.creatingIntent) return;

    const amountEuro = Number(this.form.value.amountEuro ?? 0);
    const amountCents = Math.round(amountEuro * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      this.error = 'Importo non valido.';
      return;
    }

    this.creatingIntent = true;
    this.error = null;
    this.clientSecret = null;
    this.paymentIntentId = null;

    try {
      const result = await this.paymentApi.createPaymentIntentSafe({
        amount: amountCents,
        bookingId: this.data.bookingId,
        currency: 'eur',
        description: this.data.description,
        referenceType: this.data.referenceType,
        referenceId: this.data.referenceId,
        referenceLabel: this.data.referenceLabel
      });

      if (!result.ok) {
        this.error = result.error || 'Errore creazione pagamento.';
        return;
      }

      this.clientSecret = result.data.clientSecret;
      this.paymentIntentId = result.data.paymentIntentId;
    } finally {
      this.creatingIntent = false;
    }
  }

  onStripeSuccess(): void {
    const amountEuro = Number(this.form.value.amountEuro ?? 0);
    this.dialogRef.close({
      ok: true,
      amountEuro,
      paymentIntentId: this.paymentIntentId ?? undefined
    });
  }

  onStripeError(message: string): void {
    this.error = message || 'Pagamento non riuscito.';
  }

  close(): void {
    this.dialogRef.close({
      ok: false,
      amountEuro: Number(this.form.value.amountEuro ?? 0)
    });
  }
}
