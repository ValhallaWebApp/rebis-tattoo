import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiArtist, UiCalendarEvent } from '../../../models';
import { addDays, toDateKey } from '../../../utils';

@Component({
  selector: 'app-week-resource',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './week-resource.component.html',
  styleUrls: ['./week-resource.component.scss'],
})
export class WeekResourceComponent {
  @Input({ required: true }) range!: { start: Date; end: Date };
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  @Output() openDay = new EventEmitter<{ artistId: string; dateKey: string }>();

  readonly days = computed(() => {
    const out: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(this.range.start, i);
      out.push({
        key: toDateKey(d),
        date: d,
        label: d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' }),
      });
    }
    return out;
  });

  countFor(artistId: string, dateKey: string): number {
    return this.events.filter(e => e.artistId === artistId).filter(e => toDateKey(new Date(e.start)) === dateKey).length;
  }

  intensityClass(count: number): string {
    if (count === 0) return 'c0';
    if (count === 1) return 'c1';
    if (count <= 3) return 'c2';
    return 'c3';
  }
}
