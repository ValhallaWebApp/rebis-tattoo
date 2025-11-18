import {
  Component,
  Input,
  Output,
  EventEmitter,
  TemplateRef,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { CalendarEvent } from '../../calendar.service';
import { MatMenu } from '@angular/material/menu';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'week-view',
  standalone: true,
  imports: [CommonModule, MaterialModule,DragDropModule],
  templateUrl: './week-view.component.html',
  styleUrls: ['./week-view.component.scss']
})
export class WeekViewComponent {
  @Input() date!: Date;
  @Input() bookings: CalendarEvent[] = [];
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};
  @Input() totalArtists: number = 0;
  @Input() selectedArtistIds: string[] = [];

@Input() contextMenu!: MatMenu;
@Output() setContext = new EventEmitter<CalendarEvent>();
  @Output() eventAction = new EventEmitter<{ action: string, event: CalendarEvent }>();
  @Output() slotClick = new EventEmitter<{ date: string, start: string }>();
@Output() eventDropped = new EventEmitter<{
  event: CalendarEvent;
  newDate: string;
  newHour: string;
  newArtistId: string;
}>();
dropListIds: string[] = [];

  hours: string[] = this.generateHours();
  weekDays: Date[] = this.getWeekDays();
ngOnChanges(changes: SimpleChanges): void {
    if (changes['date'] || changes['bookings']) {
      this.generateWeekDays();  // rigenera settimana visibile
    }
      // Genera ID dropList per tutte le celle visibili
  this.dropListIds = [];
  for (const d of this.weekDays) {
    for (const h of this.hours) {
      this.dropListIds.push(this.getDropListId(d, h));
    }
  }
  }

  // 📆 Genera gli orari (es. 08:00 - 20:00)
  private generateHours(): string[] {
    const result: string[] = [];
    for (let i = 8; i <= 20; i++) {
      result.push(i.toString().padStart(2, '0') + ':00');
    }
    return result;
  }

  // 📅 Restituisce i giorni della settimana corrente
private getWeekDays(): Date[] {
  const start = new Date(this.date ?? new Date());
  if (isNaN(start.getTime())) return [];

  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(start.setDate(diff));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}


eventsFor(date: Date, hour: string): CalendarEvent[] {
  const iso = date.toISOString().split('T')[0];
  const slotStart = new Date(`${iso}T${hour}`);

  return this.bookings.filter(ev => {
    if (ev.date !== iso || !ev.start) return false;
    if (this.selectedArtistIds.length && !this.selectedArtistIds.includes(ev.artistId)) return false;

    const start = new Date(ev.start);
    const duration = ev.duration ?? 30;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    return slotStart >= start && slotStart < end;
  });
}
onDrop(event: CdkDragDrop<any>, targetDate: Date, targetHour: string): void {
  const draggedEvent = event.item.data as CalendarEvent;
  if (!draggedEvent) return;

  const duration = draggedEvent.duration ?? 30;

  const newDate = targetDate.toISOString().split('T')[0];
  const newStart = `${newDate}T${targetHour}`;
  const newStartDate = new Date(newStart);
  const newEndDate = new Date(newStartDate.getTime() + duration * 60_000);
  const newEnd = newEndDate.toISOString();

  // 🔒 Controlla sovrapposizione con altri eventi dello stesso artista
// 🔒 Controlla se l'artista ha già un evento in questo intervallo
const overlapping = this.bookings.some(e => {
  if (e.id === draggedEvent.id) return false;                  // ignora se stesso
  if (e.artistId !== draggedEvent.artistId) return false;      // solo stesso artista
  if (e.date !== newDate) return false;                        // solo stesso giorno

  const eStart = new Date(e.start).getTime();
  const eEnd = new Date(e.end).getTime();

  return newStartDate.getTime() < eEnd && newEndDate.getTime() > eStart;
});

  if (overlapping) {
    alert('⛔️ Questo orario è già occupato da un altro evento dello stesso artista!');
    return;
  }

  const updatedEvent: CalendarEvent = {
    ...draggedEvent,
    start: newStart,
    end: newEnd,
    date: newDate,
  };

  this.eventDropped.emit({
    event: updatedEvent,
    newDate,
    newHour: targetHour,
    newArtistId: draggedEvent.artistId
  });
}
openResizeDialog(event: CalendarEvent): void {
  const current = event.duration ?? 30;
  const newDuration = prompt('Imposta nuova durata in minuti:', current.toString());

  const parsed = parseInt(newDuration ?? '', 10);
  if (!parsed || parsed < 30) return;

  const newEnd = new Date(new Date(event.start).getTime() + parsed * 60000).toISOString();

  const updated: CalendarEvent = {
    ...event,
    duration: parsed,
    end: newEnd,
    slotCount: Math.ceil(parsed / 30)
  };

  this.eventDropped.emit({
    event: updated,
    newDate: updated.date,
    newHour: updated.start.slice(11, 16),
    newArtistId: updated.artistId
  });
}


getDropListId(date: Date, hour: string): string {
  const d = date.toISOString().split('T')[0];
  return `drop-${d}-${hour}`;
}
  slotClass(date: Date, hour: string): string {
    const events = this.eventsFor(date, hour);
    if (events.length === 0) return 'slot-free';
    if (events.some(e => e.isMine)) return 'slot-mine';
    return 'slot-busy';
  }

  avatarFor(artistId: string): string {
    return this.artistPhotoMap[artistId] || 'assets/img/avatar.png';
  }

  onSlotClick(date: Date, hour: string): void {
    const iso = date.toISOString().split('T')[0];
    this.slotClick.emit({ date: iso, start: hour });
  }
  generateWeekDays(): void {
    if (!this.date) return;
    const start = new Date(this.date);
    const wd = start.getDay();
    const diff = wd === 0 ? -6 : 1 - wd; // inizia da lunedì
    start.setDate(start.getDate() + diff);

    this.weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }
}
