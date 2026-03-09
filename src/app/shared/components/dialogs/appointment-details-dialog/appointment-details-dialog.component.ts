import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Booking } from '../../../../core/services/bookings/booking.service';

@Component({
  selector: 'app-appointment-details-dialog',
  standalone:true,
  imports:[CommonModule, MaterialModule],
  templateUrl: './appointment-details-dialog.component.html',
  styleUrl: './appointment-details-dialog.component.scss'
})
export class AppointmentDetailsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Booking) {}

  statusLabel(): string {
    const s = this.statusValue();
    if (s === 'pending') return 'In attesa';
    if (s === 'confirmed') return 'Confermata';
    if (s === 'paid') return 'Pagata';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing') return 'In corso';
    if (s === 'cancelled') return 'Annullata';
    if (s === 'no_show') return 'No show';
    if (s === 'completed' || s === 'done') return 'Completata';
    if (s === 'draft') return 'Bozza';
    return 'Prenotazione';
  }

  statusClass(): string {
    const s = this.statusValue();
    if (s === 'pending') return 'pending';
    if (s === 'confirmed' || s === 'paid') return 'confirmed';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing') return 'in-progress';
    if (s === 'completed' || s === 'done') return 'done';
    if (s === 'cancelled' || s === 'no_show') return 'cancelled';
    if (s === 'draft') return 'draft';
    return '';
  }

  kindLabel(): string {
    const raw = String((this.data as any)?.type ?? '').trim().toLowerCase();
    if (['session', 'seduta', 'tattoo_session'].includes(raw)) return 'Seduta';
    if (['consultation', 'consulenza', 'consulto'].includes(raw)) return 'Consulenza';
    return 'Appuntamento';
  }

  durationLabel(): string {
    const direct = Number((this.data as any)?.durationMinutes ?? 0);
    if (Number.isFinite(direct) && direct > 0) return this.toDurationText(direct);

    const startMs = new Date((this.data as any)?.start ?? '').getTime();
    const endMs = new Date((this.data as any)?.end ?? '').getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      return this.toDurationText(Math.round((endMs - startMs) / 60000));
    }
    return '-';
  }

  totalPriceLabel(): string {
    return this.moneyLabel((this.data as any)?.price);
  }

  paidLabel(): string {
    return this.moneyLabel((this.data as any)?.paidAmount);
  }

  depositLabel(): string {
    return this.moneyLabel((this.data as any)?.depositRequired);
  }

  remainingLabel(): string {
    const total = this.moneyValue((this.data as any)?.price);
    const paid = this.moneyValue((this.data as any)?.paidAmount);
    if (total === null && paid === null) return '-';
    const safeTotal = total ?? 0;
    const safePaid = paid ?? 0;
    return this.moneyLabel(Math.max(0, safeTotal - safePaid));
  }

  notesText(): string {
    const notes = String((this.data as any)?.notes ?? '').trim();
    return notes || 'Nessuna nota inserita.';
  }

  private statusValue(): string {
    return String((this.data as any)?.status ?? '').trim().toLowerCase();
  }

  private toDurationText(minutes: number): string {
    const m = Math.max(0, Math.round(minutes));
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  }

  private moneyValue(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private moneyLabel(value: unknown): string {
    const n = this.moneyValue(value);
    if (n === null) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  }
}
