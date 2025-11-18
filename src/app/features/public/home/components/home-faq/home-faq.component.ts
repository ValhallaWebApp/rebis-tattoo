import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-home-faq',
  standalone:false,
  templateUrl: './home-faq.component.html',
  styleUrl: './home-faq.component.scss'
})
export class HomeFaqComponent {
  faqs = [
    {
      question: 'Come posso prenotare un appuntamento?',
      answer: 'Puoi usare il pulsante “Prenota un Appuntamento” sulla homepage o il form alla fine della pagina. Puoi anche prenotare direttamente dal profilo dell’artista.'
    },
    {
      question: 'Quanti anni devo avere per farmi un tatuaggio?',
      answer: 'Devi avere almeno 18 anni. In alcuni casi è richiesta un’autorizzazione scritta da un genitore se sei minorenne.'
    },
    {
      question: 'Fa male farsi un tatuaggio?',
      answer: 'Il dolore varia a seconda della zona e della sensibilità personale, ma è generalmente sopportabile.'
    },
    {
      question: 'Come devo prendermi cura del mio tatuaggio?',
      answer: 'Ti forniremo istruzioni dettagliate post-sessione. In generale: mantieni pulito, idrata e proteggi il tatuaggio.'
    },
    {
      question: 'Posso proporre i miei disegni allo studio?',
      answer: 'Certo! Gli artisti apprezzano lavorare su idee personali. Porta pure i tuoi sketch.'
    },
    {
      question: 'Quanto costa un tatuaggio?',
      answer: 'Dipende dalla dimensione, stile e durata. I prezzi partono da 49€.'
    }
  ];
  activeIndex: number | null | undefined;

  toggle(index: number) {
    this.activeIndex = this.activeIndex === index ? null : index;
  }

    constructor(public lang: LanguageService) {}

}
