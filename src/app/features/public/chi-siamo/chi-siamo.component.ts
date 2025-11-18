import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MaterialModule } from '../../../core/modules/material.module';
import { LanguageService } from '../../../core/services/language/language.service';

@Component({
  selector: 'app-chi-siamo',
  standalone:true,
  imports: [MaterialModule,CommonModule,RouterLink],
  templateUrl: './chi-siamo.component.html',
  styleUrl: './chi-siamo.component.scss'
})
export class ChiSiamoComponent {

  currentIndex = 0;
  artists = [
    {
      name: 'Giulia Nero',
      title: 'Tatuatrice',
      experience: '10 anni',
      style: 'Realismo, Ritrattistica, Fine Line',
      ranking: 'Senior',
      quote: 'L’arte sulla pelle è un ricordo eterno.',
      imageUrl: '/man-2.webp',
      portfolioUrl: '/portfolio/giulia'
    },
    {
      name: 'Marco Bellini',
      title: 'Tattoo Artist',
      experience: '7 anni',
      style: 'Tradizionale, Giapponese',
      ranking: 'Esperto',
      quote: 'Ogni tratto racconta una storia.',
      imageUrl: '/woman-2.webp',
      portfolioUrl: '/portfolio/marco'
    },
    {
      name: 'Sara Leone',
      title: 'Tatuatrice',
      experience: '5 anni',
      style: 'Geometrico, Mandala',
      ranking: 'Avanzata',
      quote: 'Simmetria e significato in ogni linea.',
      imageUrl: '/man-1.webp',
      portfolioUrl: '/portfolio/sara'
    }
  ];
  constructor(public lang: LanguageService) {}

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.artists.length;
  }

  prevSlide() {
    this.currentIndex = (this.currentIndex - 1 + this.artists.length) % this.artists.length;
  }
}
