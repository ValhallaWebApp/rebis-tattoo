import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CurrencyHelperService {
  formatEur(value: unknown, fallback = '-'): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return fallback;
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount);
  }
}
