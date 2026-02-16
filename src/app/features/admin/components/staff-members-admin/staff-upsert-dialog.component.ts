import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember } from '../../../../core/services/staff/staff.service';

export interface StaffCandidateLite {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface StaffUpsertDialogData {
  mode: 'create' | 'edit';
  staff?: StaffMember;
  candidates: StaffCandidateLite[];
  alreadyStaffIds: string[];
}

export interface StaffUpsertDialogResult {
  mode: 'create' | 'edit';
  staff: StaffMember;
}

@Component({
  selector: 'app-staff-upsert-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  template: `
    <div class="dlg">
      <div class="dlg__header">
        <div class="dlg__title">
          <mat-icon>badge</mat-icon>
          <div>
            <h2>{{ data.mode === 'edit' ? 'Modifica staff' : 'Nuovo staff' }}</h2>
            <p class="sub">Nome, ruolo, biografia e selezionabilita nel calendario.</p>
          </div>
        </div>

        <button mat-icon-button type="button" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-divider class="sep"></mat-divider>

      <mat-card class="preview">
        <div class="row">
          <img [src]="imagePreview || '/assets/avatar-placeholder.png'" alt="avatar" />
          <div class="txt">
            <div class="name">{{ form.controls.name.value || 'Nome cognome' }}</div>
            <div class="meta">{{ form.controls.role.value | titlecase }}</div>
            <div class="pill" [class.on]="form.controls.isActive.value">{{ form.controls.isActive.value ? 'Attivo' : 'Non attivo' }}</div>
          </div>
        </div>
      </mat-card>

      <mat-divider class="sep soft"></mat-divider>

      <form [formGroup]="form" (ngSubmit)="save()" class="form">
        <mat-form-field appearance="outline" *ngIf="data.mode === 'create'" class="span2">
          <mat-label>Utente</mat-label>
          <mat-select formControlName="userId">
            <mat-option value="">Seleziona utente</mat-option>
            <mat-option *ngFor="let u of availableCandidates" [value]="u.id">
              {{ u.name }} <span *ngIf="u.email">({{ u.email }})</span>
            </mat-option>
          </mat-select>
          <mat-hint>Mostra solo utenti non admin e non gia nello staff.</mat-hint>
          <mat-error *ngIf="form.controls.userId.touched && form.controls.userId.hasError('required')">
            Seleziona un utente
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nome *</mat-label>
          <input matInput formControlName="name" />
          <mat-error *ngIf="form.controls.name.touched && form.controls.name.hasError('required')">
            Nome obbligatorio
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ruolo *</mat-label>
          <mat-select formControlName="role">
            <mat-option value="tatuatore">Tatuatore</mat-option>
            <mat-option value="piercer">Piercer</mat-option>
            <mat-option value="guest">Guest</mat-option>
            <mat-option value="altro">Altro</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="span2">
          <mat-label>Biografia</mat-label>
          <textarea matInput formControlName="bio" rows="4"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Avatar URL</mat-label>
          <input matInput formControlName="photoUrl" />
        </mat-form-field>

        <div class="toggle-wrap">
          <mat-slide-toggle formControlName="isActive">Attivo</mat-slide-toggle>
        </div>

        <div class="actions span2">
          <button mat-flat-button color="primary" type="submit">
            {{ data.mode === 'edit' ? 'Aggiorna' : 'Aggiungi' }}
          </button>
          <button mat-button type="button" (click)="close()">Annulla</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host { display: block; max-height: 80vh; }
    .dlg { color: whitesmoke; background: #121212; max-height: 80vh; overflow: auto; padding: 0.5rem 0.75rem 0.75rem; padding-right: 0.85rem; }
    .dlg__header { display:flex; justify-content: space-between; align-items:flex-start; gap: 1rem; padding: 0.25rem 0 0.75rem; }
    .dlg__title { display:flex; align-items:flex-start; gap: 0.75rem; }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .sub { margin: 0.15rem 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.7); }
    .preview { background: #151515; border: 1px solid rgba(255,255,255,0.06); margin: 0.25rem 0 1rem; }
    .row { display:flex; align-items:center; gap: 0.75rem; padding: 0.75rem; }
    img { width: 46px; height: 46px; border-radius: 50%; border: 2px solid rgba(190,144,69,0.55); object-fit: cover; }
    .txt { display:flex; flex-direction: column; gap: 0.15rem; }
    .name { font-weight: 700; }
    .meta { font-size: 0.85rem; color: rgba(255,255,255,0.75); }
    .pill { display:inline-flex; width: fit-content; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.72rem; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.75); }
    .pill.on { border-color: #be9045; color: #be9045; background: rgba(190,144,69,0.16); }
    .form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.9rem;
    }
    @media (min-width: 720px) {
      .form { grid-template-columns: 1fr 1fr; }
      .span2 { grid-column: 1 / span 2; }
    }
    .toggle-wrap { display:flex; align-items:center; min-height: 56px; }
    @media (min-width: 720px) { .toggle-wrap { grid-column: 1 / span 2; } }
    .actions { display:flex; justify-content: space-between; gap: 0.5rem; padding-top: 0.25rem; }
    .sep { border-top-color: rgba(255, 255, 255, 0.10) !important; }
    .sep.soft { margin: 0.5rem 0 0.9rem; border-top-color: rgba(255, 255, 255, 0.06) !important; }
    :host ::ng-deep .mat-mdc-dialog-surface { background: #121212 !important; }
    :host ::ng-deep .mat-mdc-form-field .mat-mdc-floating-label { color: rgba(255,255,255,0.86) !important; }
    :host ::ng-deep .mat-mdc-form-field.mat-focused .mat-mdc-floating-label { color: rgba(190,144,69,0.95) !important; }
    :host ::ng-deep .mat-mdc-input-element, :host ::ng-deep .mat-mdc-select-value-text { color: whitesmoke !important; }
    :host ::ng-deep .mat-mdc-select-placeholder { color: rgba(255,255,255,0.72) !important; }
    :host ::ng-deep .mdc-notched-outline__leading,
    :host ::ng-deep .mdc-notched-outline__notch,
    :host ::ng-deep .mdc-notched-outline__trailing { border-color: rgba(255,255,255,0.2) !important; }
    :host ::ng-deep .mdc-text-field--focused .mdc-notched-outline__leading,
    :host ::ng-deep .mdc-text-field--focused .mdc-notched-outline__notch,
    :host ::ng-deep .mdc-text-field--focused .mdc-notched-outline__trailing { border-color: rgba(190,144,69,0.75) !important; }
    :host ::ng-deep .mat-mdc-slide-toggle .mdc-label { color: rgba(255,255,255,0.95) !important; }
  `]
})
export class StaffUpsertDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly availableCandidates: StaffCandidateLite[];

  readonly form = this.fb.nonNullable.group({
    userId: this.fb.nonNullable.control(''),
    name: this.fb.nonNullable.control('', Validators.required),
    role: this.fb.nonNullable.control<StaffMember['role']>('tatuatore', Validators.required),
    bio: this.fb.nonNullable.control(''),
    photoUrl: this.fb.nonNullable.control(''),
    isActive: this.fb.nonNullable.control(true),
  });

  imagePreview = '';

  constructor(
    private readonly dialogRef: MatDialogRef<StaffUpsertDialogComponent, StaffUpsertDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: StaffUpsertDialogData
  ) {
    const already = new Set((data.alreadyStaffIds ?? []).map(x => String(x).trim()).filter(Boolean));
    this.availableCandidates = (data.candidates ?? []).filter(c => {
      const id = String(c.id ?? '').trim();
      if (!id) return false;
      if (String(c.role ?? '').toLowerCase() === 'admin') return false;
      if (already.has(id)) return false;
      return true;
    });

    if (data.mode === 'edit' && data.staff) {
      this.form.patchValue({
        userId: String(data.staff.userId ?? data.staff.id ?? ''),
        name: data.staff.name ?? '',
        role: data.staff.role ?? 'tatuatore',
        bio: data.staff.bio ?? '',
        photoUrl: data.staff.photoUrl ?? '',
        isActive: data.staff.isActive ?? true,
      });
    } else {
      // create mode: userId required
      this.form.controls.userId.addValidators(Validators.required);
      this.form.controls.userId.updateValueAndValidity({ emitEvent: false });
    }

    this.imagePreview = this.form.controls.photoUrl.value;
    this.form.controls.photoUrl.valueChanges.subscribe(v => (this.imagePreview = v ?? ''));

    this.form.controls.userId.valueChanges.subscribe(uid => {
      if (this.data.mode !== 'create') return;
      const sel = this.availableCandidates.find(c => c.id === uid);
      if (!sel) return;
      this.form.patchValue(
        {
          name: sel.name || '',
          bio: sel.bio || '',
          photoUrl: sel.avatarUrl || '',
        },
        { emitEvent: false }
      );
      this.imagePreview = sel.avatarUrl || this.imagePreview;
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const uid = this.data.mode === 'edit'
      ? String(this.data.staff?.userId ?? this.data.staff?.id ?? '').trim()
      : String(raw.userId ?? '').trim();

    const staff: StaffMember = {
      ...(this.data.staff ?? {}),
      id: uid || (this.data.staff?.id ?? ''),
      userId: uid || (this.data.staff?.userId ?? ''),
      name: raw.name,
      role: raw.role,
      bio: raw.bio ?? '',
      photoUrl: raw.photoUrl ?? '',
      isActive: raw.isActive ?? true,
    };

    this.dialogRef.close({ mode: this.data.mode, staff });
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
