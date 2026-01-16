import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { FastBookingStore } from '../../state/fast-booking-store.service';
import { MaterialModule } from '../../../../../core/modules/material.module';

@Component({
  selector: 'app-step-payment',
  standalone: true,
  imports: [CommonModule,MaterialModule, MatButtonModule, MatIconModule],
  templateUrl: './step-payment.component.html',
  styleUrl: './step-payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepPaymentComponent {
  readonly store = inject(FastBookingStore);

  readonly draft = this.store.draft;
  readonly paying = this.store.paying;
  readonly error = this.store.error;

  readonly bookingId = this.store.bookingId;
  readonly clientSecret = this.store.paymentClientSecret;
  readonly depositEuro = this.store.depositEuro;

  pay() {
    this.store.startPayment();
  }

  // hook: quando Stripe dice OK (qui bottone manuale)
  confirmSuccess() {
    this.store.confirmPaymentSuccess();
  }
}
