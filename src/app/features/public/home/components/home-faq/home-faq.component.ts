import { Component } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-faq',
  standalone: false,
  templateUrl: './home-faq.component.html',
  styleUrl: './home-faq.component.scss',
  animations: [
    trigger('faqExpand', [
      state('collapsed', style({ height: '0px', opacity: 0, marginTop: '0px' })),
      state('expanded', style({ height: '*', opacity: 1, marginTop: '0.75rem' })),
      transition('collapsed <=> expanded', animate('260ms cubic-bezier(0.22, 1, 0.36, 1)'))
    ])
  ]
})
export class HomeFaqComponent {
  faqs = [
    {
      question: 'Come posso prenotare un appuntamento?',
      answer: 'Puoi usare il pulsante "Prenota un Appuntamento" sulla homepage o il form alla fine della pagina. Puoi anche prenotare direttamente dal profilo dell\'artista.'
    },
    {
      question: 'Quanti anni devo avere per farmi un tatuaggio?',
      answer: 'Devi avere almeno 18 anni. In alcuni casi e richiesta un\'autorizzazione scritta da un genitore se sei minorenne.'
    },
    {
      question: 'Fa male farsi un tatuaggio?',
      answer: 'Il dolore varia a seconda della zona e della sensibilita personale, ma e generalmente sopportabile.'
    },
    {
      question: 'Come devo prendermi cura del mio tatuaggio?',
      answer: 'Ti forniremo istruzioni dettagliate post-sessione. In generale: mantieni pulito, idrata e proteggi il tatuaggio.'
    },
    {
      question: 'Posso proporre i miei disegni allo studio?',
      answer: 'Certo. Gli artisti apprezzano lavorare su idee personali. Porta pure i tuoi sketch.'
    },
    {
      question: 'Quanto costa un tatuaggio?',
      answer: 'Dipende da dimensione, stile e durata. I prezzi partono da 49 EUR.'
    }
  ];

  activeIndex: number | null = null;

  constructor(public lang: LanguageService) {}

  toggle(index: number): void {
    this.activeIndex = this.activeIndex === index ? null : index;
  }
}
