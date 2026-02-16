import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../core/modules/material.module';
import { BookingService } from '../../../core/services/bookings/booking.service';
import { ReviewsService } from '../../../core/services/reviews/rewies.service';
import { ClientService } from '../../../core/services/clients/client.service';
import { AuthService } from '../../../core/services/auth/authservice';

type QuickLink = {
  title: string;
  description: string;
  icon: string;
  route: string;
  showForStaff?: boolean;
  requiresRoleManagement?: boolean;
  requiredPermission?: 'canManageBookings' | 'canManageProjects' | 'canManageSessions';
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, MaterialModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  todayAppointments: any[] = [];
  latestReviews: any[] = [];
  totalClients = 0;
  totalRevenue = 0;
  quickLinks: QuickLink[] = [];

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
      title: 'Clienti',
      description: 'Lista completa dei clienti registrati',
      icon: 'groups',
      route: 'clients',
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
      title: 'Portfolio',
      description: 'Progetti e tatuaggi completati',
      icon: 'palette',
      route: 'portfolio',
      showForStaff: true,
      requiredPermission: 'canManageProjects'
    },
    {
      title: 'Staff',
      description: 'Gestione membri del team e ruoli',
      icon: 'people',
      route: 'staff'
    }
  ];

  constructor(
    private bookingService: BookingService,
    private reviewsService: ReviewsService,
    private clientService: ClientService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.auth.userSig();
    const isStaff = user?.role === 'staff';
    const canManageRoles = this.auth.canManageRoles(user);
    const canManageBookings = user?.permissions?.canManageBookings === true;
    const canManageProjects = user?.permissions?.canManageProjects === true;
    const canManageSessions = user?.permissions?.canManageSessions === true;
    const basePath = isStaff ? '/staff' : '/admin';

    this.quickLinks = this.allQuickLinks
      .filter(link => !isStaff || link.showForStaff === true)
      .filter(link => !link.requiresRoleManagement || canManageRoles)
      .filter(link => {
        if (!isStaff) return true;
        if (!link.requiredPermission) return true;
        if (link.requiredPermission === 'canManageBookings') return canManageBookings;
        if (link.requiredPermission === 'canManageProjects') return canManageProjects;
        if (link.requiredPermission === 'canManageSessions') return canManageSessions;
        return true;
      })
      .map(link => ({ ...link, route: `${basePath}/${link.route}` }));

    const today = new Date();
    this.bookingService.getBookingsByDate(today).subscribe(bookings => {
      this.todayAppointments = bookings || [];
    });

    this.reviewsService.getRecentReviews(5).subscribe((reviews: any[]) => {
      this.latestReviews = reviews || [];
    });

    this.clientService.getClients().subscribe(clients => {
      this.totalClients = clients.length;
    });

    this.bookingService.getTotalRevenueThisMonth().subscribe(value => {
      this.totalRevenue = value;
    });
  }
}
