import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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
  readonly imageUrlsControlName = 'imageUrls';
  private readonly imageUrlsValidator = (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (!raw) return null;
    const urls = raw
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const invalid = urls.filter(u => !this.isValidUrl(u));
    return invalid.length ? { invalidUrls: invalid } : null;
  };

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectTrackerProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerProjectDialogData
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      zone: [''],
      notes: [''],
      status: ['scheduled', Validators.required],
      isPublic: [true],
      style: [''],
      subject: [''],
      imageUrls: ['', [this.imageUrlsValidator]]
    });

    const p = data.project;
    this.form.patchValue({
      title: p?.title ?? '',
      zone: p?.zone ?? '',
      notes: p?.notes ?? '',
      status: p?.status ?? 'scheduled',
      isPublic: (p as any)?.isPublic !== false,
      style: String((p as any)?.style ?? (p as any)?.genere ?? '').trim(),
      subject: String((p as any)?.subject ?? '').trim(),
      imageUrls: Array.isArray((p as any)?.imageUrls) ? (p as any).imageUrls.join(', ') : ''
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const imageUrls = String(v.imageUrls ?? '')
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    this.dialogRef.close({
      title: v.title,
      zone: v.zone || undefined,
      notes: v.notes || undefined,
      status: v.status,
      isPublic: v.isPublic !== false,
      style: v.style || undefined,
      subject: v.subject || undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined
    });
  }

  private isValidUrl(value: string): boolean {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
