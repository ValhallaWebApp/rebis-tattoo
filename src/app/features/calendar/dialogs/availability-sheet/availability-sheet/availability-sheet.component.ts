import { MatCalendarBody } from '@angular/material/datepicker';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatBottomSheetModule, MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { AvailabilityService } from '../../../availability.service';
import { NewEventSeed, UiArtist, UiCalendarEvent } from '../../../models';
import { toDateKey } from '../../../utils';
import { MaterialModule } from '../../../../../core/modules/material.module';

export interface AvailabilitySheetData {
  seed: (NewEventSeed & { type: 'booking' | 'session' });
  artists: UiArtist[];
  events: UiCalendarEvent[];
}

export interface AvailabilitySheetResult {
  startISO: string;
  endISO: string;
}

@Component({
  selector: 'app-availability-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatBottomSheetModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MaterialModule,
        MatCalendarBody,

  ],
  templateUrl: './availability-sheet.component.html',
  styleUrls: ['./availability-sheet.component.scss'],
})
export class AvailabilitySheetComponent {
  private readonly av = inject(AvailabilityService);
  private readonly ref = inject(MatBottomSheetRef<AvailabilitySheetComponent, AvailabilitySheetResult>);
  readonly data = inject<AvailabilitySheetData>(MAT_BOTTOM_SHEET_DATA);

  // ✅ ora data è disponibile già qui
  readonly mode = signal<'byDate' | 'byTime'>(this.data.seed.mode);

  // byDate
  readonly selectedDateKey = signal<string>(toDateKey(new Date()));
  readonly slots = computed(() => {
    const artistEvents = this.data.events.filter(e => e.artistId === this.data.seed.artistId);
    const res = this.av.getAvailableTimesByDate({
      artistId: this.data.seed.artistId,
      durationMinutes: this.data.seed.durationMinutes,
      events: artistEvents,
      date: this.selectedDateKey(),
      stepMinutes: 30,
      workdayStart: '08:00',
      workdayEnd: '20:00',
    });
    return res.slots;
  });

  // byTime
  readonly selectedTime = signal<string>('10:00');
  readonly availableDates = computed(() => {
    const artistEvents = this.data.events.filter(e => e.artistId === this.data.seed.artistId);
    const res = this.av.getAvailableDatesByTime({
      artistId: this.data.seed.artistId,
      durationMinutes: this.data.seed.durationMinutes,
      events: artistEvents,
      time: this.selectedTime(),
      rangeDays: 30,
      stepMinutes: 30,
      workdayStart: '08:00',
      workdayEnd: '20:00',
    });
    return res.dates;
  });

  close() {
    this.ref.dismiss();
  }

  pickSlot(startISO: string, endISO: string) {
    this.ref.dismiss({ startISO, endISO });
  }

  onCalendarSelected(d: Date | null) {
    if (!d) return;
    this.selectedDateKey.set(toDateKey(d));
  }

  readonly timeChips = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','16:00','17:00','18:00'];
}
