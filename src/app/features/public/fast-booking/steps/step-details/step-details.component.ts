import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FastBookingStore } from '../../state/fast-booking-store.service';
import { MaterialModule } from '../../../../../core/modules/material.module';

@Component({
  selector: 'app-step-details',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './step-details.component.html',
  styleUrl: './step-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepDetailsComponent {
  private readonly store = inject(FastBookingStore);

  draft = this.store.draft;

  update(field: string, value: string) {
    this.store.draft.update(d => ({ ...d, [field]: value }));
  }
}
