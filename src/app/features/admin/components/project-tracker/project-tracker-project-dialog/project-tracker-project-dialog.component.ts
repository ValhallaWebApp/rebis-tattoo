import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';

export interface ProjectTrackerProjectDialogData {
  project: TattooProject;
}

@Component({
  selector: 'app-project-tracker-project-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './project-tracker-project-dialog.component.html',
  styleUrls: ['./project-tracker-project-dialog.component.scss']
})
export class ProjectTrackerProjectDialogComponent {
  readonly form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectTrackerProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerProjectDialogData
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      zone: [''],
      notes: [''],
      status: ['scheduled', Validators.required]
    });

    const p = data.project;
    this.form.patchValue({
      title: p?.title ?? '',
      zone: p?.zone ?? '',
      notes: p?.notes ?? '',
      status: p?.status ?? 'scheduled'
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      title: v.title,
      zone: v.zone || undefined,
      notes: v.notes || undefined,
      status: v.status
    });
  }
}
