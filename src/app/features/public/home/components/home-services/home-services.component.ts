import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-services',
  standalone:false,
  templateUrl: './home-services.component.html',
  styleUrl: './home-services.component.scss'
})
export class HomeServicesComponent {
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
  constructor(public lang: LanguageService) {}

}
