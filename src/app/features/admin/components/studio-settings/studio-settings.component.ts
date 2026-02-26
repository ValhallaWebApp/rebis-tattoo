import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MaterialModule } from '../../../../core/modules/material.module';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../../core/services/studio/studio-profile.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-studio-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './studio-settings.component.html',
  styleUrls: ['./studio-settings.component.scss']
})
export class StudioSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly studioProfile = inject(StudioProfileService);
  private readonly ui = inject(UiFeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  saving = false;

  readonly settingsForm: FormGroup = this.fb.group({
    studioName: [DEFAULT_STUDIO_PROFILE.studioName, [Validators.required, Validators.minLength(2)]],
    tagline: [DEFAULT_STUDIO_PROFILE.tagline, [Validators.required]],
    mission: [DEFAULT_STUDIO_PROFILE.mission, [Validators.required, Validators.minLength(10)]],
    teamIntro: [DEFAULT_STUDIO_PROFILE.teamIntro, [Validators.required, Validators.minLength(10)]],

    ownerName: [DEFAULT_STUDIO_PROFILE.ownerName, [Validators.required]],
    ownerRoleLabel: [DEFAULT_STUDIO_PROFILE.ownerRoleLabel, [Validators.required]],
    ownerBio: [DEFAULT_STUDIO_PROFILE.ownerBio, [Validators.required, Validators.minLength(10)]],
    ownerPhotoUrl: [DEFAULT_STUDIO_PROFILE.ownerPhotoUrl, [Validators.required]],

    address: [DEFAULT_STUDIO_PROFILE.address, [Validators.required]],
    phoneDisplay: [DEFAULT_STUDIO_PROFILE.phoneDisplay, [Validators.required]],
    email: [DEFAULT_STUDIO_PROFILE.email, [Validators.required, Validators.email]],
    instagramUrl: [DEFAULT_STUDIO_PROFILE.instagramUrl, [Validators.required]],
    instagramHandle: [DEFAULT_STUDIO_PROFILE.instagramHandle, [Validators.required]]
  });

  readonly identityFields: DynamicField[] = [
    { type: 'text', name: 'studioName', label: 'Nome studio' },
    { type: 'text', name: 'tagline', label: 'Tagline' },
    { type: 'textarea', name: 'mission', label: 'Mission', rows: 3, className: 'full' },
    { type: 'textarea', name: 'teamIntro', label: 'Intro team', rows: 3, className: 'full' }
  ];

  readonly ownerFields: DynamicField[] = [
    { type: 'text', name: 'ownerName', label: 'Nome titolare' },
    { type: 'text', name: 'ownerRoleLabel', label: 'Ruolo titolare' },
    { type: 'textarea', name: 'ownerBio', label: 'Bio titolare', rows: 4, className: 'full' },
    {
      type: 'text',
      name: 'ownerPhotoUrl',
      label: 'Foto titolare (url o path assets)',
      className: 'full'
    }
  ];

  readonly contactsFields: DynamicField[] = [
    { type: 'text', name: 'address', label: 'Indirizzo', className: 'full' },
    { type: 'text', name: 'phoneDisplay', label: 'Telefono' },
    { type: 'email', name: 'email', label: 'Email' },
    { type: 'text', name: 'instagramUrl', label: 'Instagram URL' },
    { type: 'text', name: 'instagramHandle', label: 'Instagram handle' }
  ];

  ngOnInit(): void {
    this.studioProfile.getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((profile) => {
        this.settingsForm.patchValue(profile, { emitEvent: false });
      });
  }

  async saveSettings(): Promise<void> {
    if (this.settingsForm.invalid || this.saving) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      await this.studioProfile.saveProfile(this.settingsForm.getRawValue() as Partial<StudioProfile>);
      this.ui.success('Impostazioni studio salvate.');
    } catch (err) {
      console.error('[StudioSettings] save failed', err);
      this.ui.error('Errore salvataggio impostazioni studio.');
    } finally {
      this.saving = false;
    }
  }
}
