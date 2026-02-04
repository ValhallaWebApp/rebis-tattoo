import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';

export interface ProjectTrackerBookingDialogData {
  project: TattooProject;
  booking?: any;
}

@Component({
  selector: 'app-project-tracker-booking-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './project-tracker-booking-dialog.component.html',
  styleUrls: ['./project-tracker-booking-dialog.component.scss']
})
export class ProjectTrackerBookingDialogComponent {
  readonly form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectTrackerBookingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerBookingDialogData
  ) {
    this.form = this.fb.group({
      date: ['', Validators.required],
      time: ['', Validators.required],
      durationMinutes: [60, [Validators.required, Validators.min(15)]],
      status: ['confirmed', Validators.required],
      notes: ['']
    });

    const b = data.booking;
    if (b?.start) {
      const d = new Date(b.start);
      const date = this.toDateKey(d);
      const time = `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
      this.form.patchValue({
        date,
        time,
        durationMinutes: b.durationMinutes ?? 60,
        status: b.status ?? 'confirmed',
        notes: b.notes ?? ''
      });
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const start = `${v.date}T${v.time}:00`;
    const end = this.addMinutes(start, Number(v.durationMinutes ?? 60));

    this.dialogRef.close({
      artistId: this.data.project?.artistId,
      clientId: this.data.project?.clientId,
      projectId: this.data.project?.id,
      start,
      end,
      durationMinutes: Number(v.durationMinutes ?? 60),
      status: v.status,
      notes: v.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  private addMinutes(start: string, minutes: number): string {
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + minutes);
    return this.toLocalDateTime(d);
  }

  private toLocalDateTime(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}T${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:00`;
  }

  private toDateKey(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
