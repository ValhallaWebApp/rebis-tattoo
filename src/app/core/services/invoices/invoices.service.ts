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
  date: string; // ISO string
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
      onValue(invoicesRef, (snapshot) => {
        const data = snapshot.val();
        const invoices: Invoice[] = data
          ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
          : [];
        observer.next(invoices);
      });
    });
  }

  getInvoicesByClient(clientId: string): Observable<Invoice[]> {
    return new Observable<Invoice[]>((observer) => {
      const invoicesQuery = query(
        ref(this.db, this.path),
        orderByChild('clientId'),
        equalTo(clientId)
      );

      onValue(invoicesQuery, (snapshot) => {
        const data = snapshot.val();
        const invoices: Invoice[] = data
          ? Object.entries(data).map(([id, val]: any) => ({ id, ...val }))
          : [];
        observer.next(invoices);
      });
    });
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));
    return snapshot.exists() ? { id, ...snapshot.val() } : null;
  }

  addInvoice(invoice: Invoice): Promise<void> {
    const newRef = push(ref(this.db, this.path));
    const now = new Date().toISOString();

    return set(newRef, {
      ...invoice,
      bookingId: newRef.key,
      createdAt: now,
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
      onValue(invoicesRef, (snapshot) => {
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
      });
    });
  }
}
