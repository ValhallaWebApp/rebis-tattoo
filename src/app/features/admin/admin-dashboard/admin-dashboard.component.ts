import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../core/modules/material.module';
import { BookingService } from '../../../core/services/bookings/booking.service';
import { ReviewsService } from '../../../core/services/reviews/rewies.service';
import { ClientService } from '../../../core/services/clients/client.service';

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
quickLinks = [
  {
    title: 'Calendario',
    description: 'Gestione appuntamenti e disponibilità',
    icon: 'calendar_today',
    route: '/admin/calendar'
  },
  {
    title: 'Clienti',
    description: 'Lista completa dei clienti registrati',
    icon: 'groups',
    route: '/admin/clients'
  },
  {
    title: 'Fatturazione',
    description: 'Pagamenti, ricevute e gestione entrate',
    icon: 'receipt_long',
    route: '/admin/billing'
  },
  {
    title: 'Documenti',
    description: 'File allegati, moduli e privacy',
    icon: 'description',
    route: '/admin/documents'
  },
  {
    title: 'Ticket',
    description: 'Ticket e richieste clienti',
    icon: 'chat',
    route: '/admin/ticket'
  },
  {
    title: 'Portfolio',
    description: 'Progetti e tatuaggi completati',
    icon: 'palette',
    route: '/admin/portfolio'
  },
  {
    title: 'Servizi',
    description: 'Gestione dei servizi offerti',
    icon: 'design_services',
    route: '/admin/servizi'
  },
  {
    title: 'Staff',
    description: 'Gestione membri del team e ruoli',
    icon: 'people',
    route: '/admin/staff'
  },
  {
    title: 'Bonus',
    description: 'Codici promo e gift card',
    icon: 'redeem',
    route: '/admin/bonus'
  },
  {
    title: 'Recensioni',
    description: 'Valutazioni e feedback clienti',
    icon: 'star',
    route: '/admin/review-list'
  },
  {
    title: 'Statistiche',
    description: 'Report su entrate, clienti e attività',
    icon: 'insights',
    route: '/admin/analytics'
  }
];

  constructor(
    private bookingService: BookingService,
    private reviewsService: ReviewsService,
    private clientService: ClientService
  ) {}

  ngOnInit(): void {
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
