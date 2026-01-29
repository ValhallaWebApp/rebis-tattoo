import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
// import { ChatBotUiService } from '../../../shared/services/chat-bot-ui.service';

@Component({
  selector: 'app-contatti',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contatti.component.html',
  styleUrls: ['./contatti.component.scss'] // ✅ usa styleUrls
})
export class ContattiComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  // private readonly chatUi = inject(ChatBotUiService);

  contactForm!: FormGroup;

  // ✅ metti una foto reale in assets (vedi nota sotto)
  readonly heroImageUrl = '/personale/1.jpg';

  // ✅ numero in formato wa.me (senza + e spazi)
  readonly whatsappNumber = '393400998312';

  // ✅ dati Rebis
  readonly address = 'Via al Carmine 1A, 07100 Sassari (SS)';
  readonly phoneDisplay = '+39 340 099 8312';
  readonly email = 'sarapushi@rebistattoo.info';
  readonly instagramUrl = 'https://www.instagram.com/rebis_tattoo/';
  readonly instagramHandle = '@rebis_tattoo';

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  openChat(): void {
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

  get f() {
    return this.contactForm.controls;
  }
}
