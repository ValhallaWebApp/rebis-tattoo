import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-projects',
  standalone:false,
  templateUrl: './home-projects.component.html',
  styleUrl: './home-projects.component.scss'
})
export class HomeProjectsComponent {
  projects = [
    {
      title: 'Tatuaggio Realistico',
      description: 'Dettagli e profondità in uno stile iper-realistico.',
      imageUrl: '1.webp'
    },
    {
      title: 'Mandala',
      description: 'Simmetria e spiritualità in ogni linea.',
      imageUrl: '2.webp'
    },
    {
      title: 'Cover-up',
      description: 'Arte per trasformare e rinnovare.',
      imageUrl: '3.webp'
    }
  ];
 constructor(public lang: LanguageService) {
 }

}
