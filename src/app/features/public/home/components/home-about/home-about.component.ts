import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-about',
  standalone:false,
  templateUrl: './home-about.component.html',
  styleUrl: './home-about.component.scss'
})
export class HomeAboutComponent {
  readonly clientApproach = [
    {
      title: 'Ascolto e consulenza',
      text: 'Partiamo da idea, stile, zona e budget per definire un progetto realistico.'
    },
    {
      title: 'Proposta su misura',
      text: 'Prepariamo bozza e indicazioni tecniche prima della sessione.'
    },
    {
      title: 'Sessione e follow-up',
      text: 'Sessione in studio in sicurezza e supporto post tattoo per la cura.'
    }
  ];

  constructor(public lang: LanguageService) {}

}
