import { Component, effect, signal } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { timer } from 'rxjs';

@Component({
  selector: 'app-home-featured-artists',
  standalone: false,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('800ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('800ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ],
  templateUrl: './home-featured-artists.component.html',
  styleUrls: ['./home-featured-artists.component.scss']
})
export class HomeFeaturedArtistsComponent {
  artists = [
    {
      name: 'Giulia Nero',
      title: 'Tatuatrice',
      experience: '10 anni',
      style: 'Realismo, Ritrattistica, Fine Line',
      ranking: 'Senior',
      quote: 'L’arte sulla pelle è un ricordo eterno.',
      imageUrl: '/home/team-4-370x370.jpg',
      portfolioUrl: '/portfolio/giulia'
    },
    {
      name: 'Marco Bellini',
      title: 'Tattoo Artist',
      experience: '7 anni',
      style: 'Tradizionale, Giapponese',
      ranking: 'Esperto',
      quote: 'Ogni tratto racconta una storia.',
      imageUrl: '/home/team-2-370x370.jpg',
      portfolioUrl: '/portfolio/marco'
    },
    {
      name: 'Luca Ferro',
      title: 'Tattoo Artist',
      experience: '12 anni',
      style: 'Lettering, Old School',
      ranking: 'Veterano',
      quote: 'Le parole rimangono, i tatuaggi anche.',
      imageUrl: '/home/team-3-370x370.jpg',
      portfolioUrl: '/portfolio/luca'
    },
    {
      name: 'Elisa Rosa',
      title: 'Tatuatrice',
      experience: '8 anni',
      style: 'Acquerello, Astratto',
      ranking: 'Senior',
      quote: 'Colore ed emozione su ogni pelle.',
      imageUrl: '/home/team-1-370x370.jpg',
      portfolioUrl: '/portfolio/elisa'
    }
  ];
  index = signal(0);

  // constructor() {
  //   effect(() => {
  //     timer(0, 5000).subscribe(() => {
  //       this.index.update(i => (i + 1) % this.artists.length);
  //     });
  //   });
  // }
}
