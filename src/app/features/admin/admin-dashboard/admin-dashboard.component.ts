import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../core/modules/material.module';
import { BookingService } from '../../../core/services/bookings/booking.service';
import { Review, ReviewsService } from '../../../core/services/reviews/reviews.service';
import { ClientService } from '../../../core/services/clients/client.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { StatusHelperService } from '../../../core/services/helpers/status-helper.service';

type QuickLink = {
  title: string;
  description: string;
  icon: string;
  route: string;
  showForStaff?: boolean;
  requiresRoleManagement?: boolean;
  requiredPermission?: string;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly clientService = inject(ClientService);
  private readonly auth = inject(AuthService);
  private readonly status = inject(StatusHelperService);

  todayAppointments: any[] = [];
  todayPendingCount = 0;
  todayInProgressCount = 0;
  todayCompletedCount = 0;

  latestReviews: any[] = [];
  pendingReviewsCount = 0;
  avgReviewRating = 0;
  totalClients = 0;
  totalRevenue = 0;
  quickLinks: QuickLink[] = [];
  backofficeBase: '/admin' | '/staff' = '/admin';

  private readonly allQuickLinks: QuickLink[] = [
    {
      title: 'Calendario',
      description: 'Gestione appuntamenti e disponibilita',
      icon: 'calendar_today',
      route: 'calendar',
      showForStaff: true,
      requiredPermission: 'canManageBookings'
    },
    {
      title: 'Utenti',
      description: 'Gestione unificata clienti e staff',
      icon: 'groups',
      route: 'users',
      showForStaff: true,
      requiresRoleManagement: true
    },
    {
      title: 'Permessi',
      description: 'Gestione permessi e deleghe staff',
      icon: 'admin_panel_settings',
      route: 'permissions'
    },
    {
      title: 'Clienti',
      description: 'Anagrafica clienti e filtri rapidi',
      icon: 'person_search',
      route: 'clients',
      showForStaff: true,
      requiresRoleManagement: true
    },
    {
      title: 'Staff',
      description: 'Profili staff, turni e competenze',
      icon: 'badge',
      route: 'staff',
      requiresRoleManagement: true
    },
    {
      title: 'Impostazioni Studio',
      description: 'Contenuti pubblici e dati studio',
      icon: 'settings',
      route: 'settings'
    },
    {
      title: 'Recensioni',
      description: 'Moderazione recensioni utenti',
      icon: 'rate_review',
      route: 'reviews'
    },
    {
      title: 'Portfolio',
      description: 'Progetti e tatuaggi completati',
      icon: 'palette',
      route: 'portfolio',
      showForStaff: true,
      requiredPermission: 'canManageProjects'
    },
    {
      title: 'Messaggi',
      description: 'Chat e ticket da gestire',
      icon: 'forum',
      route: 'messaging',
      showForStaff: true,
      requiredPermission: 'canManageMessages'
    },
    {
      title: 'Fatturazione',
      description: 'Pagamenti e stato incassi',
      icon: 'payments',
      route: 'billing'
    },
    {
      title: 'Bonus',
      description: 'Wallet e codici promo',
      icon: 'redeem',
      route: 'bonus'
    },
    {
      title: 'Documenti',
      description: 'Archivio documentale studio',
      icon: 'description',
      route: 'documents'
    },
    {
      title: 'Waitlist',
      description: 'Clienti in attesa e follow-up',
      icon: 'schedule_send',
      route: 'waitlist'
    },
    {
      title: 'Analytics',
      description: 'Panoramica KPI e trend',
      icon: 'monitoring',
      route: 'analytics'
    },
    {
      title: 'Audit Logs',
      description: 'Tracciamento azioni e sicurezza',
      icon: 'history',
      route: 'audit-logs'
    }
  ];

  ngOnInit(): void {
    const user = this.auth.userSig();
    const isStaff = user?.role === 'staff';
    const canManageRoles = this.auth.canManageRoles(user);
    const basePath: '/admin' | '/staff' = isStaff ? '/staff' : '/admin';
    this.backofficeBase = basePath;

    this.quickLinks = this.allQuickLinks
      .filter(link => !isStaff || link.showForStaff === true)
      .filter(link => !link.requiresRoleManagement || canManageRoles)
      .filter(link => {
        if (!isStaff) return true;
        if (!link.requiredPermission) return true;
        return user?.permissions?.[link.requiredPermission] === true;
      })
      .map(link => ({ ...link, route: `${basePath}/${link.route}` }));

    const today = new Date();
    this.bookingService.getBookingsByDate(today).subscribe(bookings => {
      const list = (bookings ?? []).slice().sort((a: any, b: any) =>
        String(a?.start ?? '').localeCompare(String(b?.start ?? ''))
      );
      this.todayAppointments = list;
      this.todayPendingCount = list.filter(b => this.status.bookingStatusKey(b?.status) === 'pending').length;
      this.todayInProgressCount = list.filter(b => this.status.bookingStatusKey(b?.status) === 'in_progress').length;
      this.todayCompletedCount = list.filter(b => this.status.bookingStatusKey(b?.status) === 'completed').length;
    });

    this.reviewsService.getRecentReviews(5).subscribe((reviews: any[]) => {
      this.latestReviews = reviews || [];
    });

    this.reviewsService.getAllReviews().subscribe((reviews: Review[]) => {
      const list = reviews ?? [];
      this.pendingReviewsCount = list.filter(r => this.status.reviewStatusKey(r?.status) === 'pending').length;
      const approved = list.filter(r => this.status.reviewStatusKey(r?.status) === 'approved');
      this.avgReviewRating = approved.length
        ? approved.reduce((sum, r) => sum + (Number(r?.rating ?? 0) || 0), 0) / approved.length
        : 0;
    });

    this.clientService.getClients().subscribe(clients => {
      this.totalClients = clients.length;
    });

    this.bookingService.getTotalRevenueThisMonth().subscribe(value => {
      this.totalRevenue = value;
    });
  }

  get todayTopAppointments(): any[] {
    return this.todayAppointments.slice(0, 6);
  }

  get completionRateToday(): number {
    if (!this.todayAppointments.length) return 0;
    return Math.round((this.todayCompletedCount / this.todayAppointments.length) * 100);
  }

  get avgReviewLabel(): string {
    if (!this.avgReviewRating) return '-';
    return this.avgReviewRating.toFixed(1);
  }

  toRoute(path: string): string {
    return `${this.backofficeBase}/${path}`;
  }

  bookingStatusLabel(status: unknown): string {
    return this.status.bookingLabel(status);
  }

  bookingStatusClass(status: unknown): string {
    return this.status.bookingTone(status);
  }

  reviewStatusClass(status: unknown): string {
    return this.status.reviewTone(status);
  }

  reviewStatusLabel(status: unknown): string {
    return this.status.reviewLabel(status);
  }

  bookingTitle(booking: any): string {
    return String(booking?.title ?? booking?.notes ?? booking?.id ?? 'Prenotazione').trim() || 'Prenotazione';
  }

  bookingTime(booking: any): string {
    const raw = String(booking?.start ?? '').trim();
    if (!raw) return '-';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  reviewAuthor(review: any): string {
    return String(review?.userName ?? review?.userId ?? 'Utente').trim() || 'Utente';
  }
}


