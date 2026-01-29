import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { NewEventSeed, UiArtist, UiEventType } from '../../../models';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { MatCalendarBody } from '@angular/material/datepicker';

export interface NewEventDialogData {
  artists: UiArtist[];
}

export interface NewEventDialogResult {
  seed: NewEventSeed & { type: UiEventType };
}

@Component({
  selector: 'app-new-event-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
MaterialModule,MatCalendarBody
  ],
  templateUrl: './new-event-dialog.component.html',
  styleUrls: ['./new-event-dialog.component.scss'],
})
export class NewEventDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.group({
    type: this.fb.control<UiEventType>('booking', { nonNullable: true }),
    artistId: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    durationMinutes: this.fb.control<number>(60, { nonNullable: true, validators: [Validators.required, Validators.min(15)] }),
    mode: this.fb.control<'byDate' | 'byTime'>('byDate', { nonNullable: true }),
  });

  constructor(
    private readonly ref: MatDialogRef<NewEventDialogComponent, NewEventDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: NewEventDialogData
  ) {}

  close() {
    this.ref.close();
  }

  confirm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({
      seed: {
        type: v.type!,
        artistId: v.artistId!,
        durationMinutes: v.durationMinutes!,
        mode: v.mode!,
      },
    });
  }
}
