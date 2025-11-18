import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Timestamp } from 'firebase/firestore';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NativeDateModule } from '@angular/material/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { MaterialModule } from '../../../../core/modules/material.module';

export interface Project {
  id: string;
  dataProgetto: string;
  name: string;
  copertine: string[];
  createAt: Timestamp;
  updateAt: Timestamp;
  genere: string;
  numeroSedute: number;
  show: boolean;
  note: string;
  utenteCreatore: string;
  collaboratori?: string[] | null;
}

@Component({
  selector: 'app-project-dialog-admin',
  standalone:true,
  imports:[CommonModule,ReactiveFormsModule, MaterialModule,MatDatepickerModule,NativeDateModule,FullCalendarModule],
  templateUrl: './project-dialog-admin.component.html',
  styleUrls: ['./project-dialog-admin.component.scss'],
})
export class ProjectDialogAdminComponent {
  form: FormGroup;
  isEditMode: boolean;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProjectDialogAdminComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: 'create' | 'edit'; project?: Project }
  ) {
    this.isEditMode = data.mode === 'edit';

    this.form = this.fb.group({
      name: [data.project?.name || '', Validators.required],
      genere: [data.project?.genere || '', Validators.required],
      numeroSedute: [data.project?.numeroSedute || 1, [Validators.required, Validators.min(1)]],
      note: [data.project?.note || ''],
      show: [data.project?.show ?? true],
      copertine: [data.project?.copertine?.join(', ') || ''], // input testuale separato da virgole
      collaboratori: [data.project?.collaboratori?.join(', ') || ''],
      dataProgetto: [data.project?.dataProgetto || new Date(), Validators.required],
    });
  }

  save(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      const project: Project = {
        ...this.data.project,
        id: this.data.project?.id || '',
        name: formValue.name,
        genere: formValue.genere,
        numeroSedute: formValue.numeroSedute,
        note: formValue.note,
        show: formValue.show,
        dataProgetto: new Date(formValue.dataProgetto).toISOString(),
        copertine: formValue.copertine.split(',').map((s: string) => s.trim()),
        collaboratori: formValue.collaboratori
          ? formValue.collaboratori.split(',').map((s: string) => s.trim())
          : null,
        createAt: this.data.project?.createAt || Timestamp.now(),
        updateAt: Timestamp.now(),
        utenteCreatore: this.data.project?.utenteCreatore || 'admin', // fallback hardcoded
      };

      this.dialogRef.close(project);
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
