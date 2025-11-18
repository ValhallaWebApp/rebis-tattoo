import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEvent } from '../../calendar.service';
import { MaterialModule } from '../../../../core/modules/material.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-day-view',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTooltipModule, DragDropModule],
  templateUrl: './day-view.component.html',
  styleUrls: ['./day-view.component.scss']
})
export class DayViewComponent implements OnChanges {
  @Input() dayData!: {
    date: Date;
    hours: string[];
    artists: {
      id: string;
      name: string;
      avatar: string;
      slots: { hour: string; event?: CalendarEvent }[];
    }[];
  };
dropListIds: string[] = [];

  @Output() openDrawerWithDate = new EventEmitter<{ date: string; hour: string; artistId: string }>();
  @Output() openEventDetails = new EventEmitter<CalendarEvent>();
  @Output() eventDropped = new EventEmitter<{
    event: CalendarEvent;
    newDate: string;
    newHour: string;
    newArtistId: string;
  }>();

  cellMap: Record<string, Record<string, { event?: CalendarEvent; label: string; rowspan: number; rendered: boolean }>> = {};
  contextEvent: CalendarEvent | null = null;

ngOnChanges(): void {
  if (!this.dayData) return;

  this.cellMap = {};
  this.dropListIds = [];

  // Genera dropListIds dinamicamente
  for (const hour of this.dayData.hours) {
    for (const artist of this.dayData.artists) {
      const id = this.getDropListId(hour, artist.id);
      this.dropListIds.push(id);
    }
  }

  // Costruisci la mappa delle celle DOPO aver generato gli ID
  this.buildCellMap();
}
startResize(event: MouseEvent, slotEvent: CalendarEvent): void {
  event.stopPropagation();
  event.preventDefault();

  const initialY = event.clientY;
  const initialDuration = slotEvent.duration ?? 30;

  const mouseMoveHandler = (moveEvent: MouseEvent) => {
    const deltaY = moveEvent.clientY - initialY;
    const slotHeight = 40; // altezza in px di uno slot (modifica in base al tuo SCSS)
    const slotChange = Math.round(deltaY / slotHeight);

    const newDuration = Math.max(30, initialDuration + slotChange * 30);
    const slotCount = Math.ceil(newDuration / 30);

    // Prepara evento aggiornato (solo client-side per ora)
    const updatedEvent = {
      ...slotEvent,
      duration: newDuration,
      slotCount,
      end: new Date(new Date(slotEvent.start).getTime() + newDuration * 60000).toISOString()
    };
if (this.isOverlapping(updatedEvent)) {
  alert('⛔️ Questo orario è già occupato da un altro evento!');
  return;
}
    this.eventDropped.emit({
      event: updatedEvent,
      newDate: updatedEvent.start.split('T')[0],
      newHour: updatedEvent.start.slice(11, 16),
      newArtistId: updatedEvent.artistId
    });
  };

  const mouseUpHandler = () => {
    window.removeEventListener('mousemove', mouseMoveHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
  };

  window.addEventListener('mousemove', mouseMoveHandler);
  window.addEventListener('mouseup', mouseUpHandler);
}
emitAction(action: 'view' | 'edit' | 'complete' | 'cancel'): void {
  if (!this.contextEvent) return;

  switch (action) {
    case 'view':
      this.openEventDetails.emit(this.contextEvent);
      break;
    case 'edit':
      const [date, time] = this.contextEvent.start.split('T');
      this.openDrawerWithDate.emit({
        date,
        hour: time.slice(0, 5),
        artistId: this.contextEvent.artistId
      });
      break;
    case 'complete':
      // TODO: emit status change
      break;
    case 'cancel':
      // TODO: emit status change
      break;
  }
}

getDropListId(hour: string, artistId: string): string {
  return `drop-${hour}-${artistId}`;
}
private buildCellMap(): void {
  this.cellMap = {};

  for (const hour of this.dayData.hours) {
    this.cellMap[hour] = {};
    for (const artist of this.dayData.artists) {
      this.cellMap[hour][artist.id] = {
        event: undefined,
        label: '🟢 Libero',
        rowspan: 1,
        rendered: true
      };
    }
  }

  for (const artist of this.dayData.artists) {
    for (const slot of artist.slots) {
      const { hour, event } = slot;
      if (!event) continue;

      const startIndex = this.dayData.hours.indexOf(hour);
      if (startIndex === -1) continue;

      // Calcola il numero di slot da occupare
      const duration = event.duration ?? 30;
      const slotCount = event.slotCount ?? Math.ceil(duration / 30);

      for (let i = 0; i < slotCount; i++) {
        const currentHour = this.dayData.hours[startIndex + i];
        if (!currentHour) continue;

        this.cellMap[currentHour][artist.id] = {
          event: i === 0 ? event : undefined,
          label: i === 0 ? `🔴 ${event.description}` : '',
          rowspan: i === 0 ? slotCount : 1,
          rendered: i === 0
        };
      }
    }
  }
}
private isOverlapping(event: CalendarEvent): boolean {
  const newStart = new Date(event.start).getTime();
  const newEnd = new Date(event.end).getTime();

  for (const artist of this.dayData.artists) {
    if (artist.id !== event.artistId) continue;

    for (const slot of artist.slots) {
      const e = slot.event;
      if (!e || e.id === event.id) continue;

      const eStart = new Date(e.start).getTime();
      const eEnd = new Date(e.end).getTime();

      if (newStart < eEnd && newEnd > eStart) {
        return true;
      }
    }
  }

  return false;
}

  onDragStart(event: CalendarEvent): void {
    console.log('✋ Drag started:', event);
  }

onDrop(event: CdkDragDrop<any>, targetHour: string, targetArtistId: string): void {
  const draggedEvent = event.item.data as CalendarEvent;

  if (!draggedEvent) return;

  const duration = draggedEvent.duration ?? 30;

  const newDate = this.dayData.date.toISOString().split('T')[0];
  const newStart = `${newDate}T${targetHour}`;
  const newStartDate = new Date(newStart);
  const newEndDate = new Date(newStartDate.getTime() + duration * 60_000);
  const newEnd = newEndDate.toISOString();

  const updatedEvent = {
    ...draggedEvent,
    start: newStart,
    end: newEnd,
    date: newDate,
    time: targetHour,
    artistId: targetArtistId
  };
  console.log(updatedEvent)
  // Emit verso il componente padre
if (this.isOverlapping(updatedEvent)) {
  alert('⛔️ Questo orario è già occupato da un altro evento!');
  return;
}

  this.eventDropped.emit({
    event: updatedEvent,
    newDate,
    newHour: targetHour,
    newArtistId: targetArtistId
  });
}

  isStartOfSession(event: CalendarEvent | any, hour: string): boolean {
    return event.time === hour;
  }

handleCellClick(hour: string, artistId: string): void {
  const dateStr = this.dayData.date.toISOString().split('T')[0];
  const slot = this.cellMap[hour][artistId];

  if (slot?.event) {
    this.openEventDetails.emit(slot.event);
  } else {
    this.openDrawerWithDate.emit({ date: dateStr, hour, artistId });
  }
}


  openContext(event?: CalendarEvent): void {
    if (!event) return;
    this.contextEvent = event;
  }


}
