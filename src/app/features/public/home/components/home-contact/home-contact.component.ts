import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../../core/services/auth/authservice';
import { FastBookingStore } from '../../../fast-booking/state/fast-booking-store.service';

@Component({
  selector: 'app-home-contact',
  templateUrl: './home-contact.component.html',
  styleUrl: './home-contact.component.scss',
  standalone: false
})
export class HomeContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly staffService = inject(StaffService);
    private readonly fastBookingStore = inject(FastBookingStore);

  readonly auth = inject(AuthService);

  bookingForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    procedure: ['', Validators.required],
    artist: ['', Validators.required], // ✅ deve contenere ARTIST ID
    comments: [''],
    privacyConsent: [false, Validators.requiredTrue]
  });

  staff = signal<StaffMember[]>([]);
  loading = signal(true);

  procedures = [
    'Tatuaggio Permanente',
    'Tatuaggio Temporaneo',
    'Sketch & Progettazione',
    'Copertura e Correzione',
    'Rimozione Tatuaggi',
    'Piercing'
  ];

  // ✅ user signals
  readonly user = computed(() => this.auth.userSig());
  readonly isLogged = computed(() => !!this.user());
  readonly userEmail = computed(() => (this.user() as any)?.email ?? null);

  // ✅ evita re-run fastidiosi mentre l’utente compila
  readonly prefilledOnce = signal(false);

  // ✅ effect in injection context (field initializer)
  private readonly prefillEffect = effect(() => {
    const u = this.user();

    const fullNameCtrl = this.bookingForm.get('fullName');
    const emailCtrl = this.bookingForm.get('email');

    if (!u) {
      this.prefilledOnce.set(false);
      fullNameCtrl?.enable({ emitEvent: false });
      emailCtrl?.enable({ emitEvent: false });
      return;
    }

    if (this.prefilledOnce()) return;

    const fullName =
      (u as any)?.name ??
      (u as any)?.displayName ??
      ((u as any)?.email ? String((u as any).email).split('@')[0] : '');

    const email = (u as any)?.email ?? '';

    if (fullNameCtrl && !String(fullNameCtrl.value || '').trim()) {
      fullNameCtrl.setValue(fullName, { emitEvent: false });
    }

    if (emailCtrl && !String(emailCtrl.value || '').trim()) {
      emailCtrl.setValue(email, { emitEvent: false });
    }

    // lock richiesto
    fullNameCtrl?.disable({ emitEvent: false });
    emailCtrl?.disable({ emitEvent: false });

    this.prefilledOnce.set(true);
  }, { allowSignalWrites: true });

  constructor() {
    this.loadStaff();
  }

  private async loadStaff(): Promise<void> {
    try {
      const staffList = await firstValueFrom(this.staffService.getAllStaff());
      const artists = (staffList ?? []).filter(s => s.isActive && s.role === 'tatuatore');
      this.staff.set(artists);
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

    // 1️⃣ prendi i dati del form (inclusi disabled)
    const formData = this.bookingForm.getRawValue();

    // 2️⃣ COMPILA SOLO I CAMPI nello store (nessuno step, nessun redirect interno)
    this.fastBookingStore.applyHomeSeed(formData);

    // 3️⃣ vai al wizard Fast Booking
    this.router.navigate(['/fast-booking']);
  }
}
