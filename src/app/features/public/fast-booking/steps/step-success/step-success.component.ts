import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { FastBookingStore } from '../../state/fast-booking-store.service';

@Component({
  selector: 'app-step-success',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './step-success.component.html',
  styleUrl: './step-success.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepSuccessComponent {
  readonly store = inject(FastBookingStore);

  readonly draft = this.store.draft;
  readonly bookingId = this.store.bookingId;

  again() {
    this.store.resetAll();
  }
}
