import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';
import { DynamicField, DynamicFormComponent } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';

export interface ProjectTrackerProjectDialogData {
  project: TattooProject;
}

@Component({
  selector: 'app-project-tracker-project-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './project-tracker-project-dialog.component.html',
  styleUrls: ['./project-tracker-project-dialog.component.scss']
})
export class ProjectTrackerProjectDialogComponent {
  readonly form;
  readonly formFields: DynamicField[] = [
    { type: 'text', name: 'title', label: 'Titolo', required: true },
    { type: 'toggle', name: 'isPublic', label: 'Visibile nel portfolio pubblico', className: 'full' },
    { type: 'text', name: 'zone', label: 'Zona' },
    { type: 'text', name: 'style', label: 'Stile', placeholder: 'Es. blackwork, fine line' },
    { type: 'text', name: 'subject', label: 'Soggetto', placeholder: 'Es. animali, volti' },
    {
      type: 'select',
      name: 'status',
      label: 'Stato',
      required: true,
      options: [
        { label: 'Bozza', value: 'draft' },
        { label: 'Prenotato', value: 'scheduled' },
        { label: 'Attivo', value: 'active' },
        { label: 'Guarigione', value: 'healing' },
        { label: 'Concluso', value: 'completed' },
        { label: 'Annullato', value: 'cancelled' }
      ]
    },
    { type: 'textarea', name: 'notes', label: 'Note', rows: 3, className: 'full' },
    {
      type: 'textarea',
      name: 'imageUrls',
      label: 'Immagini (URL separati da virgola o a capo)',
      rows: 3,
      className: 'full',
      hint: 'Usa solo URL http/https validi'
    }
  ];
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
