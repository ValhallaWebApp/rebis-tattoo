import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControlName } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-settings',
  standalone:true,
  imports: [CommonModule,MaterialModule,ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
 profileForm!: FormGroup;
  securityForm!: FormGroup;
  notificationForm!: FormGroup;
  tattooPrefsForm!: FormGroup;
  privacyForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      fullName: [''],
      email: [''],
      phone: [''],
      dob: [null],
      gender: ['']
    });

    this.securityForm = this.fb.group({
      currentPassword: [''],
      newPassword: ['']
    });

    this.notificationForm = this.fb.group({
      notifyPromotions: [true],
      notifyReminders: [true],
      notifyNews: [false]
    });

    this.tattooPrefsForm = this.fb.group({
      style: [''],
      zone: [''],
      artist: [''],
      isFirstTattoo: [false]
    });

    this.privacyForm = this.fb.group({
      acceptMarketing: [true]
    });
  }
}
