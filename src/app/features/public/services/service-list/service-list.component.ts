import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MaterialModule } from '../../../../core/modules/material.module';
import { LanguageService } from '../../../../core/services/language/language.service';

@Component({
  selector: 'app-service-list',
  standalone: true,
    imports: [
    CommonModule,
    MaterialModule
  ],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss'
})
export class ServiceListComponent {
 services = [
  {
    icon: '/home/icon-01-80x80.png',
    title: 'Tatuaggi',
    desc: 'Combiniamo tecniche moderne e tradizionali per un risultato di alta qualità.'
  },
  {
  icon: "/home/icon-07-80x80.png",
  title: "Tatuaggi Fine Line",
  desc: "Tatuaggi realizzati con linee sottili e dettagli delicati, ideali per chi cerca un design elegante e meno invasivo.",
  },
  {
    icon: '/home/icon-03-80x80.png',
    title: 'Copertura tatuaggi',
    desc: 'Hai vecchi tatuaggi che non ti piacciono più? Li copriremo con soluzioni artistiche.'
  },
  {
    icon: '/home/icon-04-80x80.png',
    title: 'Design personalizzato',
    desc: 'Niente è più stimolante che creare un design pensato solo per la tua pelle.'
  },
  {
    icon: '/home/icon-05-80x80.png',
    title: 'Trucco permanente',
    desc: 'Una tecnica cosmetica che utilizza tatuaggi per realizzare make-up a lunga durata sul viso.'
  },
  {
    icon: '/home/icon-custom-02.png',
    title: 'Tatuaggi su misura',
    desc: 'Ogni pelle è unica. Creiamo disegni esclusivi che rispecchiano la tua storia e il tuo stile.'
  }
];

  accordionServices:any = [
    {
      title: 'Tatuaggio Permanente',
      price: '49€',
      content: 'Il tipo di tatuaggio più comune, con pigmenti organici per un risultato duraturo.',
      images: [
        { src: '/ink/man-1.webp', alt: 'Tatuaggio permanente 1' },
        { src: '/ink/woman-2.webp', alt: 'Tatuaggio permanente 2' },
        { src: '/ink/woman-3.webp', alt: 'Tatuaggio permanente 3' }
      ],
      link: '/services/permanent'
    },
    {
      title: 'Tatuaggio Temporaneo',
      content: 'Tatuaggi non permanenti per eventi o esperienze temporanee.'
    },
    {
      title: 'Sketch e Progettazione',
      content: 'Disegni preparatori personalizzati per ogni cliente.'
    },
    {
      title: 'Copertura e Correzione',
      content: 'Soluzioni artistiche per coprire o correggere vecchi tatuaggi.'
    },
    {
      title: 'Rimozione Tatuaggi',
      content: 'Trattamenti per la rimozione parziale o completa.'
    }
  ];

    constructor(public lang: LanguageService) {}

}
