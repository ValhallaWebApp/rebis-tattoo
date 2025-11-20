export interface Invoice {
  id: string;
  clientId: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  issuedAt: string;
  paidAt?: string;
  stripePaymentIntentId?: string;
}
