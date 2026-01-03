import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MaterialModule } from '../../../core/modules/material.module';

interface CarouselSlide {
  src: string;
  alt: string;
  title?: string;
  caption?: string;
}

interface TeamMember {
  name: string;
  role: string;
  style: string;
  photo: string;
}

@Component({
  standalone: true,
  selector: 'app-chi-siamo',
  imports: [CommonModule,MaterialModule],
  templateUrl: './chi-siamo.component.html',
  styleUrls: ['./chi-siamo.component.scss'],
})
export class ChiSiamoComponent implements OnInit, OnDestroy {
  slides: CarouselSlide[] = [
    {
      src: 'assets/rebis/carousel/carousel-1.jpg',
      alt: 'Tatuatore al lavoro in studio',
      title: 'Studio Rebis',
      caption: 'Luci basse, blackwork e attenzione totale ai dettagli.',
    },
    {
      src: 'assets/rebis/carousel/carousel-2.jpg',
      alt: 'Dettaglio di un tatuaggio blackwork',
      title: 'Blackwork & Fine Line',
      caption: 'Linee pulite, contrasti netti e progetti su misura.',
    },
    {
      src: 'assets/rebis/carousel/carousel-3.jpg',
      alt: 'Cliente durante una sessione',
      title: 'Ogni sessione è unica',
      caption: 'Studiamo posizionamento, forme e guarigione nel tempo.',
    },
  ];

  team: TeamMember[] = [
    {
      name: 'Sara Pushi',
      role: 'Tatuatrice - Titolare',
      style: 'Blackwork · Fine Line',
      photo: '1.jpg',
    },
    {
      name: 'Michele',
      role: 'Tatuatore',
      style: 'Realismo · Coperture',
      photo: '2.jpg',
    },
    {
      name: 'Lorenzo',
      role: 'Tatuatore',
      style: 'Ornamentale · Geometrico',
      photo: '3.jpg',
    },
  ];

  activeIndex = 0;
  autoPlayDelay = 5000; // ms
  private intervalId: any;
  private isPaused = false;

  ngOnInit(): void {
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  // -------- CAROSELLO --------

  startAutoPlay(): void {
    this.stopAutoPlay();
    this.intervalId = setInterval(() => {
      if (!this.isPaused && this.slides.length > 1) {
        this.next();
      }
    }, this.autoPlayDelay);
  }

  stopAutoPlay(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  next(): void {
    this.activeIndex = (this.activeIndex + 1) % this.slides.length;
  }

  prev(): void {
    this.activeIndex =
      (this.activeIndex - 1 + this.slides.length) % this.slides.length;
  }

  goTo(index: number): void {
    this.activeIndex = index;
    this.restartAutoPlay();
  }

  onCarouselEnter(): void {
    // desktop: pausa hover; su mobile non cambia nulla
    this.isPaused = true;
  }

  onCarouselLeave(): void {
    this.isPaused = false;
  }

  restartAutoPlay(): void {
    this.isPaused = false;
    this.startAutoPlay();
  }

  getTransform(): string {
    return `translateX(-${this.activeIndex * 100}%)`;
  }

  // -------- IG --------
  openInstagram(): void {
    window.open('https://www.instagram.com/rebis_tattoo', '_blank');
  }}
