import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  DEFAULT_STUDIO_PROFILE,
  StudioProfile,
  StudioProfileService
} from '../../../core/services/studio/studio-profile.service';

@Component({
  selector: 'app-contatti',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contatti.component.html',
  styleUrls: ['./contatti.component.scss']
})
export class ContattiComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly studioProfileService = inject(StudioProfileService);
  private profileSub?: Subscription;

  contactForm!: FormGroup;
  profile: StudioProfile = DEFAULT_STUDIO_PROFILE;

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });

    this.profileSub = this.studioProfileService.getProfile().subscribe((profile) => {
      this.profile = profile;
    });
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  get heroImageUrl(): string {
    return this.profile.ownerPhotoUrl || '/personale/1.jpg';
  }

  get whatsappNumber(): string {
    return this.normalizePhoneForWhatsApp(this.profile.phoneDisplay);
  }

  openChat(): void {}

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    console.log('[CONTATTI] submit', this.contactForm.value);
    this.contactForm.reset();
    alert('Messaggio inviato. Ti risponderemo il prima possibile.');
  }

  get f() {
    return this.contactForm.controls;
  }

  private normalizePhoneForWhatsApp(value: string): string {
    return String(value ?? '').replace(/\D/g, '');
  }
}
