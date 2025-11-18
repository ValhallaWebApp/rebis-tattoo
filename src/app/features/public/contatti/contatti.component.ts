import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MaterialModule } from '../../../core/modules/material.module';
import { LanguageService } from '../../../core/services/language/language.service';

@Component({
  selector: 'app-contatti',
  imports: [MaterialModule, CommonModule,FormsModule,ReactiveFormsModule, RouterLink],
  standalone:true,
  templateUrl: './contatti.component.html',
  styleUrl: './contatti.component.scss'
})
export class ContattiComponent {
  contactForm!: FormGroup;

  constructor(private fb: FormBuilder, public lang: LanguageService) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit(): void {
    if (this.contactForm.valid) {
      console.log('Messaggio inviato:', this.contactForm.value);
      alert('Messaggio inviato con successo!');
      this.contactForm.reset();
    } else {
      this.contactForm.markAllAsTouched();
    }
  }
}
