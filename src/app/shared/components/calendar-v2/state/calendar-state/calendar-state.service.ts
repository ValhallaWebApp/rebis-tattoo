import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { CalendarEvent, CalendarView } from '../../models/calendar';

@Injectable({
  providedIn: 'root'
})
export class CalendarStateService {

  // ============================
  //     STATE SUBJECTS
  // ============================

  /** Vista attuale: 'day' | 'week' | 'month' */
  private readonly viewSubject = new BehaviorSubject<CalendarView>('week');
  readonly view$ = this.viewSubject.asObservable();

  /** Data base su cui generare tutte le viste */
  private readonly dateSubject = new BehaviorSubject<Date>(new Date());
  readonly date$ = this.dateSubject.asObservable();

  /** Eventi normalizzati (CalendarEvent[]) */
  private readonly eventsSubject = new BehaviorSubject<CalendarEvent[]>([]);
  readonly events$ = this.eventsSubject.asObservable();

  /** Titolo leggibile per la toolbar */
  readonly title$: Observable<string> = combineLatest([
    this.view$,
    this.date$
  ]).pipe(
    map(([view, date]) => this.buildTitle(view, date))
  );

  // ============================
  //           SETTERS
  // ============================

  /** Cambia la vista */
  setView(view: CalendarView): void {
    this.viewSubject.next(view);
  }

  /** Imposta una nuova data come base */
  setDate(date: Date): void {
    this.dateSubject.next(date);
  }

  /** Vai ad oggi */
  setToday(): void {
    this.dateSubject.next(new Date());
  }

  /** Aggiorna gli eventi */
  setEvents(events: CalendarEvent[]): void {
    this.eventsSubject.next(events ?? []);
  }

  // ============================
  //       NAVIGAZIONE TEMPO
  // ============================

  next(): void {
    const view = this.viewSubject.value;
    const date = this.dateSubject.value;
    this.dateSubject.next(this.shiftDate(date, view, +1));
  }

  prev(): void {
    const view = this.viewSubject.value;
    const date = this.dateSubject.value;
    this.dateSubject.next(this.shiftDate(date, view, -1));
  }

  // ============================
  //         HELPERS PRIVATI
  // ============================

  /**
   * Sposta la data base di un giorno, settimana o mese.
   */
  private shiftDate(base: Date, view: CalendarView, direction: 1 | -1): Date {
    const d = new Date(base);
    switch (view) {
      case 'day':
        d.setDate(d.getDate() + direction);
        break;

      case 'week':
        d.setDate(d.getDate() + 7 * direction);
        break;

      case 'month':
        d.setMonth(d.getMonth() + direction);
        break;
    }
    return d;
  }

  /**
   * Costruisce il titolo leggibile per la toolbar
   */
  private buildTitle(view: CalendarView, date: Date): string {
    const M = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    const day = date.getDate();
    const month = M[date.getMonth()];
    const year = date.getFullYear();

    switch (view) {
      case 'day':
        return `${day} ${month} ${year}`;

      case 'week': {
        const start = new Date(date);
        const end = new Date(date);
        end.setDate(end.getDate() + 6);

        const endDay = end.getDate();
        const endMonth = M[end.getMonth()];

        if (start.getMonth() === end.getMonth()) {
          return `Settimana ${day}–${endDay} ${month} ${year}`;
        }

        return `Settimana ${day} ${month} – ${endDay} ${endMonth} ${year}`;
      }

      case 'month':
      default:
        return `${month} ${year}`;
    }
  }
}
