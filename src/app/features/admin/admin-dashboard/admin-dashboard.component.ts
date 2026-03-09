import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../core/modules/material.module';
import { BookingService } from '../../../core/services/bookings/booking.service';
import { Review, ReviewsService } from '../../../core/services/reviews/reviews.service';
import { ClientService } from '../../../core/services/clients/client.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { StatusHelperService } from '../../../core/services/helpers/status-helper.service';
import { EventsService, StudioEventOccurrence } from '../../../core/services/events/events.service';
import { AdminSectionsVisibilityService } from '../../../core/services/menu/admin-sections-visibility.service';
import { LanguageService } from '../../../core/services/language/language.service';

type QuickLink = {
  title: string;
  description: string;
  titleKey?: string;
  descriptionKey?: string;
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
  private readonly eventsService = inject(EventsService);
  private readonly auth = inject(AuthService);
  private readonly status = inject(StatusHelperService);
  private readonly sectionsVisibility = inject(AdminSectionsVisibilityService);
  readonly lang = inject(LanguageService);

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
  canAccessMessaging = false;
  canAccessEvents = false;
  upcomingEvents: StudioEventOccurrence[] = [];

  private readonly allQuickLinks: QuickLink[] = [
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.calendar.title',
      descriptionKey: 'adminDashboard.quickLinks.calendar.description',
      icon: 'calendar_today',
      route: 'calendar',
      showForStaff: true,
      requiredPermission: 'canManageBookings'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.users.title',
      descriptionKey: 'adminDashboard.quickLinks.users.description',
      icon: 'groups',
      route: 'users',
      showForStaff: true,
      requiresRoleManagement: true
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.permissions.title',
      descriptionKey: 'adminDashboard.quickLinks.permissions.description',
      icon: 'admin_panel_settings',
      route: 'permissions'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.clients.title',
      descriptionKey: 'adminDashboard.quickLinks.clients.description',
      icon: 'person_search',
      route: 'clients',
      showForStaff: true,
      requiresRoleManagement: true
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.staff.title',
      descriptionKey: 'adminDashboard.quickLinks.staff.description',
      icon: 'badge',
      route: 'staff',
      requiresRoleManagement: true
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.settings.title',
      descriptionKey: 'adminDashboard.quickLinks.settings.description',
      icon: 'settings',
      route: 'settings'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.reviews.title',
      descriptionKey: 'adminDashboard.quickLinks.reviews.description',
      icon: 'rate_review',
      route: 'reviews'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.portfolio.title',
      descriptionKey: 'adminDashboard.quickLinks.portfolio.description',
      icon: 'palette',
      route: 'portfolio',
      showForStaff: true,
      requiredPermission: 'canManageProjects'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.messaging.title',
      descriptionKey: 'adminDashboard.quickLinks.messaging.description',
      icon: 'forum',
      route: 'messaging',
      showForStaff: true,
      requiredPermission: 'canManageMessages'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.events.title',
      descriptionKey: 'adminDashboard.quickLinks.events.description',
      icon: 'celebration',
      route: 'eventi',
      showForStaff: true,
      requiredPermission: 'canManageEvents'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.billing.title',
      descriptionKey: 'adminDashboard.quickLinks.billing.description',
      icon: 'payments',
      route: 'billing'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.bonus.title',
      descriptionKey: 'adminDashboard.quickLinks.bonus.description',
      icon: 'redeem',
      route: 'bonus'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.documents.title',
      descriptionKey: 'adminDashboard.quickLinks.documents.description',
      icon: 'description',
      route: 'documents'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.waitlist.title',
      descriptionKey: 'adminDashboard.quickLinks.waitlist.description',
      icon: 'schedule_send',
      route: 'waitlist'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.analytics.title',
      descriptionKey: 'adminDashboard.quickLinks.analytics.description',
      icon: 'monitoring',
      route: 'analytics'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.auditLogs.title',
      descriptionKey: 'adminDashboard.quickLinks.auditLogs.description',
      icon: 'history',
      route: 'audit-logs'
    },
    {
      title: '',
      description: '',
      titleKey: 'adminDashboard.quickLinks.sectionsVisibility.title',
      descriptionKey: 'adminDashboard.quickLinks.sectionsVisibility.description',
      icon: 'tune',
      route: 'sections-visibility'
    }
  ];

  ngOnInit(): void {
    const user = this.auth.userSig();
    const isStaff = user?.role === 'staff';
    const canManageRoles = this.auth.canManageRoles(user);
    this.canAccessMessaging = !!user && (user.role === 'admin' || user.permissions?.canManageMessages === true);
    this.canAccessEvents = !!user && (user.role === 'admin' || user.permissions?.canManageEvents === true);
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
      .filter(link => !isStaff || this.sectionsVisibility.isVisible(`/staff/${link.route}`))
      .filter(link => isStaff || link.route === 'sections-visibility' || this.sectionsVisibility.isVisible(`/admin/${link.route}`))
      .map(link => ({
        ...link,
        title: link.titleKey ? this.t(link.titleKey) : link.title,
        description: link.descriptionKey ? this.t(link.descriptionKey) : link.description,
        route: `${basePath}/${link.route}`
      }));

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

    this.eventsService.getPublicTimeline().subscribe((timeline) => {
      const now = Date.now();
      this.upcomingEvents = (timeline ?? [])
        .filter((event) => this.eventStartsAt(event) >= now)
        .slice(0, 6);
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

  canViewSection(sectionKey: string): boolean {
    return this.sectionsVisibility.isVisible(`${this.backofficeBase}/${sectionKey}`);
  }

  t(path: string): string {
    return this.lang.t(path);
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

  eventKindLabel(type: unknown): string {
    return String(type) === 'guest' ? 'Guest Spot' : 'Open Day';
  }

  eventDateLabel(event: StudioEventOccurrence): string {
    const start = this.formatDate(event.startDate);
    if (!event.endDate || event.endDate === event.startDate) return start;
    return `${start} - ${this.formatDate(event.endDate)}`;
  }

  eventTimeLabel(event: StudioEventOccurrence): string {
    if (!event.startTime && !event.endTime) return 'Orario da definire';
    if (!event.endTime) return event.startTime;
    return `${event.startTime} - ${event.endTime}`;
  }

  private eventStartsAt(event: StudioEventOccurrence): number {
    const time = String(event.startTime ?? '').trim() || '00:00';
    const date = new Date(`${event.startDate}T${time}:00`);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  private formatDate(ymd: string): string {
    const d = new Date(`${ymd}T12:00:00`);
    if (!Number.isFinite(d.getTime())) return ymd;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}


