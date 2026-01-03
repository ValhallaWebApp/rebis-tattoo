import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MaterialModule } from '../../../../../../core/modules/material.module';
import { CalendarEvent } from '../../../models/calendar';

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss']
})
export class MonthViewComponent implements OnChanges {
  @Input() date: Date | null = null;
  @Input() events: CalendarEvent[] | null = [];
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};
  @Input() role: 'admin' | 'client' | 'staff' = 'client';

  /** Creazione da giorno (CalendarComponentV2 usa (createFromDay) per openCreate) */
  @Output() createFromDay = new EventEmitter<{ date: string; time: string }>();

  monthDays: { date: Date; iso: string; label: number; events: CalendarEvent[] }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.buildMonth();
  }

  private buildMonth(): void {
    if (!this.date) {
      this.monthDays = [];
      return;
    }

    const base = new Date(this.date);
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-based

    // primo giorno del mese
    const firstDay = new Date(year, month, 1);
    const firstWeekDay = (firstDay.getDay() || 7) - 1; // 0-6 (lun-dom)

    // numero giorni nel mese
    const nextMonth = new Date(year, month + 1, 0);
    const daysInMonth = nextMonth.getDate();

    const days: { date: Date; iso: string; label: number; events: CalendarEvent[] }[] = [];

    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(year, month, i + 1);
      const iso = this.toISODate(d);
      const dayEvents = (this.events || []).filter(e => e.date === iso);
      days.push({
        date: d,
        iso,
        label: i + 1,
        events: dayEvents
      });
    }

    this.monthDays = days;
  }

  private toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  handleDayClick(dayIso: string): void {
    // ora predefinita per month view
    this.createFromDay.emit({ date: dayIso, time: '10:00' });
  }
}
