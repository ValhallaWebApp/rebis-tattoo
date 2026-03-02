import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../../core/services/auth/auth.service';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { FastBookingStore } from '../../../fast-booking/state/fast-booking-store.service';
import { DynamicField } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';
import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfileService
} from '../../../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-home-contact',
  templateUrl: './home-contact.component.html',
  styleUrl: './home-contact.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly staffService = inject(StaffService);
  private readonly fastBookingStore = inject(FastBookingStore);
  private readonly studioProfile = inject(StudioProfileService);

  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly profileSig = toSignal(this.studioProfile.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  bookingForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    procedure: ['', Validators.required],
    artist: ['', Validators.required],
    comments: [''],
    privacyConsent: [false, Validators.requiredTrue]
  });

  readonly staff = signal<StaffMember[]>([]);
  readonly loading = signal(true);

  private readonly procedureKeys = [
    'permanentTattoo',
    'temporaryTattoo',
    'sketchDesign',
    'coverCorrection',
    'tattooRemoval',
    'piercing'
  ] as const;

  readonly user = computed(() => this.auth.userSig());
  readonly isLogged = computed(() => !!this.user());
  readonly userEmail = computed(() => (this.user() as { email?: string } | null)?.email ?? null);

  private readonly procedureOptions = computed(() =>
    this.procedureKeys.map((key) => {
      const label = this.lang.t(`home.contactSection.form.procedures.${key}`);
      return { label, value: label };
    })
  );

  readonly bookingFields = computed<DynamicField[]>(() => {
    const validArtists = this.staff().filter((artist) => !!artist.id);
    const artistOptions = validArtists.length
      ? validArtists.map((artist) => ({ label: artist.name, value: artist.id as string }))
      : [{ label: this.lang.t('home.contactSection.form.noArtistAvailable'), value: '' }];

    const isLogged = this.isLogged();
    const prefillHint = isLogged ? this.lang.t('home.contactSection.form.prefilledHint') : undefined;

    return [
      {
        type: 'text',
        name: 'fullName',
        label: this.lang.t('home.contactSection.form.fields.fullNameLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.fullNamePlaceholder'),
        required: true,
        minLength: 2,
        hint: prefillHint,
        readonly: isLogged
      },
      {
        type: 'email',
        name: 'email',
        label: this.lang.t('home.contactSection.form.fields.emailLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.emailPlaceholder'),
        required: true,
        hint: prefillHint,
        readonly: isLogged
      },
      {
        type: 'text',
        name: 'phone',
        label: this.lang.t('home.contactSection.form.fields.phoneLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.phonePlaceholder'),
        required: true
      },
      {
        type: 'select',
        name: 'procedure',
        label: this.lang.t('home.contactSection.form.fields.procedureLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.procedurePlaceholder'),
        required: true,
        options: this.procedureOptions()
      },
      {
        type: 'select',
        name: 'artist',
        label: this.lang.t('home.contactSection.form.fields.artistLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.artistPlaceholder'),
        required: true,
        options: artistOptions
      },
      {
        type: 'textarea',
        name: 'comments',
        label: this.lang.t('home.contactSection.form.fields.commentsLabel'),
        placeholder: this.lang.t('home.contactSection.form.fields.commentsPlaceholder'),
        rows: 4,
        className: 'full-width'
      },
      {
        type: 'checkbox',
        name: 'privacyConsent',
        label: this.lang.t('home.contactSection.form.fields.privacyConsentLabel'),
        required: true,
        className: 'full-width'
      }
    ];
  });

  readonly prefilledOnce = signal(false);

  private readonly prefillEffect = effect(() => {
    const u = this.user();

    const fullNameCtrl = this.bookingForm.get('fullName');
    const emailCtrl = this.bookingForm.get('email');

    if (!u) {
      this.prefilledOnce.set(false);
      return;
    }

    if (this.prefilledOnce()) return;

    const fullName =
      (u as { name?: string; displayName?: string; email?: string }).name ??
      (u as { displayName?: string }).displayName ??
      ((u as { email?: string }).email ? String((u as { email?: string }).email).split('@')[0] : '');

    const email = (u as { email?: string }).email ?? '';

    if (fullNameCtrl && !String(fullNameCtrl.value || '').trim()) {
      fullNameCtrl.setValue(fullName, { emitEvent: false });
    }

    if (emailCtrl && !String(emailCtrl.value || '').trim()) {
      emailCtrl.setValue(email, { emitEvent: false });
    }

    this.prefilledOnce.set(true);
  }, { allowSignalWrites: true });

  constructor() {
    this.loadStaff();
  }

  private async loadStaff(): Promise<void> {
    try {
      const staffList = await firstValueFrom(this.staffService.getAllStaff());
      const activeStaff = (staffList ?? []).filter((s) => s.isActive !== false);
      const artists = activeStaff.filter((s) => s.role === 'tatuatore');
      const fallback = artists.length > 0 ? artists : activeStaff;

      if (artists.length === 0) {
        console.warn('[HOME_CONTACT][STAFF] No active tattoo artist found, using active staff fallback');
      }

      this.staff.set(fallback);
    } catch (e) {
      console.error('[HOME_CONTACT][STAFF] ERROR', e);
      this.staff.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  goLogin(): void {
    sessionStorage.setItem('returnUrl', this.router.url);
    this.router.navigate(['/login']);
  }

  goRegister(): void {
    sessionStorage.setItem('returnUrl', this.router.url);
    this.router.navigate(['/register']);
  }

  onSubmit(): void {
    if (!this.bookingForm.valid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    const formData = this.bookingForm.getRawValue();
    this.fastBookingStore.applyHomeSeed(formData);
    this.router.navigate(['/fast-booking']);
  }

  contactTitlePrefix(): string {
    return this.profileSig().homeContactTitlePrefix || this.lang.t('home.contactSection.titlePrefix');
  }

  contactTitleSuffix(): string {
    return this.profileSig().homeContactTitleSuffix || this.lang.t('home.contactSection.titleSuffix');
  }
}
