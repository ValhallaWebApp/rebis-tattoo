import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import * as XLSX from 'xlsx';
import { MaterialModule } from '../../../../core/modules/material.module';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { ClientService } from '../../../../core/services/clients/client.service';

interface Color {
  name: string;
  selectable: boolean;
  group: string;
  domain: string[];
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, MaterialModule, NgxChartsModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {
  // View dinamica: larghezza automatica, altezza fissa
  view: [any, number] = [undefined, 320];

 colorScheme: string = 'vivid';


tattooTypesData = [
  { name: 'Realistico', value: 20 },
  { name: 'Minimal', value: 15 },
  { name: 'Old School', value: 10 },
  { name: 'Tribale', value: 12 },
  { name: 'Geometrico', value: 8 }
];

appointmentsByArtist = [
  { name: 'Luca', value: 28 },
  { name: 'Sara', value: 33 },
  { name: 'Marta', value: 25 },
  { name: 'Guest Artist', value: 12 }
];


  // Dataset per i grafici
  revenueData: any[] = [];
  appointmentData: any[] = [];
  reviewStars: any[] = [];
  clientGrowth: any[] = [];

  // Esempio statico (può essere reso dinamico)
  tattooStyles: any[] = [
    { name: 'Realistico', value: 30 },
    { name: 'Geometrico', value: 25 },
    { name: 'Minimal', value: 15 },
    { name: 'Old School', value: 10 },
    { name: 'Tribale', value: 20 }
  ];

  constructor(
    private bookingService: BookingService,
    private invoiceService: InvoicesService,
    private reviewService: ReviewsService,
    private clientService: ClientService
  ) {}

  ngOnInit(): void {
    this.loadRevenue();
    this.loadAppointments();
    this.loadReviews();
    this.loadClientGrowth();
  }

  // ==== Fatturato mensile ====
  loadRevenue(): void {
    this.invoiceService.getInvoices().subscribe(invoices => {
      const grouped = invoices.reduce((acc, invoice) => {
        const month = new Date(invoice.date).toLocaleString('it-IT', { month: 'short' });
        acc[month] = (acc[month] || 0) + invoice.amount;
        return acc;
      }, {} as { [key: string]: number });

      this.revenueData = Object.entries(grouped).map(([name, value]) => ({ name, value }));
    });
  }

  // ==== Appuntamenti mensili ====
  loadAppointments(): void {
    this.bookingService.getAllBookings().subscribe(bookings => {
      const grouped = bookings.reduce((acc, b) => {
        const month = new Date(b.start).toLocaleString('it-IT', { month: 'short' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      this.appointmentData = [{
        name: 'Appuntamenti',
        series: Object.entries(grouped).map(([name, value]) => ({ name, value }))
      }];
    });
  }

  // ==== Recensioni per stelle ====
  loadReviews(): void {
    this.reviewService.getAllReviews().subscribe(reviews => {
      this.reviewStars = [1, 2, 3, 4, 5].map(star => ({
        name: `${star}⭐`,
        value: reviews.filter(r => r.rating === star).length
      }));
    });
  }

  // ==== Crescita clienti ====
  loadClientGrowth(): void {
    this.clientService.getClients().subscribe(clients => {
      const grouped = clients.reduce((acc, client) => {
        if (client.createdAt?.seconds) {
          const date = new Date(client.createdAt.seconds * 1000);
          const month = date.toLocaleString('it-IT', { month: 'short' });
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as { [key: string]: number });

      this.clientGrowth = [{
        name: 'Crescita Clienti',
        series: Object.entries(grouped).map(([name, value]) => ({ name, value }))
      }];
    });
  }

  // ==== Esportazione Excel ====
  exportToExcel(): void {
    const allData = [
      { title: 'Fatturato', data: this.revenueData },
      { title: 'Stili di Tatuaggio', data: this.tattooStyles },
      { title: 'Appuntamenti Mensili', data: this.appointmentData[0]?.series || [] },
      { title: 'Recensioni per Stelle', data: this.reviewStars },
      { title: 'Crescita Clienti', data: this.clientGrowth[0]?.series || [] }
    ];

    const excelData: unknown[][] = [];

    allData.forEach(section => {
      excelData.push([section.title]);
      section.data.forEach((item: any) => {
        excelData.push([item.name, item.value]);
      });
      excelData.push([]);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(excelData);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
    XLSX.writeFile(wb, 'analytics-rebis.xlsx');
  }

  // ==== Periodo (placeholder se vuoi filtri futuri) ====
  onPeriodChange(event: any): void {
    const selected = event.value;
    console.log('Periodo selezionato:', selected);
    // Implementa filtri su richiesta
  }
}
