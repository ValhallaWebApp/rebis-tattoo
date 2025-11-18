import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { ThemePalette } from '@angular/material/core';


@Component({
  selector: 'app-promo-referral',
  standalone:true,
  imports:[CommonModule,MaterialModule,ReactiveFormsModule],
  templateUrl: './promo-referral.component.html',
  styleUrls: ['./promo-referral.component.scss']
})
export class PromoReferralComponent implements OnInit {
  promoForm!: FormGroup;
  promoStatus: string = '';
promoStatusColor: ThemePalette | undefined;
  promoStatusIcon: string = '';
  copyMessage: string = '';
  userReferralCode: string = 'REBIS123';
  completedReferrals: string[] = [
    'Ricevuto bonus per invito completato!',
    'Ricevuto bonus per invito completato!',
    'Ricevuto bonus per invito completato!'
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.promoForm = this.fb.group({
      code: ['', Validators.required]
    });
  }

  applyPromo(): void {
    const enteredCode = this.promoForm.value.code.trim().toUpperCase();

    // Dati statici di esempio
    const validCodes = ['SUMMER25', 'REBIS10', 'WELCOME5'];

    if (validCodes.includes(enteredCode)) {
      this.promoStatus = `✅ Codice "${enteredCode}" applicato con successo!`;
      this.promoStatusColor = 'primary';
      this.promoStatusIcon = 'check_circle';
    } else {
      this.promoStatus = `❌ Codice "${enteredCode}" non valido.`;
      this.promoStatusColor = 'warn';
      this.promoStatusIcon = 'error';
    }

    // Reset campo input dopo invio
    this.promoForm.reset();
  }

  copyReferralCode(): void {
    navigator.clipboard.writeText(this.userReferralCode).then(() => {
      this.copyMessage = 'Codice copiato negli appunti!';
      setTimeout(() => this.copyMessage = '', 2500);
    });
  }
}
