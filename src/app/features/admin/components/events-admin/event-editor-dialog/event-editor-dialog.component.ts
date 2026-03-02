import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  EventRecurrenceMode,
  StudioEvent,
  StudioEventStatus,
  StudioEventType
} from '../../../../../core/services/events/events.service';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { DynamicField, DynamicFormComponent } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';

export interface EventEditorDialogData {
  mode: 'create' | 'edit';
  event?: StudioEvent;
}

@Component({
  selector: 'app-event-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './event-editor-dialog.component.html',
  styleUrl: './event-editor-dialog.component.scss'
})
export class EventEditorDialogComponent {
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    type: ['open-day' as StudioEventType, Validators.required],
    status: ['draft' as StudioEventStatus, Validators.required],
    startDate: [this.todayYmd(), Validators.required],
    endDate: [this.todayYmd()],
    startTime: [''],
    endTime: [''],
    location: [''],
    guestName: [''],
    walkInOnly: [false],
    capacityEnabled: [false],
    capacity: [0],
    featured: [false],
    priority: [0],
    imageUrl: [''],
    recurrenceMode: ['none' as EventRecurrenceMode, Validators.required],
    recurrenceIntervalDays: [7],
    recurrenceWeekday: [new Date().getDay()],
    recurrenceUntil: ['']
  });

  readonly mainFields: DynamicField[] = [
    { type: 'text', name: 'title', label: 'Titolo*', required: true },
    {
      type: 'select',
      name: 'type',
      label: 'Tipologia*',
      required: true,
      options: [
        { label: 'Guest Spot', value: 'guest' },
        { label: 'Open Day', value: 'open-day' }
      ]
    },
    {
      type: 'select',
      name: 'status',
      label: 'Stato*',
      required: true,
      options: [
        { label: 'Bozza', value: 'draft' },
        { label: 'Pubblicato', value: 'published' },
        { label: 'Annullato', value: 'cancelled' },
        { label: 'Concluso', value: 'completed' }
      ]
    },
    { type: 'text', name: 'location', label: 'Location' },
    { type: 'text', name: 'guestName', label: 'Ospite / Team' },
    { type: 'textarea', name: 'description', label: 'Descrizione', rows: 4, className: 'full' }
  ];

  readonly scheduleFields: DynamicField[] = [
    { type: 'date-native', name: 'startDate', label: 'Data inizio*', required: true },
    { type: 'date-native', name: 'endDate', label: 'Data fine' },
    { type: 'time', name: 'startTime', label: 'Ora inizio' },
    { type: 'time', name: 'endTime', label: 'Ora fine' },
    { type: 'toggle', name: 'featured', label: 'Evento in evidenza', className: 'full' },
    { type: 'number', name: 'priority', label: 'Priorita (pin)', min: 0 }
  ];

  readonly policyFields: DynamicField[] = [
    { type: 'toggle', name: 'walkInOnly', label: 'Senza prenotazione', className: 'full' },
    { type: 'toggle', name: 'capacityEnabled', label: 'Capienza limitata', className: 'full' },
    { type: 'number', name: 'capacity', label: 'Posti disponibili', min: 0 },
    {
      type: 'select',
      name: 'recurrenceMode',
      label: 'Ricorrenza',
      options: [
        { label: 'Nessuna', value: 'none' },
        { label: 'Ogni N giorni', value: 'interval' },
        { label: 'Giorno fisso settimana', value: 'weekday' }
      ]
    },
    { type: 'number', name: 'recurrenceIntervalDays', label: 'Intervallo giorni', min: 1 },
    {
      type: 'select',
      name: 'recurrenceWeekday',
      label: 'Giorno settimana',
      options: [
        { label: 'Domenica', value: 0 },
        { label: 'Lunedi', value: 1 },
        { label: 'Martedi', value: 2 },
        { label: 'Mercoledi', value: 3 },
        { label: 'Giovedi', value: 4 },
        { label: 'Venerdi', value: 5 },
        { label: 'Sabato', value: 6 }
      ]
    },
    { type: 'date-native', name: 'recurrenceUntil', label: 'Ricorrenza fino al' },
    { type: 'text', name: 'imageUrl', label: 'URL immagine / Data URL', className: 'full' }
  ];

  constructor(
    private dialogRef: MatDialogRef<EventEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EventEditorDialogData
  ) {
    if (data?.event) {
      this.form.patchValue({
        title: data.event.title,
        description: data.event.description,
        type: data.event.type,
        status: data.event.status,
        startDate: data.event.startDate,
        endDate: data.event.endDate,
        startTime: data.event.startTime,
        endTime: data.event.endTime,
        location: data.event.location,
        guestName: data.event.guestName,
        walkInOnly: data.event.walkInOnly,
        capacityEnabled: data.event.capacityEnabled,
        capacity: data.event.capacity,
        featured: data.event.featured,
        priority: data.event.priority,
        imageUrl: data.event.imageUrl,
        recurrenceMode: data.event.recurrenceMode,
        recurrenceIntervalDays: data.event.recurrenceIntervalDays || 7,
        recurrenceWeekday: data.event.recurrenceWeekday ?? new Date().getDay(),
        recurrenceUntil: data.event.recurrenceUntil
      });
    }

    this.form.get('capacityEnabled')?.valueChanges.subscribe((enabled) => {
      const ctrl = this.form.get('capacity');
      if (!ctrl) return;
      if (enabled) {
        ctrl.enable({ emitEvent: false });
        ctrl.setValidators([Validators.required, Validators.min(1)]);
      } else {
        ctrl.setValue(0, { emitEvent: false });
        ctrl.clearValidators();
        ctrl.disable({ emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('recurrenceMode')?.valueChanges.subscribe((mode) => this.syncRecurrenceControls(mode as EventRecurrenceMode));
    this.syncRecurrenceControls(this.form.get('recurrenceMode')?.value as EventRecurrenceMode);

    if (!this.form.value.capacityEnabled) {
      this.form.get('capacity')?.disable({ emitEvent: false });
    }

    this.form.get('type')?.valueChanges.subscribe((value) => this.syncTypeFields(((value as StudioEventType) ?? 'open-day')));
    this.syncTypeFields(((this.form.value.type as StudioEventType) ?? 'open-day'));
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '').trim();
      if (!result) return;
      this.form.patchValue({ imageUrl: result });
    };
    reader.readAsDataURL(file);
  }

  clearImage(): void {
    this.form.patchValue({ imageUrl: '' });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      endDate: raw.endDate || raw.startDate
    };
    this.dialogRef.close(payload);
  }

  private syncRecurrenceControls(mode: EventRecurrenceMode): void {
    const interval = this.form.get('recurrenceIntervalDays');
    const weekday = this.form.get('recurrenceWeekday');
    const until = this.form.get('recurrenceUntil');
    if (!interval || !weekday || !until) return;

    interval.clearValidators();
    weekday.clearValidators();

    if (mode === 'interval') {
      interval.enable({ emitEvent: false });
      interval.setValidators([Validators.required, Validators.min(1)]);
      weekday.disable({ emitEvent: false });
    } else if (mode === 'weekday') {
      weekday.enable({ emitEvent: false });
      weekday.setValidators([Validators.required]);
      interval.disable({ emitEvent: false });
    } else {
      interval.disable({ emitEvent: false });
      weekday.disable({ emitEvent: false });
      until.setValue('', { emitEvent: false });
    }

    if (mode === 'none') {
      until.disable({ emitEvent: false });
    } else {
      until.enable({ emitEvent: false });
    }

    interval.updateValueAndValidity({ emitEvent: false });
    weekday.updateValueAndValidity({ emitEvent: false });
    until.updateValueAndValidity({ emitEvent: false });
  }

  private syncTypeFields(value: StudioEventType): void {
    const guestField = this.form.get('guestName');
    if (!guestField) return;
    if (value === 'guest') {
      guestField.enable({ emitEvent: false });
      guestField.setValidators([Validators.required]);
    } else {
      guestField.disable({ emitEvent: false });
      guestField.clearValidators();
      guestField.setValue('', { emitEvent: false });
    }
    guestField.updateValueAndValidity({ emitEvent: false });
  }

  private todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
