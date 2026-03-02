import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DynamicField, DynamicFormComponent } from '../../../shared/components/form/dynamic-form/dynamic-form.component';
import { AuthService } from '../../../core/services/auth/auth.service';

import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-contatti',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DynamicFormComponent],
  templateUrl: './contatti.component.html',
  styleUrls: ['./contatti.component.scss']
})
export class ContattiComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly studioProfileService = inject(StudioProfileService);
  private readonly profileSig = toSignal(this.studioProfileService.getProfile(), {
    initialValue: DEFAULT_STUDIO_PROFILE
  });

  contactForm!: FormGroup;
  readonly contactFields: DynamicField[] = [
    { type: 'text', name: 'name', label: 'Nome', placeholder: 'Il tuo nome', required: true, minLength: 2 },
    { type: 'email', name: 'email', label: 'Email', placeholder: 'nome@email.com', required: true },
    {
      type: 'textarea',
      name: 'message',
      label: 'Messaggio',
      placeholder: 'Zona, dimensioni, idea...',
      rows: 4,
      required: true,
      minLength: 10,
      className: 'full-width'
    }
  ];

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });

  }

  get profile(): StudioProfile {
    return this.profileSig();
  }

  get heroImageUrl(): string {
    return'/personale/sara.webp';
  }

  get whatsappNumber(): string {
    return this.normalizePhoneForWhatsApp(this.profile.phoneDisplay);
  }

  get collabMailto(): string {
    const subject = encodeURIComponent('Candidatura collaborazione - Rebis Tattoo');
    const body = encodeURIComponent(
      'Ciao Rebis Tattoo,\n\nmi piacerebbe collaborare con il vostro studio.\nVi lascio una breve presentazione:\n\n- Nome:\n- Portfolio/IG:\n- Esperienza:\n- Disponibilita:\n\nGrazie.'
    );
    return `mailto:${this.profile.email}?subject=${subject}&body=${body}`;
  }

  openChat(): void {
    if (this.auth.userSig()) {
      void this.router.navigate(['/dashboard/chat']);
      return;
    }
    sessionStorage.setItem('returnUrl', '/contatti');
    void this.router.navigate(['/login']);
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    console.log('[CONTATTI] submit', this.contactForm.value);
    this.contactForm.reset();
    alert('Messaggio inviato. Ti risponderemo il prima possibile.');
  }

  private normalizePhoneForWhatsApp(value: string): string {
    return String(value ?? '').replace(/\D/g, '');
  }
}
