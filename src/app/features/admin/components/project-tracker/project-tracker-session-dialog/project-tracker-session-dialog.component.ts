import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';

export interface ProjectTrackerSessionDialogData {
  project: TattooProject;
  session?: any;
}

@Component({
  selector: 'app-project-tracker-session-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './project-tracker-session-dialog.component.html',
  styleUrls: ['./project-tracker-session-dialog.component.scss']
})
export class ProjectTrackerSessionDialogComponent {
  readonly form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectTrackerSessionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerSessionDialogData
  ) {
    this.form = this.fb.group({
      date: ['', Validators.required],
      time: ['', Validators.required],
      durationMinutes: [60, [Validators.required, Validators.min(15)]],
      status: ['planned', Validators.required],
      notesByAdmin: [''],
      paidAmount: [0]
    });

    const s = data.session;
    if (s?.start) {
      const d = new Date(s.start);
      const date = this.toDateKey(d);
      const time = `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
      this.form.patchValue({
        date,
        time,
        durationMinutes: s.durationMinutes ?? 60,
        status: s.status ?? 'planned',
        notesByAdmin: s.notesByAdmin ?? '',
        paidAmount: s.paidAmount ?? 0
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
      projectId: this.data.project?.id,
      artistId: this.data.project?.artistId,
      clientId: this.data.project?.clientId,
      bookingId: (this.data.project as any)?.bookingId ?? undefined,
      start,
      end,
      durationMinutes: Number(v.durationMinutes ?? 60),
      status: v.status,
      notesByAdmin: v.notesByAdmin,
      paidAmount: Number(v.paidAmount ?? 0),
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
