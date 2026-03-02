import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import {
  StudioEvent,
  StudioEventStatus,
  StudioEventType,
  EventsService
} from '../../../../core/services/events/events.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { EventEditorDialogComponent } from './event-editor-dialog/event-editor-dialog.component';

@Component({
  selector: 'app-events-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './events-admin.component.html',
  styleUrls: ['./events-admin.component.scss']
})
export class EventsAdminComponent implements OnInit {
  events: StudioEvent[] = [];
  filteredEvents: StudioEvent[] = [];
  loading = true;
  filterForm!: FormGroup;

  readonly filterFields: DynamicField[] = [
    { type: 'text', name: 'q', label: 'Ricerca', placeholder: 'Titolo, guest, location' },
    {
      type: 'select',
      name: 'type',
      label: 'Tipo',
      options: [
        { label: 'Tutti', value: '' },
        { label: 'Guest Spot', value: 'guest' },
        { label: 'Open Day', value: 'open-day' }
      ]
    },
    {
      type: 'select',
      name: 'status',
      label: 'Stato',
      options: [
        { label: 'Tutti', value: '' },
        { label: 'Bozza', value: 'draft' },
        { label: 'Pubblicato', value: 'published' },
        { label: 'Annullato', value: 'cancelled' },
        { label: 'Concluso', value: 'completed' }
      ]
    },
    { type: 'toggle', name: 'featuredOnly', label: 'Solo in evidenza' }
  ];

  constructor(
    private fb: FormBuilder,
    private eventsService: EventsService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initFilterForm();
    this.eventsService.getEvents().subscribe({
      next: (events) => {
        this.loading = false;
        this.events = events;
        this.applyFilters();
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(EventEditorDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      data: { mode: 'create' }
    });
    ref.afterClosed().subscribe((payload) => {
      if (!payload) return;
      this.eventsService.addEvent(payload).catch(() => undefined);
    });
  }

  openEdit(event: StudioEvent): void {
    const ref = this.dialog.open(EventEditorDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      data: { mode: 'edit', event }
    });
    ref.afterClosed().subscribe((payload) => {
      if (!payload) return;
      this.eventsService.updateEvent(event.id, payload).catch(() => undefined);
    });
  }

  deleteEvent(event: StudioEvent): void {
    this.eventsService.deleteEvent(event.id).catch(() => undefined);
  }

  quickSetStatus(event: StudioEvent, status: StudioEventStatus): void {
    if (event.status === status) return;
    this.eventsService.setStatus(event.id, status).catch(() => undefined);
  }

  typeLabel(type: StudioEventType): string {
    return type === 'guest' ? 'Guest Spot' : 'Open Day';
  }

  statusLabel(status: StudioEventStatus): string {
    switch (status) {
      case 'published':
        return 'Pubblicato';
      case 'cancelled':
        return 'Annullato';
      case 'completed':
        return 'Concluso';
      case 'draft':
      default:
        return 'Bozza';
    }
  }

  recurrenceLabel(event: StudioEvent): string {
    if (event.recurrenceMode === 'interval') {
      const every = Math.max(1, event.recurrenceIntervalDays || 1);
      return `Ogni ${every} giorno${every > 1 ? 'i' : ''}`;
    }
    if (event.recurrenceMode === 'weekday') {
      const label = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'][event.recurrenceWeekday ?? 0];
      return `Ogni ${label}`;
    }
    return 'Singolo';
  }

  trackById = (_: number, item: StudioEvent): string => item.id;

  private initFilterForm(): void {
    this.filterForm = this.fb.group({
      q: [''],
      type: [''],
      status: [''],
      featuredOnly: [false]
    });
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  private applyFilters(): void {
    const values = this.filterForm.getRawValue();
    const q = String(values.q ?? '').trim().toLowerCase();
    const type = String(values.type ?? '').trim();
    const status = String(values.status ?? '').trim();
    const featuredOnly = values.featuredOnly === true;

    this.filteredEvents = this.events.filter((event) => {
      const haystack = `${event.title} ${event.guestName} ${event.location}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (type && event.type !== type) return false;
      if (status && event.status !== status) return false;
      if (featuredOnly && !event.featured) return false;
      return true;
    });
  }
}
