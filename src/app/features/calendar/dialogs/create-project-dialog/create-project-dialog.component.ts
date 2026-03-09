import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

export interface CreateProjectDialogData {
  clientId: string;
  artistId: string;
  suggestedTitle?: string;
}

export interface CreateProjectDialogResult {
  title: string;
  zone?: string;
  notes?: string;
  isPublic: boolean;
}

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss'],
})
export class CreateProjectDialogComponent {
  form:any
  readonly fields: DynamicField[] = [
    { type: 'text', name: 'title', label: 'Titolo progetto', required: true },
    { type: 'toggle', name: 'isPublic', label: 'Visibile nel portfolio pubblico', className: 'full-width' },
    { type: 'text', name: 'zone', label: 'Zona (opzionale)' },
    { type: 'textarea', name: 'notes', label: 'Note (opzionali)', rows: 3, className: 'full-width' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreateProjectDialogData
  ) {
     this.form = this.fb.group({
      title: [this.data?.suggestedTitle || '', [Validators.required]],
      isPublic: [false],
      zone: [''],
      notes: [''],
    });

  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    this.dialogRef.close({
      title: String(value.title || '').trim(),
      isPublic: value.isPublic === true,
      zone: String(value.zone || '').trim() || undefined,
      notes: String(value.notes || '').trim() || undefined,
    } as CreateProjectDialogResult);
  }
}
