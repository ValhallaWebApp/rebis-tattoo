import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { User } from '../../../../core/services/users/user.service';

type UserEditDialogData = {
  user: User;
};

export type UserEditPatch = Pick<User, 'name' | 'email' | 'phone'>;

@Component({
  selector: 'app-user-edit-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>Modifica utente</h2>

    <mat-dialog-content [formGroup]="form" class="dialog-content">
      <mat-form-field appearance="outline">
        <mat-label>Nome</mat-label>
        <input matInput formControlName="name" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Telefono</mat-label>
        <input matInput formControlName="phone" />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="close()">Annulla</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">Salva</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      display: grid;
      gap: 0.7rem;
      width: min(520px, 85vw);
      padding-top: 0.4rem;
    }
  `]
})
export class UserEditDialogComponent {
  readonly form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UserEditDialogComponent, UserEditPatch | null>,
    @Inject(MAT_DIALOG_DATA) public data: UserEditDialogData
  ) {
    this.form = this.fb.group({
      name: [this.data.user.name ?? '', [Validators.required, Validators.minLength(2)]],
      email: [this.data.user.email ?? '', [Validators.required, Validators.email]],
      phone: [this.data.user.phone ?? '']
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.dialogRef.close({
      name: String(value.name ?? '').trim(),
      email: String(value.email ?? '').trim(),
      phone: String(value.phone ?? '').trim()
    });
  }
}
