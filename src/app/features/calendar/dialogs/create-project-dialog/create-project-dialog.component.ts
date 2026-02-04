import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';

export interface CreateProjectDialogData {
  clientId: string;
  artistId: string;
  suggestedTitle?: string;
}

export interface CreateProjectDialogResult {
  title: string;
  zone?: string;
  notes?: string;
}

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss'],
})
export class CreateProjectDialogComponent {
  form:any
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreateProjectDialogData
  ) {
     this.form = this.fb.group({
      title: [this.data?.suggestedTitle || '', [Validators.required]],
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
      zone: String(value.zone || '').trim() || undefined,
      notes: String(value.notes || '').trim() || undefined,
    } as CreateProjectDialogResult);
  }
}
