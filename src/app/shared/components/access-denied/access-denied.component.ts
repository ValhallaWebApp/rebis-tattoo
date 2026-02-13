import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="access-denied">
      <h1>Accesso negato</h1>
      <p>Non hai i permessi necessari per visualizzare questa pagina.</p>
      <a routerLink="/home">Torna alla home</a>
    </section>
  `,
  styles: [`
    .access-denied {
      min-height: 60vh;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.75rem;
      padding: 1rem;
    }
    h1 { margin: 0; }
    p { margin: 0; }
  `]
})
export class AccessDeniedComponent {}
