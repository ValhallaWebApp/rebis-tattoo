import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { FastBookingStore } from '../../state/fast-booking-store.service';

@Component({
  selector: 'app-step-when',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatChipsModule, MatIconModule],
  templateUrl: './step-when.component.html',
  styleUrl: './step-when.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepWhenComponent {
  readonly store = inject(FastBookingStore);

  readonly draft = this.store.draft;
  readonly selectedDate = this.store.selectedDate;
  readonly slots = this.store.slots;
  readonly loading = this.store.loadingSlots;
  readonly error = this.store.error;

  // 7 giorni (oggi + 6), no date passate
  readonly days = computed(() => {
    const out: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;
      const label = d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
      out.push({ label, value });
    }
    return out;
  });

  pickDate(value: string) {
    this.store.setDate(value);
  }

  pickTime(time: string) {
    const date = this.selectedDate();
    this.store.setWhen(date, time);
  }
}
