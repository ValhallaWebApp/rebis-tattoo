import { Component } from '@angular/core';
import { LanguageService } from '../../../../../core/services/language/language.service';

@Component({
  selector: 'app-project-list',
  standalone: false,
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss'
})
export class ProjectListComponent {
  projects = [
    {
      id: 1,
      title: 'Ritratto Realistico Volto',
      status: 'completed',
      genre: 'Realismo',
      date: '2023-11-22',
      imageUrl: '/projects/realismo-volto.webp'
    },
    {
      id: 2,
      title: 'Mandala Schiena Completa',
      status: 'completed',
      genre: 'Mandala',
      date: '2023-10-15',
      imageUrl: '/projects/mandala-schiena.webp'
    },
    {
      id: 3,
      title: 'Cover-up Rosa Nera',
      status: 'in-progress',
      genre: 'Cover-up',
      date: '2024-03-10',
      imageUrl: '/projects/coverup-rosa.webp'
    },
    {
      id: 4,
      title: 'Tatuaggio Tradizionale Americana',
      status: 'completed',
      genre: 'Tradizionale',
      date: '2023-12-04',
      imageUrl: '/projects/trad-americana.webp'
    },
    {
      id: 5,
      title: 'Mezza Manica Giapponese',
      status: 'completed',
      genre: 'Giapponese',
      date: '2024-01-25',
      imageUrl: '/projects/giapponese-mezzamanica.webp'
    },
    {
      id: 6,
      title: 'Fine Line Minimal',
      status: 'completed',
      genre: 'Fine Line',
      date: '2024-02-01',
      imageUrl: '/projects/fine-line.webp'
    },
    {
      id: 7,
      title: 'Bracciale Maori',
      status: 'in-progress',
      genre: 'Tribal',
      date: '2024-04-18',
      imageUrl: '/projects/maori-bracciale.webp'
    },
    {
      id: 8,
      title: 'Serpente Neotradizionale',
      status: 'completed',
      genre: 'Neotradizionale',
      date: '2024-01-08',
      imageUrl: '/projects/neotrad-serpente.webp'
    },
    {
      id: 9,
      title: 'Lettere Gotiche Avambraccio',
      status: 'completed',
      genre: 'Lettering',
      date: '2023-09-14',
      imageUrl: '/projects/gotico-lettering.webp'
    },
    {
      id: 10,
      title: 'Cover-up Vecchio Nome',
      status: 'completed',
      genre: 'Cover-up',
      date: '2024-02-20',
      imageUrl: '/projects/coverup-nome.webp'
    },
    {
      id: 11,
      title: 'Realismo Animale',
      status: 'in-progress',
      genre: 'Realismo',
      date: '2024-05-01',
      imageUrl: '/projects/realismo-animale.webp'
    },
    {
      id: 12,
      title: 'Tatuaggio Ornamental Schiena',
      status: 'completed',
      genre: 'Ornamentale',
      date: '2023-08-07',
      imageUrl: '/projects/ornamental.webp'
    },
    {
      id: 13,
      title: 'Astratto a Colori',
      status: 'in-progress',
      genre: 'Astratto',
      date: '2024-04-25',
      imageUrl: '/projects/astratto-colori.webp'
    },
    {
      id: 14,
      title: 'Floreale Delicato Braccio',
      status: 'completed',
      genre: 'Floreale',
      date: '2023-10-30',
      imageUrl: '/projects/floreale-braccio.webp'
    },
    {
      id: 15,
      title: 'Sketch a Matita Tattoo',
      status: 'completed',
      genre: 'Sketch',
      date: '2023-07-12',
      imageUrl: '/projects/sketch-matita.webp'
    },
    {
      id: 16,
      title: 'Minimal Linee Geometriche',
      status: 'completed',
      genre: 'Geometrico',
      date: '2023-11-09',
      imageUrl: '/projects/geometrico.webp'
    }
  ];
  selectedStatus: string = 'all';
  selectedGenre: string = 'all';
  filteredProjects:any=[]
  genres: string[] = [];

  ngOnInit(): void {
    this.extractGenres();
    this.applyFilters();
  }

  extractGenres() {
    const allGenres = this.projects.map(p => p.genre);
    this.genres = Array.from(new Set(allGenres)).sort();
  }

  applyFilters() {
    this.filteredProjects = this.projects.filter(project => {
      const statusMatch = this.selectedStatus === 'all' || project.status === this.selectedStatus;
      const genreMatch = this.selectedGenre === 'all' || project.genre === this.selectedGenre;
      return statusMatch && genreMatch;
    });
  }
  constructor(public lang: LanguageService) {}

}
