// features/calendar/calendar.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { Booking } from '../../core/services/bookings/booking.service';
import { StaffMember } from '../../core/services/staff/staff.service';

export type CalendarView = 'day' | 'week' | 'month';
export interface CalendarEvent {
  id: string;
  date: string;                 // '2025-07-20'
  start: string;
  end:string;              // '10:00'
  artistId: string;
  artistName?: string;
  isMine?: boolean;
  description?: string;
  count?: number;
  duration?: number;           // in minuti, es: 60 = 2 slot
  type?: 'booking' | 'session';
  slotCount?: number;          // opzionale: puoi calcolarlo da duration
}

export interface CalendarInputData {
  bookings: Booking[];
  artists: StaffMember[];
  user?: any;
}

interface VisibleDay {
  date: Date;
  events: CalendarEvent[];
}

@Injectable({ providedIn: 'root' })
export class CalendarService {

  /* ---------------- STATE ---------------- */
  private _view$ = new BehaviorSubject<CalendarView>('week');
  private _date$ = new BehaviorSubject<Date>(new Date());
  private _events$ = new BehaviorSubject<CalendarEvent[]>([]);

  /* --------------- SELECTORS ------------- */
  readonly view$ = this._view$.asObservable();
  readonly date$ = this._date$.asObservable();
  readonly events$ = this._events$.asObservable();

  /** Giorni visibili (include gli eventi deduplicati per artista) */
  readonly visibleDays$ = combineLatest([
    this._view$,
    this._date$,
    this._events$
  ]).pipe(
    map(([view, anchor, events]) => this.computeVisibleDays(view, anchor, events)),
    shareReplay(1)
  );
readonly title$ = combineLatest([this._view$, this._date$]).pipe(
  map(([v, d]) => this.formatTitle(v, d)),
  shareReplay(1)
);



  /* ---------------- MUTATIONS ---------------- */
  setView(v: CalendarView) { this._view$.next(v); }
setDate(d: Date): void {
  this._date$.next(new Date(d.getTime())); // nuovo oggetto Date
}

  setEvents(list: CalendarEvent[]) { this._events$.next([...list]); }

add(ev: CalendarEvent) {
  const exists = this._events$.value.some(e =>
    e.date === ev.date &&
    e.start === ev.start &&
    e.artistId === ev.artistId &&
    (!e.id || e.id.startsWith('tmp')) &&
    (!ev.id || ev.id.startsWith('tmp')) // Entrambi sono temporanei
  );

  if (!exists) {
    this._events$.next([...this._events$.value, ev]);
  }
}

  update(ev: CalendarEvent) { this._events$.next(this._events$.value.map(e => e.id === ev.id ? ev : e)); }
  remove(id: string) { this._events$.next(this._events$.value.filter(e => e.id !== id)); }

  /* --------------- NAVIGAZIONE -------------- */
  next(): void { this.shiftDate(this.step(this._view$.value)); }
  prev(): void { this.shiftDate(-this.step(this._view$.value)); }

  /* --------------- HELPERS ------------------ */
  private shiftDate(days: number): void {
    const next = new Date(this._date$.value);
    next.setDate(next.getDate() + days);
    this._date$.next(next); // questo emette
  }

  private step(view: CalendarView): number {
    switch (view) {
      case 'day': return 1;
      case 'week': return 7;
      default: return 30;  // month
    }
  }

  private computeVisibleDays(view: CalendarView, anchor: Date, events: CalendarEvent[]): VisibleDay[] {
    const days: VisibleDay[] = [];

    const start = new Date(anchor);

    // Per week & month partiamo dal lunedì della settimana che include "anchor"
    if (view !== 'day') {
      const wd = start.getDay();           // 0 = domenica, 1 = lunedì …
      const diff = wd === 0 ? -6 : 1 - wd; // se domenica, vai indietro di 6
      start.setDate(start.getDate() + diff);
    }

    const total = view === 'day' ? 1 : view === 'week' ? 7 : 42; // 6 settimane per il mese

    for (let i = 0; i < total; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);

      const iso = day.toISOString().split('T')[0];
      const dayEvents = events.filter(e => e.date === iso);

      // 🔥 Raggruppiamo per artista per non ripetere lo stesso artista nello stesso giorno
      const byArtist: Record<string, CalendarEvent> = {};
      console.log(dayEvents)
      dayEvents.forEach(ev => {
        const key = ev.artistId ?? '_unknown_';
        if (!byArtist[key]) {
          byArtist[key] = { ...ev, count: 1 };
        } else {
          byArtist[key].count! += 1;
        }
      });

      days.push({
        date: day,
        events: Object.values(byArtist)
      });
    }

    return days;
  }

private formatTitle(view: CalendarView, date: Date): string {
  console.log('🧠 Calcolo titolo per:', view, date);

  if (view === 'day') {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  if (view === 'week') {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();

    const startStr = start.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: sameMonth ? 'long' : 'short',
      year: sameYear ? undefined : 'numeric'
    });

    const endStr = end.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const result = `${startStr} – ${endStr}`;
    console.log('📆 Nuovo titolo:', result);
    return result;
  }

  return date.toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric'
  });
}


}
