import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
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
export class WeekResourceComponent implements OnChanges {
  @Input({ required: true }) range!: { start: Date; end: Date };
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  @Output() openDay = new EventEmitter<{ artistId: string; dateKey: string }>();

  private readonly rangeSig = signal<{ start: Date; end: Date }>({ start: new Date(), end: new Date() });
  private readonly eventsSig = signal<UiCalendarEvent[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['range'] && changes['range'].currentValue) {
      this.rangeSig.set(changes['range'].currentValue);
    }
    if (changes['events']) {
      this.eventsSig.set(changes['events'].currentValue ?? []);
    }
  }

  readonly days = computed(() => {
    const out: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(this.rangeSig().start, i);
      out.push({
        key: toDateKey(d),
        date: d,
        label: d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' }),
      });
    }
    return out;
  });

  countFor(artistId: string, dateKey: string): number {
    return this.eventsSig()
      .filter(e => e.artistId === artistId)
      .filter(e => toDateKey(new Date(e.start)) === dateKey)
      .length;
  }

  intensityClass(count: number): string {
    if (count === 0) return 'c0';
    if (count === 1) return 'c1';
    if (count <= 3) return 'c2';
    return 'c3';
  }
}
