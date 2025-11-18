import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { MaterialModule } from '../../../core/modules/material.module';

@Component({
  selector: 'app-stripe-payment',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './stripe-payment.component.html',
  styleUrls: ['./stripe-payment.component.scss']
})
export class StripePaymentComponent implements OnInit, OnDestroy {

  @Input() publishableKey!: string;
  @Input() clientSecret!: string;

  @Output() paymentSuccess = new EventEmitter<void>();
  @Output() paymentError = new EventEmitter<string>();

  private stripePromise?: Promise<Stripe | null>;
  elements?: StripeElements;
  paymentElement?: StripePaymentElement;

  paying = false;
  elementReady = false;

  ngOnInit(): void {
    // ⚠️ Safety: chiave o clientSecret mancanti
    if (!this.publishableKey || !this.clientSecret) {
      console.error('StripePaymentComponent: publishableKey o clientSecret mancanti');
      this.paymentError.emit('Configurazione Stripe non valida.');
      return;
    }

    this.stripePromise = loadStripe(this.publishableKey);
    this.initStripe();
  }

  async initStripe() {
    try {
      const stripe = await this.stripePromise;
      if (!stripe) {
        console.error('Stripe non inizializzato');
        this.paymentError.emit('Stripe non disponibile.');
        return;
      }

      console.log('Inizializzo Elements con clientSecret:', this.clientSecret);

      this.elements = stripe.elements({ clientSecret: this.clientSecret });
      this.paymentElement = this.elements.create('payment');

      // Debug + stato di pronto
      this.paymentElement.on('ready', () => {
        console.log('Payment Element ready');
        this.elementReady = true;
      });

      this.paymentElement.on('loaderror', (event) => {
        console.error('Payment Element loaderror', event);
        this.paymentError.emit('Errore nel caricamento del modulo di pagamento Stripe.');
      });

      this.paymentElement.mount('#payment-element');

    } catch (err: any) {
      console.error('Errore initStripe:', err);
      this.paymentError.emit(err?.message || 'Errore Stripe.');
    }
  }

  ngOnDestroy(): void {
    this.paymentElement?.unmount();
  }

  async pay() {
    if (!this.elements || !this.stripePromise) {
      this.paymentError.emit('Stripe non inizializzato correttamente.');
      return;
    }
    if (!this.elementReady) {
      this.paymentError.emit('Il modulo di pagamento non è pronto. Riprova tra qualche secondo.');
      return;
    }

    this.paying = true;

    const stripe = await this.stripePromise;
    if (!stripe) {
      this.paymentError.emit('Stripe non disponibile.');
      this.paying = false;
      return;
    }

    // 🔹 1) OBBLIGATORIO con il nuovo Payment Element
    const { error: submitError } = await this.elements.submit();
    if (submitError) {
      console.error('Errore elements.submit():', submitError);
      this.paymentError.emit(submitError.message || 'Errore nella validazione del pagamento.');
      this.paying = false;
      return;
    }

    // 🔹 2) Solo dopo submit() chiamiamo confirmPayment
    const { error } = await stripe.confirmPayment({
      elements: this.elements,
      clientSecret: this.clientSecret,
      redirect: 'if_required'
    });

    this.paying = false;

    if (error) {
      console.error('Errore confirmPayment:', error);
      this.paymentError.emit(error.message || 'Pagamento fallito.');
    } else {
      this.paymentSuccess.emit();
    }
  }
}
