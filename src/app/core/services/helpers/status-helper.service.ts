import { Injectable } from '@angular/core';

export type StatusTone = 'warning' | 'info' | 'success' | 'danger' | 'neutral';

@Injectable({ providedIn: 'root' })
export class StatusHelperService {
  bookingStatusKey(status: unknown): string {
    const value = this.normalize(status);
    if (value === 'on-going' || value === 'ongoing') return 'in_progress';
    if (value === 'done') return 'completed';
    return value;
  }

  bookingLabel(status: unknown): string {
    const key = this.bookingStatusKey(status);
    if (key === 'pending') return 'In attesa';
    if (key === 'confirmed') return 'Confermata';
    if (key === 'paid') return 'Pagata';
    if (key === 'in_progress') return 'In corso';
    if (key === 'completed') return 'Completata';
    if (key === 'cancelled') return 'Annullata';
    if (key === 'no_show') return 'No-show';
    if (key === 'draft') return 'Bozza';
    return 'N/A';
  }

  bookingTone(status: unknown): StatusTone {
    const key = this.bookingStatusKey(status);
    if (key === 'pending') return 'warning';
    if (key === 'in_progress') return 'info';
    if (key === 'completed' || key === 'paid') return 'success';
    if (key === 'cancelled' || key === 'no_show') return 'danger';
    return 'neutral';
  }

  reviewStatusKey(status: unknown): string {
    return this.normalize(status);
  }

  reviewLabel(status: unknown): string {
    const key = this.reviewStatusKey(status);
    if (key === 'approved') return 'Approvata';
    if (key === 'pending') return 'Da moderare';
    if (key === 'rejected') return 'Rifiutata';
    return 'N/A';
  }

  reviewTone(status: unknown): StatusTone {
    const key = this.reviewStatusKey(status);
    if (key === 'approved') return 'success';
    if (key === 'pending') return 'warning';
    if (key === 'rejected') return 'danger';
    return 'neutral';
  }

  projectStatusKey(status: unknown): string {
    return this.normalize(status);
  }

  projectLabel(status: unknown, audience: 'admin' | 'client' = 'admin'): string {
    const key = this.projectStatusKey(status);
    if (key === 'draft') return 'Bozza';
    if (key === 'scheduled') return audience === 'client' ? 'Pianificato' : 'Prenotato';
    if (key === 'active') return audience === 'client' ? 'In lavorazione' : 'Attivo';
    if (key === 'healing') return audience === 'client' ? 'In guarigione' : 'Guarigione';
    if (key === 'completed') return audience === 'client' ? 'Completato' : 'Concluso';
    if (key === 'cancelled') return 'Annullato';
    return 'N/A';
  }

  sessionStatusKey(status: unknown): string {
    const value = this.normalize(status);
    if (value === 'done') return 'completed';
    if (value === 'on-going' || value === 'ongoing') return 'in_progress';
    return value || 'planned';
  }

  sessionLabel(status: unknown): string {
    const key = this.sessionStatusKey(status);
    if (key === 'planned') return 'Pianificata';
    if (key === 'in_progress') return 'In corso';
    if (key === 'completed') return 'Completata';
    if (key === 'cancelled') return 'Annullata';
    if (key === 'draft') return 'Bozza';
    return key || 'N/A';
  }

  private normalize(status: unknown): string {
    return String(status ?? '').trim().toLowerCase();
  }
}
