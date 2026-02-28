import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Service } from '../../../../core/services/services/services.service';
import { DynamicField, DynamicFormComponent } from '../../form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-services-dialog-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './services-dialog-admin.component.html',
  styleUrls: ['./services-dialog-admin.component.scss']
})
export class ServicesDialogAdminComponent {
  form: FormGroup;
  isEditMode: boolean;
  readonly fields: DynamicField[] = [
    { type: 'text', name: 'name', label: 'Nome', required: true },
    { type: 'textarea', name: 'description', label: 'Descrizione', required: true, className: 'full-width' },
    { type: 'text', name: 'categoria', label: 'Categoria', required: true },
    { type: 'number', name: 'prezzo', label: 'Prezzo (EUR)', required: true, min: 0 },
    { type: 'number', name: 'durata', label: 'Durata (minuti)', required: true, min: 1 },
    { type: 'toggle', name: 'visibile', label: 'Visibile', className: 'full-width' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ServicesDialogAdminComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: { mode: 'create' | 'edit'; service?: Service }
  ) {
    this.isEditMode = data.mode === 'edit';

    this.form = this.fb.group({
      name: [data.service?.name || '', Validators.required],
      description: [data.service?.description || '', Validators.required],
      categoria: [data.service?.categoria || '', Validators.required],
      prezzo: [data.service?.prezzo || 0, [Validators.required, Validators.min(0)]],
      durata: [data.service?.durata || 30, [Validators.required, Validators.min(1)]],
      visibile: [data.service?.visibile ?? true]
    });
  }

  save(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      const service: Service = {
        ...this.data.service,
        id: this.data.service?.id || '',
        name: formValue.name,
        description: formValue.description,
        categoria: formValue.categoria,
        prezzo: formValue.prezzo,
        durata: formValue.durata,
        visibile: formValue.visibile,
        createdAt: this.data.service?.createdAt || Date.now(),
        updatedAt: Date.now(),
        creatoreId: this.data.service?.creatoreId || 'admin'
      };

      this.dialogRef.close(service);
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
