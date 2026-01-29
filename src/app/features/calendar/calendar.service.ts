// features/calendar/calendar.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  date: string;     // 'YYYY-MM-DD' (LOCALE)
  start: string;    // 'YYYY-MM-DDTHH:mm:ss' (LOCALE)
  end: string;      // 'YYYY-MM-DDTHH:mm:ss' (LOCALE)
  artistId: string;
  artistName?: string;
  isMine?: boolean;
  notes?: string;
  count?: number;
  duration?: number;
  type?: 'booking' | 'session';
  slotCount?: number;
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

  readonly visibleDays$ = combineLatest([this._view$, this._date$, this._events$]).pipe(
    map(([view, anchor, events]) => this.computeVisibleDays(view, anchor, events)),
    shareReplay(1)
  );

  readonly title$ = combineLatest([this._view$, this._date$]).pipe(
    map(([v, d]) => this.formatTitle(v, d)),
    shareReplay(1)
  );

  /* ---------------- MUTATIONS ---------------- */
  setView(v: CalendarView) { this._view$.next(v); }

  // ✅ importantissimo: nuovo oggetto Date, così Angular/rx emette sempre
  setDate(d: Date): void { this._date$.next(new Date(d.getTime())); }

  setEvents(list: CalendarEvent[]) { this._events$.next([...list]); }

  add(ev: CalendarEvent) {
    // evita duplicati “temporanei”
    const exists = this._events$.value.some(e =>
      e.date === ev.date &&
      e.start === ev.start &&
      e.artistId === ev.artistId &&
      (!e.id || e.id.startsWith('tmp')) &&
      (!ev.id || ev.id.startsWith('tmp'))
    );
    if (!exists) this._events$.next([...this._events$.value, ev]);
  }

  update(ev: CalendarEvent) {
    this._events$.next(this._events$.value.map(e => e.id === ev.id ? ev : e));
  }

  remove(id: string) {
    this._events$.next(this._events$.value.filter(e => e.id !== id));
  }

  /* --------------- NAVIGAZIONE -------------- */
  next(): void { this.shift(this._view$.value, +1); }
  prev(): void { this.shift(this._view$.value, -1); }

  private shift(view: CalendarView, dir: 1 | -1) {
    const d = new Date(this._date$.value.getTime());

    if (view === 'day') {
      d.setDate(d.getDate() + dir);
      this._date$.next(d);
      return;
    }

    if (view === 'week') {
      d.setDate(d.getDate() + dir * 7);
      this._date$.next(d);
      return;
    }

    // ✅ month: NON +30 giorni (drifta), ma cambio mese vero
    const dayOfMonth = d.getDate();
    d.setDate(1); // stabilizza (evita overflow tipo 31 -> mese dopo)
    d.setMonth(d.getMonth() + dir);
    // ripristina giorno se possibile
    const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dayOfMonth, max));

    this._date$.next(d);
  }

  /* --------------- HELPERS ------------------ */

  /**
   * ✅ DateKey LOCALE (mai toISOString)
   */
  private toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Week start = lunedì
   */
  private startOfWeekMonday(anchor: Date): Date {
    const start = new Date(anchor.getTime());
    const wd = start.getDay();           // 0 dom, 1 lun...
    const diff = wd === 0 ? -6 : 1 - wd; // se dom, vai indietro 6
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private computeVisibleDays(view: CalendarView, anchor: Date, events: CalendarEvent[]): VisibleDay[] {
    const days: VisibleDay[] = [];

    let start = new Date(anchor.getTime());
    start.setHours(0, 0, 0, 0);

    if (view === 'day') {
      const key = this.toLocalDateKey(start);
      days.push({ date: start, events: this.groupByArtist(events.filter(e => e.date === key)) });
      return days;
    }

    if (view === 'week') {
      start = this.startOfWeekMonday(anchor);
      for (let i = 0; i < 7; i++) {
        const day = new Date(start.getTime());
        day.setDate(start.getDate() + i);
        const key = this.toLocalDateKey(day);
        const dayEvents = events.filter(e => e.date === key);
        days.push({ date: day, events: this.groupByArtist(dayEvents) });
      }
      return days;
    }

    // month (griglia 6 settimane = 42 celle)
    // start = lunedì della settimana che contiene il 1° del mese
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start = this.startOfWeekMonday(firstOfMonth);

    for (let i = 0; i < 42; i++) {
      const day = new Date(start.getTime());
      day.setDate(start.getDate() + i);
      const key = this.toLocalDateKey(day);
      const dayEvents = events.filter(e => e.date === key);
      days.push({ date: day, events: this.groupByArtist(dayEvents) });
    }

    return days;
  }

  private groupByArtist(dayEvents: CalendarEvent[]): CalendarEvent[] {
    const byArtist: Record<string, CalendarEvent> = {};

    for (const ev of dayEvents) {
      const key = ev.artistId ?? '_unknown_';
      if (!byArtist[key]) {
        byArtist[key] = { ...ev, count: 1 };
      } else {
        byArtist[key].count = (byArtist[key].count ?? 1) + 1;
      }
    }

    return Object.values(byArtist);
  }

  private formatTitle(view: CalendarView, date: Date): string {
    if (view === 'day') {
      return date.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }

    if (view === 'week') {
      const start = this.startOfWeekMonday(date);
      const end = new Date(start.getTime());
      end.setDate(start.getDate() + 6);

      const s = start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      const e = end.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

      return `${s} – ${e}`;
    }

    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }
}
