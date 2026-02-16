import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { User } from '../../../../core/services/users/user.service';

type UserEditDialogData = {
  user: User;
  isAdmin: boolean;
};

export type UserEditPatch = Pick<User, 'name' | 'email' | 'phone' | 'urlAvatar' | 'isActive' | 'isVisible'>;

@Component({
  selector: 'app-user-edit-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  template: `
    <h2 mat-dialog-title>Modifica utente</h2>

    <mat-dialog-content [formGroup]="form" class="dialog-content">
      <mat-card class="meta-card" appearance="outlined">
        <div class="meta-grid">
          <div class="meta-item">
            <div class="k">ID</div>
            <div class="v mono">{{ data.user.id }}</div>
          </div>
          <div class="meta-item">
            <div class="k">Ruolo</div>
            <div class="v">{{ data.user.role }}</div>
          </div>
          <div class="meta-item" *ngIf="data.user.createdAt">
            <div class="k">Creato</div>
            <div class="v">{{ data.user.createdAt }}</div>
          </div>
          <div class="meta-item" *ngIf="data.user.updatedAt">
            <div class="k">Aggiornato</div>
            <div class="v">{{ data.user.updatedAt }}</div>
          </div>
        </div>
      </mat-card>

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

      <mat-form-field appearance="outline" *ngIf="data.isAdmin">
        <mat-label>Avatar URL</mat-label>
        <input matInput formControlName="urlAvatar" placeholder="/personale/client-01.jpg" />
      </mat-form-field>

      <div class="toggles" *ngIf="data.isAdmin">
        <mat-slide-toggle formControlName="isActive">Account attivo</mat-slide-toggle>
        <mat-slide-toggle formControlName="isVisible">Visibile in lista</mat-slide-toggle>
      </div>
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

    .meta-card {
      padding: 0.8rem;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.6rem;
    }

    @media (min-width: 520px) {
      .meta-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .meta-item .k {
      font-size: 0.75rem;
      opacity: 0.7;
      margin-bottom: 0.15rem;
    }

    .meta-item .v {
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      word-break: break-all;
    }

    .toggles {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.25rem;
      padding: 0.25rem 0;
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
      phone: [this.data.user.phone ?? ''],
      urlAvatar: [{ value: this.data.user.urlAvatar ?? '', disabled: !this.data.isAdmin }],
      isActive: [{ value: this.data.user.isActive ?? true, disabled: !this.data.isAdmin }],
      isVisible: [{ value: this.data.user.isVisible ?? true, disabled: !this.data.isAdmin }]
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
      phone: String(value.phone ?? '').trim(),
      urlAvatar: this.data.isAdmin ? String(value.urlAvatar ?? '').trim() : this.data.user.urlAvatar,
      isActive: this.data.isAdmin ? Boolean(value.isActive) : this.data.user.isActive,
      isVisible: this.data.isAdmin ? Boolean(value.isVisible) : this.data.user.isVisible
    });
  }
}
