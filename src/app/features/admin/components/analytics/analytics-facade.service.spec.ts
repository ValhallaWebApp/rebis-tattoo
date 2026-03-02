import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, filter, take } from 'rxjs';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { Client, ClientService } from '../../../../core/services/clients/client.service';
import { Invoice, InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { TattooProject, ProjectsService } from '../../../../core/services/projects/projects.service';
import { Review, ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { AnalyticsFacadeService } from './analytics-facade.service';

describe('AnalyticsFacadeService', () => {
  let service: AnalyticsFacadeService;

  let invoicesSubject: BehaviorSubject<Invoice[]>;
  let bookingsSubject: BehaviorSubject<Booking[]>;
  let reviewsSubject: BehaviorSubject<Review[]>;
  let clientsSubject: BehaviorSubject<Client[]>;
  let projectsSubject: BehaviorSubject<TattooProject[]>;
  let staffSubject: BehaviorSubject<StaffMember[]>;

  beforeEach(() => {
    invoicesSubject = new BehaviorSubject<Invoice[]>([]);
    bookingsSubject = new BehaviorSubject<Booking[]>([]);
    reviewsSubject = new BehaviorSubject<Review[]>([]);
    clientsSubject = new BehaviorSubject<Client[]>([]);
    projectsSubject = new BehaviorSubject<TattooProject[]>([]);
    staffSubject = new BehaviorSubject<StaffMember[]>([]);

    TestBed.configureTestingModule({
      providers: [
        AnalyticsFacadeService,
        { provide: InvoicesService, useValue: { getInvoices: () => invoicesSubject.asObservable() } },
        { provide: BookingService, useValue: { getAllBookings: () => bookingsSubject.asObservable() } },
        { provide: ReviewsService, useValue: { getAllReviews: () => reviewsSubject.asObservable() } },
        { provide: ClientService, useValue: { getClients: () => clientsSubject.asObservable() } },
        { provide: ProjectsService, useValue: { getProjects: () => projectsSubject.asObservable() } },
        { provide: StaffService, useValue: { getAllStaff: () => staffSubject.asObservable() } }
      ]
    });

    service = TestBed.inject(AnalyticsFacadeService);
  });

  it('builds month realtime charts from services', async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    invoicesSubject.next([
      buildInvoice({ id: 'i-paid', status: 'paid', amount: 120, date: nowIso }),
      buildInvoice({ id: 'i-pending', status: 'pending', amount: 999, date: nowIso })
    ]);

    bookingsSubject.next([
      buildBooking({ id: 'b-ok', artistId: 'a-1', start: nowIso, status: 'confirmed' }),
      buildBooking({ id: 'b-cancelled', artistId: 'a-1', start: nowIso, status: 'cancelled' })
    ]);

    reviewsSubject.next([
      buildReview({ id: 'r-ok', rating: 4, status: 'approved', date: nowMs }),
      buildReview({ id: 'r-rejected', rating: 5, status: 'rejected', date: nowMs })
    ]);

    clientsSubject.next([
      { id: 'c-1', role: 'client', createdAt: nowIso },
      { id: 'a-1', role: 'admin', createdAt: nowIso }
    ]);

    projectsSubject.next([
      buildProject({ id: 'p-1', style: 'Realistico', createdAt: nowIso })
    ]);

    staffSubject.next([
      { id: 'a-1', name: 'Luca', role: 'tatuatore' }
    ]);

    const vm = await firstValueFrom(service.vm$.pipe(take(1)));

    expect(sum(vm.revenueData)).toBe(120);
    expect(sum(vm.appointmentData[0]?.series ?? [])).toBe(1);
    expect(vm.reviewStars.find((item) => item.name === '4*')?.value).toBe(1);
    expect(sum(vm.clientGrowth[0]?.series ?? [])).toBe(1);
    expect(vm.tattooTypesData.find((item) => item.name === 'Realistico')?.value).toBe(1);
    expect(vm.appointmentsByArtist.find((item) => item.name === 'Luca')?.value).toBe(1);
    expect(vm.kpis.consultationsCount).toBe(1);
    expect(vm.kpis.cancellationRate).toBe(50);
    expect(vm.kpis.noShowRate).toBe(0);
    expect(vm.kpis.averageTicket).toBe(120);
    expect(vm.kpis.averageReview).toBe(4);
  });

  it('excludes data outside year window', async () => {
    const now = new Date();
    const currentYearIso = new Date(now.getFullYear(), 0, 15).toISOString();
    const oldIso = new Date(now.getFullYear() - 8, 0, 15).toISOString();

    invoicesSubject.next([
      buildInvoice({ id: 'i-current', status: 'paid', amount: 200, date: currentYearIso }),
      buildInvoice({ id: 'i-old', status: 'paid', amount: 400, date: oldIso })
    ]);

    service.setPeriod('year');

    const vm = await firstValueFrom(
      service.vm$.pipe(
        filter((value) => value.period === 'year'),
        take(1)
      )
    );

    expect(sum(vm.revenueData)).toBe(200);
  });

  it('excludes previous month data in month mode', async () => {
    const now = new Date();
    const currentMonthIso = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();
    const previousMonthIso = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString();

    invoicesSubject.next([
      buildInvoice({ id: 'i-this-month', status: 'paid', amount: 50, date: currentMonthIso }),
      buildInvoice({ id: 'i-prev-month', status: 'paid', amount: 90, date: previousMonthIso })
    ]);

    const vm = await firstValueFrom(service.vm$.pipe(take(1)));
    expect(vm.period).toBe('month');
    expect(sum(vm.revenueData)).toBe(50);
  });

  it('exports only selected scopes', async () => {
    const nowIso = new Date().toISOString();
    invoicesSubject.next([buildInvoice({ id: 'i', amount: 10, date: nowIso, status: 'paid' })]);

    const vm = await firstValueFrom(service.vm$.pipe(take(1)));
    const rows = service.buildExcelRows(vm, ['kpis', 'revenue']);
    const flattened = rows.map((row) => String(row[0] ?? ''));

    expect(flattened).toContain('KPI principali');
    expect(flattened.some((value) => value.includes('Fatturato ('))).toBeTrue();
    expect(flattened).not.toContain('Recensioni per stelle');
  });
});

function buildInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'invoice-id',
    bookingId: 'booking-id',
    clientId: 'client-id',
    clientName: 'Cliente',
    date: new Date().toISOString(),
    amount: 0,
    status: 'paid',
    items: [],
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

function buildBooking(overrides: Partial<Booking>): Booking {
  const nowIso = new Date().toISOString();
  return {
    id: 'booking-id',
    clientId: 'client-id',
    artistId: 'artist-id',
    title: 'Consulenza',
    start: nowIso,
    end: nowIso,
    status: 'draft',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides
  };
}

function buildReview(overrides: Partial<Review>): Review {
  return {
    id: 'review-id',
    userId: 'user-id',
    tattooTitle: 'Tattoo',
    comment: 'ok',
    rating: 5,
    status: 'approved',
    date: Date.now(),
    ...overrides
  };
}

function buildProject(overrides: Partial<TattooProject>): TattooProject {
  const nowIso = new Date().toISOString();
  return {
    id: 'project-id',
    title: 'Project',
    artistId: 'artist-id',
    clientId: 'client-id',
    status: 'draft',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides
  };
}

function sum(data: Array<{ value: number }>): number {
  return data.reduce((acc, item) => acc + Number(item.value ?? 0), 0);
}
