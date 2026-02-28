import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { FastBookingStore } from '../../state/fast-booking-store.service';

@Component({
  selector: 'app-step-intro',
  standalone: true,
  imports: [CommonModule,MaterialModule],
  templateUrl: './step-intro.component.html',
  styleUrl: './step-intro.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepIntroComponent {
  private readonly store = inject(FastBookingStore);
  readonly depositEuro = this.store.depositEuro;
  readonly durationMin = this.store.durationMin;
}
