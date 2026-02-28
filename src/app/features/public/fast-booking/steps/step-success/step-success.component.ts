import { MaterialModule } from './../../../../../core/modules/material.module';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { FastBookingStore } from '../../state/fast-booking-store.service';
import { ExternalActionsHelperService } from '../../../../../core/services/helpers/external-actions-helper.service';

@Component({
  selector: 'app-step-success',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatButtonModule, MatIconModule],
  templateUrl: './step-success.component.html',
  styleUrl: './step-success.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepSuccessComponent {
  readonly store = inject(FastBookingStore);
  private readonly externalActions = inject(ExternalActionsHelperService);

  readonly draft = this.store.draft;
  readonly bookingId = this.store.bookingId;

  again() {
    this.store.resetAll();
  }

  saveToGoogleCalendar(): void {
    const d = this.draft();
    if (!d.date || !d.time) return;

    const start = new Date(`${d.date}T${d.time}:00`);
    if (!Number.isFinite(start.getTime())) return;

    const durationMin = Number(this.store.durationMin()) || 60;
    const end = new Date(start.getTime() + durationMin * 60000);
    const bookingCode = this.bookingId() ? `\nCodice prenotazione: ${this.bookingId()}` : '';

    const title = `Consulenza - ${d.artistName || 'Rebis Tattoo'}`;
    const details = `Prenotazione consulenza Rebis Tattoo${bookingCode}`;

    const url =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${this.toGoogleDate(start)}/${this.toGoogleDate(end)}` +
      `&details=${encodeURIComponent(details)}` +
      `&location=${encodeURIComponent('Rebis Tattoo')}`;

    this.externalActions.openInNewTab(url);
  }

  private toGoogleDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
}
