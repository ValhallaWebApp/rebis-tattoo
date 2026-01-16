import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FastBookingStore } from '../../state/fast-booking-store.service';
import { MaterialModule } from '../../../../../core/modules/material.module';

@Component({
  selector: 'app-step-summary',
  standalone: true,
  imports: [CommonModule,MaterialModule],
  templateUrl: './step-summary.component.html',
  styleUrl: './step-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepSummaryComponent {
  private readonly store = inject(FastBookingStore);

  readonly d = this.store.draft;

  // prezzo deposito consulenza (per ora fisso; poi lo rendiamo dinamico)
  readonly deposit = 50;

  readonly whenText = computed(() => {
    const x = this.d();
    if (!x.date || !x.time) return '—';
    return `${x.date} · ${x.time}`;
  });

  readonly contactText = computed(() => {
    const x = this.d();
    return x.contact ? x.contact : '—';
  });

  readonly descriptionText = computed(() => {
    const x = this.d();
    return x.description ? x.description : '—';
  });
}
