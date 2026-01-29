import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { UiArtist, UiCalendarEvent } from '../../models';
import { toDateKey } from '../../utils';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss'],
})
export class DayViewComponent {
  @Input({ required: true }) date!: Date;
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  @Output() createFromSlot = new EventEmitter<{ artistId: string; startISO: string; endISO: string; durationMinutes: number }>();
  @Output() editEvent = new EventEmitter<UiCalendarEvent>();

  readonly startHour = 8;
  readonly endHour = 20;
  readonly stepMinutes = 30;
  readonly defaultDuration = 60;

  readonly dayKey = computed(() => toDateKey(this.date));

  readonly timeRows = computed(() => {
    const rows: { label: string; minutes: number }[] = [];
    for (let h = this.startHour; h <= this.endHour; h++) {
      rows.push({ label: `${String(h).padStart(2, '0')}:00`, minutes: h * 60 });
      if (h !== this.endHour) {
        rows.push({ label: `${String(h).padStart(2, '0')}:30`, minutes: h * 60 + 30 });
      }
    }
    return rows;
  });

  eventsForArtist(artistId: string) {
    const key = this.dayKey();
    return this.events
      .filter(e => e.artistId === artistId)
      .filter(e => (new Date(e.start)).toISOString().slice(0, 10) === key)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  onClickSlot(artistId: string, minutes: number) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(minutes);
    const start = d;
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + this.defaultDuration);

    this.createFromSlot.emit({
      artistId,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      durationMinutes: this.defaultDuration,
    });
  }

  // minimal rendering: show events list per artist with time
  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
}
