import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { firstValueFrom } from 'rxjs';
import { StripePaymentComponent } from '../../../../../shared/components/stripe-payment/stripe-payment.component';
import { Booking, BookingService } from '../../../../../core/services/bookings/booking.service';
import { environment } from '../../../../../../environment';
import { Invoice, InvoicesService } from '../../../../../core/services/invoices/invoices.service';
import { PaymentApiService } from '../../../../../core/services/payments/payment-api.service';
import { MaterialModule } from '../../../../../core/modules/material.module';

@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    StripePaymentComponent   // ⬅ importa il componente shared
  ],
  templateUrl: './booking-detail.component.html',
  styleUrls: ['./booking-detail.component.scss']
})
export class BookingDetailComponent implements OnInit {

  booking?: Booking;
  loading = true;
  error?: string;

  // 🔹 Stripe
  publishableKey = environment.stripePublishableKey;
  clientSecret?: string;
  creatingPayment = false;
  paymentStarted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingService,
    private invoicesService: InvoicesService,
    private paymentsApi: PaymentApiService
  ) {}

  async ngOnInit() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) {
        this.error = 'ID prenotazione mancante';
        return;
      }

      const booking = await this.bookingService.getBookingById(id);
      if (!booking) {
        this.error = 'Prenotazione non trovata';
        return;
      }

      this.booking = booking;
      this.loading = false;
    } catch (e: any) {
      this.error = e.message || 'Errore nel caricamento della prenotazione';
    }
  }

  /** 1) Chiamata al backend Node per creare il PaymentIntent */
  async startPayment() {
    if (!this.booking || this.creatingPayment || this.clientSecret) return;

    this.creatingPayment = true;
    this.error = undefined;

    try {
      const amount = (this.booking.price || 0) * 100; // € → centesimi

      const res = await firstValueFrom(
        this.paymentsApi.createPaymentIntent({
          amount,
          currency: 'eur',
          description: `Acconto consulenza #${this.booking.id}`
        })
      );

      this.clientSecret = res.clientSecret;
      this.paymentStarted = true;
    } catch (e: any) {
      console.error(e);
      this.error = e.message || 'Errore nella creazione del pagamento';
    } finally {
      this.creatingPayment = false;
    }
  }

  /** 2) Callback quando StripePayment emette success */
  async onPaymentSuccess() {
    if (!this.booking) return;
    const booking = this.booking;

    // Aggiorna stato prenotazione
    await this.bookingService.safeSetStatus(booking.id, 'paid', {
      paidAmount: booking.price
    });

    // Crea fattura
    const now = new Date().toISOString();
    const invoice: Invoice = {
      bookingId: booking.id,
      clientId: booking.idClient,
      clientName: 'Cliente',      // se hai il nome in un service, sostituisci
      date: now,
      amount: booking.price,
      status: 'paid',
      items: [
        { description: booking.description, quantity: 1, price: booking.price }
      ],
      notes: booking.description,
      createdAt: now,
      updatedAt: now
    };

    await this.invoicesService.addInvoice(invoice);

    // Redirect dove vuoi → dashboard cliente / lista prenotazioni
    this.router.navigate(['/features/clients']); // adatta la rotta
  }

  /** 3) Callback errore da StripePayment */
  onPaymentError(msg: string) {
    this.error = msg;
  }
}
