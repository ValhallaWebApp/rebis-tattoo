import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  CalendarDragUpdate,
  CalendarEvent,
} from '../../../models/calendar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-week-view',
  templateUrl: './week-view.component.html',
  standalone:true,
  imports:[CommonModule],
  styleUrls: ['./week-view.component.scss'],
})
export class WeekViewComponent implements OnChanges {
  @Input() date: Date | null = null;
  @Input() events: CalendarEvent[] | null = [];
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};
  @Input() role: 'admin' | 'client' | 'staff' = 'client';

  @Output() eventDropped = new EventEmitter<CalendarDragUpdate>();
  @Output() createFromSlot = new EventEmitter<{
    date: string;
    time: string;
    artistId?: string;
  }>();

  /** Giorni della settimana mostrata */
  weekDays: { iso: string; label: string; dayNumber: number }[] = [];

  /** Orari selezionabili (statici) */
  hours: string[] = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['date']) {
      this.buildWeekDays();
    }
  }

  /** Calcola i 7 giorni (lun → dom) intorno alla data selezionata */
  private buildWeekDays(): void {
    const base = this.date ? new Date(this.date) : new Date();

    // Inizio settimana (lunedì)
    const day = base.getDay(); // 0 = dom, 1 = lun, ...
    const diff = (day === 0 ? -6 : 1) - day; // shift a lunedì
    const monday = new Date(base);
    monday.setDate(base.getDate() + diff);

    const days: { iso: string; label: string; dayNumber: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const iso = d.toISOString().substring(0, 10); // YYYY-MM-DD

      const dayNumber = d.getDate();
      const weekdayLabel = d.toLocaleDateString('it-IT', {
        weekday: 'short',
      }); // lun, mar, ...

      days.push({
        iso,
        label: weekdayLabel,
        dayNumber,
      });
    }

    this.weekDays = days;
  }

  /** Click su slot vuoto → emit per aprire il drawer */
  onSlotClick(dayIso: string, hour: string): void {
    this.createFromSlot.emit({
      date: dayIso,
      time: hour,
    });
  }

  /** Eventi che cadono in quello slot (giorno + ora) */
  getEventsForSlot(dayIso: string, hour: string): CalendarEvent[] {
    if (!this.events || !dayIso) return [];

    const [hh, mm] = hour.split(':').map(Number);

    return this.events.filter((ev) => {
      if (!ev.start) return false;
      const start = new Date(ev.start);
      const evDate = ev.date ?? ev.start.substring(0, 10);
      return (
        evDate === dayIso &&
        start.getHours() === hh &&
        start.getMinutes() === mm
      );
    });
  }

  /** Flag per colorare le prenotazioni dell'utente */
  isMine(ev: CalendarEvent): boolean {
    return !!ev.metadata && (ev.metadata['isMine'] as boolean);
  }
}
