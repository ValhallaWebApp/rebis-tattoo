import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiArtist, UiCalendarEvent } from '../../models';
import { addDays, toDateKey } from '../../utils';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [CommonModule,MaterialModule],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
})
export class MonthViewComponent {
  @Input({ required: true }) anchor!: Date;
  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];

  @Output() openDay = new EventEmitter<{ dateKey: string }>();

  readonly gridDays = computed(() => {
    const d = new Date(this.anchor);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = new Date(first);
    const day = start.getDay();
    const diffToMon = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMon);

    const cells: { date: Date; key: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const cur = addDays(start, i);
      cells.push({
        date: cur,
        key: toDateKey(cur),
        inMonth: cur.getMonth() === d.getMonth(),
      });
    }
    return cells;
  });

  countForDay(key: string): number {
    return this.events.filter(e => toDateKey(new Date(e.start)) === key).length;
  }
}
