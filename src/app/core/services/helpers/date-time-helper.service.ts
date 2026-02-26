import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DateTimeHelperService {
  normalizeLocalDateTime(input: string): string {
    if (!input) return '';
    let value = String(input).replace('Z', '');
    value = value.split('.')[0];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return this.toLocalDateTime(parsed);
    return value;
  }

  formatLocalDateTime(input: string): string {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return input;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }

  toTimestamp(input?: string): number {
    if (!input) return 0;
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  toLocalDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}
