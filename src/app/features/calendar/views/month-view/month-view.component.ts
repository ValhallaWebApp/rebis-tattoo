import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MaterialModule } from '../../../../core/modules/material.module';
import { CalendarEvent } from '../../calendar.service';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'month-view',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTooltipModule,ReactiveFormsModule],
  templateUrl: './month-view.component.html',
  styleUrls: ['./month-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthViewComponent {
  // Array di giorni visibili (ogni giorno ha { date, events[] })
  @Input({ required: true }) days: { date: Date; events: CalendarEvent[] }[] = [];

  // Mappe id artista → nome e → foto
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};

  @Output() eventClick = new EventEmitter<CalendarEvent>();
  @Output() dayClick = new EventEmitter<Date>();

  // Avvia il drawer per il giorno cliccato
  goToDayView(date: Date) {
    this.dayClick.emit(date);
  }

  // Tooltip dell’evento con nome artista e contatore
  eventTooltip(ev: CalendarEvent): string {
    const nome = this.artistMap[ev.artistId ?? ''] || 'Artista';
    return ev.count && ev.count > 1 ? `${nome} (${ev.count} appuntamenti)` : nome;
  }

  // Recupera foto artista o default
  avatarUrl(ev: CalendarEvent): string {
    return this.artistPhotoMap[ev.artistId ?? ''] || '/assets/avatar-default.png';
  }


getGroupedEvents(day: { events: CalendarEvent[] }): { artistId: string; count: number }[] {
  const grouped: Record<string, number> = {};

  for (const ev of day.events) {
    const id = ev.artistId;
    grouped[id] = (grouped[id] || 0) + 1;
  }

  return Object.entries(grouped).map(([artistId, count]) => ({ artistId, count }));
}

hasMine(day: { events: CalendarEvent[] }, artistId: string): boolean {
  return day.events.some(ev => ev.artistId === artistId && ev.isMine);
}

}
