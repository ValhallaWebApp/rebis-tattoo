import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MaterialModule } from '../../../../../../core/modules/material.module';
import { CalendarDragUpdate, CalendarEvent } from '../../../models/calendar';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss']
})
export class DayViewComponent implements OnChanges {
  /** Data corrente (dal CalendarState) */
  @Input() date: Date | null = null;

  /** Eventi del giorno (dal CalendarState) */
  @Input() events: CalendarEvent[] | null = [];

  /** Mappe artista → nome / avatar */
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};

  /** Ruolo per eventuali controlli (admin/client/staff) */
  @Input() role: 'admin' | 'client' | 'staff' = 'client';

  /** Creazione da slot vuoto (usato dal CalendarComponentV2 → openCreate) */
  @Output() createFromSlot = new EventEmitter<{ date: string; time: string; artistId?: string }>();

  /** Drag&drop: per ora non lo gestiamo (ma teniamo l’output tipizzato) */
  @Output() eventDropped = new EventEmitter<CalendarDragUpdate>();

  /** Ore mostrate (puoi cambiare range a piacere) */
  hours: string[] = [
    '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00',
    '17:00', '18:00', '19:00'
  ];

  /** Lista di artistId ordinale */
  artistIds: string[] = [];

  /** Eventi filtrati per il giorno corrente */
  dayEvents: CalendarEvent[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.artistIds = Object.keys(this.artistMap || {});
  console.log('[DayView] artistIds →', this.artistIds);

    const isoDate = this.date ? this.toISODate(this.date) : null;
    this.dayEvents = (this.events || []).filter(e => !isoDate || e.date === isoDate);
  }

  /** Converte Date → 'YYYY-MM-DD' */
  private toISODate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Restituisce il primo evento in uno slot [ora, artista] */
  getEventForSlot(artistId: string, hour: string): CalendarEvent | null {
    if (!this.dayEvents) return null;

    return (
      this.dayEvents.find(e => {
        if (e.artistId !== artistId) return false;
        // Confronto ora: prendiamo HH:mm da start
        const eventHour = e.start.slice(11, 16);
        return eventHour === hour;
      }) || null
    );
  }

  /** Click su slot vuoto → chiede al CalendarComponent di aprire il drawer */
  handleEmptySlotClick(hour: string, artistId: string): void {
    if (!this.date) return;
    this.createFromSlot.emit({
      date: this.toISODate(this.date),
      time: hour,
      artistId
    });
  }

  /** Click su evento: per ora non fa nulla, puoi collegarlo a un context menu */
  handleEventClick(ev: CalendarEvent): void {
    // placeholder per future azioni (menu, dettagli, ecc.)
    console.log('Evento cliccato', ev);
  }
}
