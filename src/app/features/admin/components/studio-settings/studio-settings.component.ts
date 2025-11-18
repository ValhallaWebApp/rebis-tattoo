import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-studio-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './studio-settings.component.html',
  styleUrls: ['./studio-settings.component.scss']
})
export class StudioSettingsComponent implements OnInit {
  settingsForm!: FormGroup;
  weekdays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.settingsForm = this.fb.group({
      studioName: ['Rebis Tattoo'],
      email: [''],
      phone: [''],
      notifyByEmail: [true],
      notifyByWhatsApp: [false],
      maintenanceMode: [false],

      primaryColor: ['#000000'],
      accentColor: ['#d4af37'],

      socialLinks: this.fb.group({
        instagram: [''],
        facebook: [''],
        whatsapp: ['']
      }),

      notificationText: ['Grazie per aver prenotato! Ti aspettiamo :)'],

      visibility: this.fb.group({
        portfolio: [true],
        reviews: [true],
        chatbot: [true]
      }),

      weeklyHours: this.fb.array(
        this.weekdays.map(() =>
          this.fb.group({
            open: ['10:00'],
            close: ['19:30'],
            closed: [false]
          })
        )
      )
    });
  }

  get weeklyHours(): FormArray {
    return this.settingsForm.get('weeklyHours') as FormArray;
  }

  saveSettings(): void {
    if (this.settingsForm.valid) {
      console.log('Impostazioni salvate:', this.settingsForm.value);
      // salva via servizio
    }
  }
}
