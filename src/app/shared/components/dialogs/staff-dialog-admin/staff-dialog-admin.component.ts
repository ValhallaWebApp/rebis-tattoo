import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember } from '../../../../core/services/staff/staff.service';

@Component({
  selector: 'app-staff-dialog-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './staff-dialog-admin.component.html',
  styleUrls: ['./staff-dialog-admin.component.scss']
})
export class StaffDialogAdminComponent {
  form: FormGroup;
  isEditMode: boolean = false;
  imagePreview: string = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StaffDialogAdminComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: 'create' | 'edit'; staff?: StaffMember }
  ) {
    this.isEditMode = data.mode === 'edit';

    this.form = this.fb.group({
      name: [data.staff?.name || '', Validators.required],
      role: [data.staff?.role || 'tatuatore', Validators.required],
      bio: [data.staff?.bio || ''],
      photoUrl: [data.staff?.photoUrl || ''],
      isActive: [data.staff?.isActive ?? true]
    });

    this.imagePreview = this.form.value.photoUrl;
    this.form.get('photoUrl')?.valueChanges.subscribe(url => this.imagePreview = url);
  }

  save(): void {
    if (this.form.valid) {
      const staff: StaffMember = {
        ...this.data.staff,
        ...this.form.value,
        id: this.data.staff?.id || '',
      };
      this.dialogRef.close(staff);
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
