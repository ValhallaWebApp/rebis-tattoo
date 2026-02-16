import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { ServiceListComponent } from './features/public/services/service-list/service-list.component';
import { ChiSiamoComponent } from './features/public/chi-siamo/chi-siamo.component';
import { ContattiComponent } from './features/public/contatti/contatti.component';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { AdminOnlyGuard } from './core/guards/admin-only.guard';
import { FastBookingPageComponent } from './features/public/fast-booking/pages/fast-booking-page/fast-booking-page.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: LoginComponent, data: { mode: 'register' } },
  { path: 'auth/login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'auth/register', redirectTo: 'register', pathMatch: 'full' },
  {
    path: 'access-denied',
    loadComponent: () =>
      import('./shared/components/access-denied/access-denied.component')
        .then(m => m.AccessDeniedComponent),
  },

  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadChildren: () => import('./features/public/home/home.module').then(m => m.HomeModule) },

  { path: 'servizi', component: ServiceListComponent },

  // ✅ LISTA PROGETTI (tutti o filtrati per artista)
  {
    path: 'progetti',
    loadChildren: () =>
      import('./features/public/projects/projects-routing.module')
        .then(r => r.PROJECTS_ROUTES),
  },

  // ✅ DETTAGLIO SINGOLO PROGETTO
  {
    path: 'progetto/:idProgetto',
    loadComponent: () =>
      import('./features/public/projects/components/project-detail/project-detail.component')
        .then(m => m.ProjectDetailComponent),
  },

  { path: 'fast-booking', component: FastBookingPageComponent },
  { path: 'chi-siamo', component: ChiSiamoComponent },
  { path: 'contatti', component: ContattiComponent },

  { path: 'dashboard', loadChildren: () => import('./features/clients/clients.module').then(m => m.ClientsModule), canActivate: [AuthGuard] },
  { path: 'staff', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule), canActivate: [AdminGuard] },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule), canActivate: [AdminOnlyGuard] },

  { path: '**', redirectTo: '/home' }
];
