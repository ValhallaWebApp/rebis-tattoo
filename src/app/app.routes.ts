import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { ServiceListComponent } from './features/public/services/service-list/service-list.component';
import { BookingListComponent } from './features/public/bookings/booking-list/booking-list.component';
import { ChiSiamoComponent } from './features/public/chi-siamo/chi-siamo.component';
import { ContattiComponent } from './features/public/contatti/contatti.component';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { FastBookingPageComponent } from './features/public/fast-booking/pages/fast-booking-page/fast-booking-page.component';

export const routes: Routes = [
  {path: 'login', component: LoginComponent},

  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home',  loadChildren: () => import('./features/public/home/home.module').then(m => m.HomeModule)},
  { path: 'servizi', component:ServiceListComponent },
  { path: 'progetti', loadChildren: () => import('./features/public/projects/projects.module').then(m => m.ProjectsModule) },
{ path: 'fast-booking', component: FastBookingPageComponent },
  { path: 'bookings', component:BookingListComponent },
  { path: 'chi-siamo', component: ChiSiamoComponent},
  { path: 'contatti', component: ContattiComponent},

  { path: 'dashboard',  loadChildren: () => import('./features/clients/clients.module').then(m => m.ClientsModule), canActivate: [AuthGuard]  },
  { path: 'admin',  loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),   canActivate: [AdminGuard]  },
  // { path: 'tattoo-areas', loadChildren: () => import('./modules/tattoo-areas/tattoo-areas.module').then(m => m.TattooAreasModule) },
  // { path: 'success', component: PaymentSuccessComponent },
  // { path: 'cancel',  component: PaymentCancelComponent },
{
  path: 'bookings/:id',
  loadComponent: () =>
    import('./features/public/bookings/components/booking-detail/booking-detail.component')
      .then(m => m.BookingDetailComponent)
},


  { path: '**', redirectTo: '/home' } // wildcard per errori 404
];
