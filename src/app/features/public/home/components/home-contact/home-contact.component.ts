import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../../core/services/auth/authservice';

@Component({
  selector: 'app-home-contact',
  templateUrl: './home-contact.component.html',
  styleUrl:  './home-contact.component.scss',
  standalone: false
})
export class HomeContactComponent implements OnInit {
  bookingForm!: FormGroup;
  staff: StaffMember[] = [];
  loading = true;                       // ⬅️  flag per il template

  procedures = [
    'Tatuaggio Permanente',
    'Tatuaggio Temporaneo',
    'Sketch & Progettazione',
    'Copertura e Correzione',
    'Rimozione Tatuaggi',
    'Piercing'
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private staffService: StaffService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.buildFormAndLoadStaff(); // tutto in parallelo
    this.loading = false;               // ora possiamo rendere il form
  }

  /** Carica utente + staff e inizializza il form */
private async buildFormAndLoadStaff(): Promise<void> {
  const [user, staffList] = await Promise.all([
    this.authService.getUser(),                              // ✅ correzione qui
    firstValueFrom(this.staffService.getAllStaff())
  ]);

  this.staff = staffList.filter(s => s.isActive && s.role === 'tatuatore');

  const fullName = user?.name || user?.email?.split('@')[0] || '';
  const email     = user?.email || '';

  this.bookingForm = this.fb.group({
    fullName:  [{ value: fullName, disabled: !!user }, [Validators.required, Validators.minLength(2)]],
    email:     [{ value: email,     disabled: !!user }, [Validators.required, Validators.email]],
    phone:     ['', Validators.required],
    procedure: ['', Validators.required],
    artist:    ['', Validators.required],
    comments:  [''],
    privacyConsent: [false, Validators.requiredTrue]
  });
}


  onSubmit(): void {
    if (this.bookingForm.valid) {
      const formData = this.bookingForm.getRawValue();
      localStorage.setItem('pendingBooking', JSON.stringify(formData));
      this.router.navigate(['/bookings']);
    } else {
      this.bookingForm.markAllAsTouched();
    }
  }
}
