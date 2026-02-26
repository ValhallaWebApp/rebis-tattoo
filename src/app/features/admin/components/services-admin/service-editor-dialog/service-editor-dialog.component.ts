import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { Service } from '../../../../../core/services/services/services.service';
import { DynamicField, DynamicFormComponent } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';

export type ServiceEditorDialogData = {
  mode: 'create' | 'edit';
  service?: Service;
};

@Component({
  selector: 'app-service-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './service-editor-dialog.component.html',
  styleUrl: './service-editor-dialog.component.scss'
})
export class ServiceEditorDialogComponent {
  isExpanded = false;
  readonly form;
  readonly infoFields: DynamicField[] = [
    { type: 'text', name: 'name', label: 'Nome*', required: true },
    {
      type: 'select',
      name: 'categoria',
      label: 'Categoria*',
      required: true,
      options: [
        { label: 'Tatuaggio', value: 'tatuaggio' },
        { label: 'Piercing', value: 'piercing' },
        { label: 'Laser', value: 'laser' },
        { label: 'Consulenza', value: 'consulenza' },
        { label: 'Altro', value: 'altro' }
      ]
    },
    {
      type: 'select',
      name: 'icon',
      label: 'Icona',
      options: [
        { label: 'Automatica', value: '' },
        { label: 'Tatuaggi', value: '/home/icon-01-80x80.png' },
        { label: 'Fine Line', value: '/home/icon-07-80x80.png' },
        { label: 'Copertura', value: '/home/icon-03-80x80.png' },
        { label: 'Design', value: '/home/icon-04-80x80.png' },
        { label: 'Trucco permanente', value: '/home/icon-05-80x80.png' },
        { label: 'Su misura', value: '/home/icon-custom-02.png' }
      ]
    },
    { type: 'textarea', name: 'description', label: 'Descrizione', rows: 4, className: 'full' }
  ];
  readonly commercialFields: DynamicField[] = [
    { type: 'toggle', name: 'prezzoDaConcordare', label: 'Prezzo su richiesta', className: 'full' },
    { type: 'toggle', name: 'durataDaConcordare', label: 'Durata su richiesta', className: 'full' },
    { type: 'number', name: 'prezzo', label: 'Prezzo (EUR)', min: 0 },
    { type: 'number', name: 'durata', label: 'Durata (min)', min: 0 },
    { type: 'toggle', name: 'visibile', label: 'Pubblica il servizio', className: 'full' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ServiceEditorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceEditorDialogData
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      categoria: ['tatuaggio', Validators.required],
      icon: [''],
      prezzoDaConcordare: [true],
      prezzo: [0, [Validators.min(0)]],
      durataDaConcordare: [true],
      durata: [0, [Validators.min(0)]],
      visibile: [false]
    });

    if (data?.service) {
      this.form.patchValue({
        name: data.service.name ?? '',
        description: data.service.description ?? '',
        categoria: data.service.categoria ?? 'tatuaggio',
        icon: data.service.icon ?? '',
        prezzoDaConcordare: data.service.prezzoDaConcordare ?? true,
        prezzo: data.service.prezzo ?? 0,
        durataDaConcordare: data.service.durataDaConcordare ?? true,
        durata: data.service.durata ?? 0,
        visibile: data.service.visibile ?? false
      });
    }

    this.form.get('prezzoDaConcordare')?.valueChanges.subscribe((v) => {
      const ctrl = this.form.get('prezzo');
      if (!ctrl) return;
      if (v) {
        ctrl.setValue(0);
        ctrl.clearValidators();
        ctrl.disable({ emitEvent: false });
      } else {
        ctrl.setValidators([Validators.required, Validators.min(0)]);
        ctrl.enable({ emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('durataDaConcordare')?.valueChanges.subscribe((v) => {
      const ctrl = this.form.get('durata');
      if (!ctrl) return;
      if (v) {
        ctrl.setValue(0);
        ctrl.clearValidators();
        ctrl.disable({ emitEvent: false });
      } else {
        ctrl.setValidators([Validators.required, Validators.min(0)]);
        ctrl.enable({ emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    if (this.form.value.prezzoDaConcordare) this.form.get('prezzo')?.disable({ emitEvent: false });
    if (this.form.value.durataDaConcordare) this.form.get('durata')?.disable({ emitEvent: false });
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.dialogRef.addPanelClass('service-editor-expanded');
    } else {
      this.dialogRef.removePanelClass('service-editor-expanded');
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    if (payload.prezzoDaConcordare) payload.prezzo = 0;
    if (payload.durataDaConcordare) payload.durata = 0;
    this.dialogRef.close(payload);
  }
}
