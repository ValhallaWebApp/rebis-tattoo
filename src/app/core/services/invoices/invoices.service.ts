import { Injectable } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  get,
  query,
  orderByChild,
  equalTo
} from '@angular/fire/database';
import { Observable } from 'rxjs';

export interface Invoice {
  bookingId: string;
  id?: string;
  clientId: string;
  clientName: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'cancelled';
  items: {
    description: string;
    quantity: number;
    price: number;
  }[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoicesService {
  private readonly path = 'invoices';

  constructor(private db: Database) {}

  getInvoices(): Observable<Invoice[]> {
    return new Observable<Invoice[]>((observer) => {
      const invoicesRef = ref(this.db, this.path);
      const unsub = onValue(
        invoicesRef,
        (snapshot) => {
          const data = snapshot.val();
          const invoices: Invoice[] = data
            ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
            : [];
          observer.next(invoices);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getInvoicesByClient(clientId: string): Observable<Invoice[]> {
    return new Observable<Invoice[]>((observer) => {
      const invoicesQuery = query(
        ref(this.db, this.path),
        orderByChild('clientId'),
        equalTo(clientId)
      );

      const unsub = onValue(
        invoicesQuery,
        (snapshot) => {
          const data = snapshot.val();
          const invoices: Invoice[] = data
            ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
            : [];
          observer.next(invoices);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
  }

  private normalizeString(value: unknown): string {
    return String(value ?? '').trim();
  }

  private resolveBookingClientId(booking: Record<string, unknown>): string {
    const canonical = this.normalizeString((booking as any)?.clientId);
    if (canonical) return canonical;
    return this.normalizeString((booking as any)?.idClient);
  }

  async addInvoice(invoice: Invoice): Promise<void> {
    const newRef = push(ref(this.db, this.path));
    const id = newRef.key ?? `${Date.now()}`;
    const now = new Date().toISOString();
    const bookingId = this.normalizeString(invoice.bookingId);
    const clientId = this.normalizeString(invoice.clientId);

    if (!bookingId) {
      throw new Error('bookingId obbligatorio per creare fattura');
    }
    if (!clientId) {
      throw new Error('clientId obbligatorio per creare fattura');
    }

    const bookingSnap = await get(ref(this.db, `bookings/${bookingId}`));
    if (!bookingSnap.exists()) {
      throw new Error(`BOOKING_NOT_FOUND:${bookingId}`);
    }

    const booking = (bookingSnap.val() ?? {}) as Record<string, unknown>;
    const bookingClientId = this.resolveBookingClientId(booking);
    if (!bookingClientId) {
      throw new Error(`BOOKING_CLIENT_ID_MISSING:${bookingId}`);
    }
    if (bookingClientId !== clientId) {
      throw new Error(`INVOICE_CLIENT_BOOKING_MISMATCH:${clientId}:${bookingClientId}`);
    }

    const invoiceByBookingSnap = await get(
      query(ref(this.db, this.path), orderByChild('bookingId'), equalTo(bookingId))
    );
    if (invoiceByBookingSnap.exists()) {
      throw new Error(`INVOICE_ALREADY_EXISTS_FOR_BOOKING:${bookingId}`);
    }

    await set(newRef, {
      ...invoice,
      id,
      bookingId,
      clientId,
      createdAt: invoice.createdAt ?? now,
      updatedAt: now
    });
  }

  updateInvoice(id: string, changes: Partial<Invoice>): Promise<void> {
    return update(ref(this.db, `${this.path}/${id}`), {
      ...changes,
      updatedAt: new Date().toISOString()
    });
  }

  deleteInvoice(id: string): Promise<void> {
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  getTotalRevenue(): Observable<number> {
    return new Observable<number>((observer) => {
      const invoicesRef = ref(this.db, this.path);
      const unsub = onValue(
        invoicesRef,
        (snapshot) => {
          const data = snapshot.val();
          let total = 0;
          if (data) {
            Object.values(data).forEach((i: any) => {
              if (i.status === 'paid' && typeof i.amount === 'number') {
                total += i.amount;
              }
            });
          }
          observer.next(total);
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }
}
