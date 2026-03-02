import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay } from 'rxjs';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { Client, ClientService } from '../../../../core/services/clients/client.service';
import { Invoice, InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { TattooProject, ProjectsService } from '../../../../core/services/projects/projects.service';
import { Review, ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';

export type AnalyticsPeriod = 'month' | 'trimester' | 'quadrimester' | 'semester' | 'year';

export interface ChartDatum {
  name: string;
  value: number;
}

export interface MultiSeriesDatum {
  name: string;
  series: ChartDatum[];
}

export interface AnalyticsKpis {
  totalRevenue: number;
  consultationsCount: number;
  averageTicket: number;
  noShowRate: number;
  cancellationRate: number;
  averageReview: number;
  approvedReviews: number;
  averageWaitHours: number;
}

export type AnalyticsExportScope =
  | 'kpis'
  | 'revenue'
  | 'bookings'
  | 'clients'
  | 'styles'
  | 'artists'
  | 'utilization'
  | 'operations'
  | 'reviews';

export interface AnalyticsViewModel {
  period: AnalyticsPeriod;
  revenueData: ChartDatum[];
  appointmentData: MultiSeriesDatum[];
  reviewStars: ChartDatum[];
  clientGrowth: MultiSeriesDatum[];
  tattooTypesData: ChartDatum[];
  appointmentsByArtist: ChartDatum[];
  artistUtilizationData: ChartDatum[];
  statusRatesData: ChartDatum[];
  kpis: AnalyticsKpis;
}

export const EMPTY_ANALYTICS_VIEW_MODEL: AnalyticsViewModel = {
  period: 'month',
  revenueData: [],
  appointmentData: [{ name: 'Consulenze', series: [] }],
  reviewStars: [
    { name: '1*', value: 0 },
    { name: '2*', value: 0 },
    { name: '3*', value: 0 },
    { name: '4*', value: 0 },
    { name: '5*', value: 0 }
  ],
  clientGrowth: [{ name: 'Crescita Clienti', series: [] }],
  tattooTypesData: [],
  appointmentsByArtist: [],
  artistUtilizationData: [],
  statusRatesData: [
    { name: 'No-show %', value: 0 },
    { name: 'Cancellazioni %', value: 0 }
  ],
  kpis: {
    totalRevenue: 0,
    consultationsCount: 0,
    averageTicket: 0,
    noShowRate: 0,
    cancellationRate: 0,
    averageReview: 0,
    approvedReviews: 0,
    averageWaitHours: 0
  }
};

export const DEFAULT_EXPORT_SCOPES: ReadonlyArray<AnalyticsExportScope> = [
  'kpis',
  'revenue',
  'bookings',
  'clients',
  'styles',
  'artists',
  'utilization',
  'operations',
  'reviews'
];

interface PeriodBuckets {
  keys: string[];
  labelsByKey: Record<string, string>;
  start: Date;
  endExclusive: Date;
  mode: 'day' | 'month';
}

@Injectable({ providedIn: 'root' })
export class AnalyticsFacadeService {
  private readonly periodSubject = new BehaviorSubject<AnalyticsPeriod>('month');
  readonly period$: Observable<AnalyticsPeriod> = this.periodSubject.asObservable();

  readonly vm$: Observable<AnalyticsViewModel>;

  constructor(
    private readonly bookings: BookingService,
    private readonly invoices: InvoicesService,
    private readonly reviews: ReviewsService,
    private readonly clients: ClientService,
    private readonly projects: ProjectsService,
    private readonly staff: StaffService
  ) {
    this.vm$ = combineLatest([
      this.period$,
      this.invoices.getInvoices(),
      this.bookings.getAllBookings(),
      this.reviews.getAllReviews(),
      this.clients.getClients(),
      this.projects.getProjects(),
      this.staff.getAllStaff()
    ]).pipe(
      map(([period, invoices, bookings, reviews, clients, projects, staff]) =>
        this.buildViewModel(period, invoices, bookings, reviews, clients, projects, staff)
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  setPeriod(period: AnalyticsPeriod): void {
    this.periodSubject.next(period);
  }

  buildExcelRows(
    vm: AnalyticsViewModel,
    selectedScopes: ReadonlyArray<AnalyticsExportScope> = DEFAULT_EXPORT_SCOPES
  ): unknown[][] {
    const periodLabel = this.getPeriodLabel(vm.period).toLowerCase();
    const scopes = new Set<AnalyticsExportScope>((selectedScopes?.length ? selectedScopes : DEFAULT_EXPORT_SCOPES));
    const rows: unknown[][] = [];

    if (scopes.has('kpis')) {
      rows.push(['KPI principali']);
      rows.push(['Indicatore', 'Valore']);
      rows.push(['Fatturato totale', this.roundTo2(vm.kpis.totalRevenue)]);
      rows.push(['Consulenze', vm.kpis.consultationsCount]);
      rows.push(['Ticket medio', this.roundTo2(vm.kpis.averageTicket)]);
      rows.push(['No-show %', this.roundTo2(vm.kpis.noShowRate)]);
      rows.push(['Cancellazioni %', this.roundTo2(vm.kpis.cancellationRate)]);
      rows.push(['Media recensioni', this.roundTo2(vm.kpis.averageReview)]);
      rows.push(['Recensioni approvate', vm.kpis.approvedReviews]);
      rows.push(['Attesa media (ore)', this.roundTo2(vm.kpis.averageWaitHours)]);
      rows.push([]);
    }

    const sections: Array<{ title: string; data: ChartDatum[] }> = [
      { title: `Fatturato (${periodLabel})`, data: vm.revenueData },
      { title: `Consulenze (${periodLabel})`, data: vm.appointmentData[0]?.series ?? [] },
      { title: 'Crescita clienti', data: vm.clientGrowth[0]?.series ?? [] },
      { title: 'Top stili tattoo', data: vm.tattooTypesData },
      { title: 'Consulenze per artista', data: vm.appointmentsByArtist },
      { title: 'Utilizzo artisti %', data: vm.artistUtilizationData },
      { title: 'Tassi operativi %', data: vm.statusRatesData },
      { title: 'Recensioni per stelle', data: vm.reviewStars }
    ];

    const sectionScopes: AnalyticsExportScope[] = [
      'revenue',
      'bookings',
      'clients',
      'styles',
      'artists',
      'utilization',
      'operations',
      'reviews'
    ];

    for (let index = 0; index < sections.length; index += 1) {
      if (!scopes.has(sectionScopes[index])) continue;
      const section = sections[index];
      rows.push([section.title]);
      rows.push(['Nome', 'Valore']);
      for (const item of section.data) {
        rows.push([item.name, item.value]);
      }
      rows.push([]);
    }

    return rows;
  }

  private buildViewModel(
    period: AnalyticsPeriod,
    invoices: Invoice[],
    bookings: Booking[],
    reviews: Review[],
    clients: Client[],
    projects: TattooProject[],
    staff: StaffMember[]
  ): AnalyticsViewModel {
    const buckets = this.buildBuckets(period, new Date());

    const bookingsInRange = this.filterBookingsInRange(bookings, buckets);
    const consultations = bookingsInRange.filter((booking) => !this.isBlockedStatus(booking.status));

    const approvedReviewsInRange = (reviews ?? [])
      .filter((review) => String(review.status ?? '').toLowerCase() === 'approved')
      .filter((review) => {
        const date = this.parseDateLike(review.date);
        return !!date && this.isWithinRange(date, buckets);
      });

    const paidInvoicesInRange = (invoices ?? [])
      .filter((invoice) => String(invoice.status ?? '').toLowerCase() === 'paid')
      .filter((invoice) => {
        const date = this.parseDateLike(invoice.date ?? invoice.createdAt);
        return !!date && this.isWithinRange(date, buckets);
      });

    const revenue = this.buildRevenueData(paidInvoicesInRange, buckets);
    const appointmentsSeries = this.buildAppointmentSeries(consultations, buckets);
    const reviewsByStars = this.buildReviewsData(approvedReviewsInRange);
    const clientGrowthSeries = this.buildClientGrowthData(clients, buckets);
    const tattooTypes = this.buildTattooTypesData(projects, buckets);
    const byArtist = this.buildAppointmentsByArtist(consultations, staff);
    const utilization = this.buildArtistUtilization(consultations, staff, buckets);

    const denominator = bookingsInRange.filter((booking) => String(booking.status ?? '').toLowerCase() !== 'draft').length;
    const noShowCount = bookingsInRange.filter((booking) => String(booking.status ?? '').toLowerCase() === 'no_show').length;
    const cancelledCount = bookingsInRange.filter((booking) => String(booking.status ?? '').toLowerCase() === 'cancelled').length;
    const noShowRate = denominator > 0 ? (noShowCount / denominator) * 100 : 0;
    const cancellationRate = denominator > 0 ? (cancelledCount / denominator) * 100 : 0;

    const totalRevenue = paidInvoicesInRange.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const averageTicket = paidInvoicesInRange.length > 0 ? totalRevenue / paidInvoicesInRange.length : 0;

    const averageReview = approvedReviewsInRange.length > 0
      ? approvedReviewsInRange.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / approvedReviewsInRange.length
      : 0;

    const averageWaitHours = this.computeAverageWaitHours(consultations);

    return {
      period,
      revenueData: revenue,
      appointmentData: [{ name: 'Consulenze', series: appointmentsSeries }],
      reviewStars: reviewsByStars,
      clientGrowth: [{ name: 'Crescita Clienti', series: clientGrowthSeries }],
      tattooTypesData: tattooTypes,
      appointmentsByArtist: byArtist,
      artistUtilizationData: utilization,
      statusRatesData: [
        { name: 'No-show %', value: this.roundTo2(noShowRate) },
        { name: 'Cancellazioni %', value: this.roundTo2(cancellationRate) }
      ],
      kpis: {
        totalRevenue: this.roundTo2(totalRevenue),
        consultationsCount: consultations.length,
        averageTicket: this.roundTo2(averageTicket),
        noShowRate: this.roundTo2(noShowRate),
        cancellationRate: this.roundTo2(cancellationRate),
        averageReview: this.roundTo2(averageReview),
        approvedReviews: approvedReviewsInRange.length,
        averageWaitHours: this.roundTo2(averageWaitHours)
      }
    };
  }

  private buildRevenueData(invoices: Invoice[], buckets: PeriodBuckets): ChartDatum[] {
    const totals = this.seedTotals(buckets.keys);
    for (const invoice of invoices ?? []) {
      const amount = Number(invoice.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const date = this.parseDateLike(invoice.date ?? invoice.createdAt);
      if (!date || !this.isWithinRange(date, buckets)) continue;
      const key = this.bucketKeyForDate(date, buckets);
      if (!key || !(key in totals)) continue;
      totals[key] += amount;
    }
    return buckets.keys.map((key) => ({ name: buckets.labelsByKey[key], value: this.roundTo2(totals[key]) }));
  }

  private buildAppointmentSeries(bookings: Booking[], buckets: PeriodBuckets): ChartDatum[] {
    const totals = this.seedTotals(buckets.keys);
    for (const booking of bookings ?? []) {
      const date = this.parseDateLike(booking.start);
      if (!date || !this.isWithinRange(date, buckets)) continue;
      const key = this.bucketKeyForDate(date, buckets);
      if (!key || !(key in totals)) continue;
      totals[key] += 1;
    }
    return buckets.keys.map((key) => ({ name: buckets.labelsByKey[key], value: totals[key] }));
  }

  private buildReviewsData(reviews: Review[]): ChartDatum[] {
    const counters: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of reviews ?? []) {
      const rating = Number(review.rating);
      if (!Number.isFinite(rating)) continue;
      const normalized = Math.min(5, Math.max(1, Math.round(rating)));
      counters[normalized] += 1;
    }
    return [1, 2, 3, 4, 5].map((star) => ({ name: `${star}*`, value: counters[star] }));
  }

  private buildClientGrowthData(clients: Client[], buckets: PeriodBuckets): ChartDatum[] {
    const totals = this.seedTotals(buckets.keys);
    for (const client of clients ?? []) {
      if (!this.isClientRole(client.role)) continue;
      const date = this.parseDateLike(client.createdAt);
      if (!date || !this.isWithinRange(date, buckets)) continue;
      const key = this.bucketKeyForDate(date, buckets);
      if (!key || !(key in totals)) continue;
      totals[key] += 1;
    }
    return buckets.keys.map((key) => ({ name: buckets.labelsByKey[key], value: totals[key] }));
  }

  private buildTattooTypesData(projects: TattooProject[], buckets: PeriodBuckets): ChartDatum[] {
    const totals = new Map<string, number>();
    for (const project of projects ?? []) {
      const style = this.normalizeStyle(project.style ?? project.genere ?? project.subject);
      if (!style) continue;

      const date = this.parseDateLike(project.createdAt);
      if (!date || !this.isWithinRange(date, buckets)) continue;

      totals.set(style, (totals.get(style) ?? 0) + 1);
    }

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  private buildAppointmentsByArtist(bookings: Booking[], staff: StaffMember[]): ChartDatum[] {
    const staffNameById = new Map<string, string>(
      (staff ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => [String(item.id), String(item.name)])
    );

    const totals = new Map<string, number>();
    for (const booking of bookings ?? []) {
      const artistId = String(booking.artistId ?? '').trim();
      if (!artistId) continue;
      const artistName = staffNameById.get(artistId) ?? `Artista ${artistId.slice(0, 6)}`;
      totals.set(artistName, (totals.get(artistName) ?? 0) + 1);
    }

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  private buildArtistUtilization(bookings: Booking[], staff: StaffMember[], buckets: PeriodBuckets): ChartDatum[] {
    const durationByArtist = new Map<string, number>();

    for (const booking of bookings ?? []) {
      const artistId = String(booking.artistId ?? '').trim();
      if (!artistId) continue;
      const start = this.parseDateLike(booking.start);
      const end = this.parseDateLike(booking.end);
      if (!start) continue;
      const durationHours = end && end > start ? (end.getTime() - start.getTime()) / 3600000 : 1;
      durationByArtist.set(artistId, (durationByArtist.get(artistId) ?? 0) + Math.max(durationHours, 0));
    }

    const daysInRange = Math.max(1, this.daysBetween(buckets.start, buckets.endExclusive));
    const rows: ChartDatum[] = [];

    for (const member of staff ?? []) {
      const artistId = String(member.id ?? '').trim();
      if (!artistId) continue;
      const bookedHours = durationByArtist.get(artistId) ?? 0;
      const availableHours = this.estimateAvailableHours(member, daysInRange);
      const ratio = availableHours > 0 ? (bookedHours / availableHours) * 100 : 0;
      rows.push({
        name: String(member.name ?? `Artista ${artistId.slice(0, 6)}`),
        value: this.roundTo2(Math.min(Math.max(ratio, 0), 100))
      });
    }

    return rows.sort((a, b) => b.value - a.value);
  }

  private estimateAvailableHours(member: StaffMember, daysInRange: number): number {
    const start = this.parseHourMinute(member.calendar?.workdayStart ?? '09:00');
    const end = this.parseHourMinute(member.calendar?.workdayEnd ?? '18:00');
    const diff = Math.max(end - start, 1);
    return diff * daysInRange;
  }

  private parseHourMinute(input: string): number {
    const parts = String(input ?? '').split(':');
    const hh = Number(parts[0] ?? 0);
    const mm = Number(parts[1] ?? 0);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    return hh + mm / 60;
  }

  private daysBetween(start: Date, endExclusive: Date): number {
    return Math.ceil((endExclusive.getTime() - start.getTime()) / 86400000);
  }

  private filterBookingsInRange(bookings: Booking[], buckets: PeriodBuckets): Booking[] {
    return (bookings ?? []).filter((booking) => {
      const date = this.parseDateLike(booking.start);
      return !!date && this.isWithinRange(date, buckets);
    });
  }

  private isBlockedStatus(status: unknown): boolean {
    const normalized = String(status ?? '').toLowerCase();
    return normalized === 'cancelled' || normalized === 'no_show';
  }

  private computeAverageWaitHours(bookings: Booking[]): number {
    let total = 0;
    let count = 0;

    for (const booking of bookings ?? []) {
      const createdAt = this.parseDateLike(booking.createdAt);
      const start = this.parseDateLike(booking.start);
      if (!createdAt || !start) continue;
      if (start <= createdAt) continue;
      total += (start.getTime() - createdAt.getTime()) / 3600000;
      count += 1;
    }

    return count > 0 ? total / count : 0;
  }

  private buildBuckets(period: AnalyticsPeriod, now: Date): PeriodBuckets {
    switch (period) {
      case 'trimester':
        return this.buildRollingMonthBuckets(now, 3);
      case 'quadrimester':
        return this.buildRollingMonthBuckets(now, 4);
      case 'semester':
        return this.buildRollingMonthBuckets(now, 6);
      case 'year':
        return this.buildRollingMonthBuckets(now, 12);
      case 'month':
      default:
        return this.buildCurrentMonthDailyBuckets(now);
    }
  }

  private buildCurrentMonthDailyBuckets(now: Date): PeriodBuckets {
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1);
    const endExclusive = new Date(year, month + 1, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const keys: string[] = [];
    const labelsByKey: Record<string, string> = {};
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cursor = new Date(year, month, day);
      const key = this.dayKey(cursor);
      keys.push(key);
      labelsByKey[key] = this.formatDayLabel(cursor);
    }
    return {
      keys,
      labelsByKey,
      start,
      endExclusive,
      mode: 'day'
    };
  }

  private buildRollingMonthBuckets(now: Date, months: number): PeriodBuckets {
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const start = new Date(endExclusive.getFullYear(), endExclusive.getMonth() - months, 1);
    const keys: string[] = [];
    const labelsByKey: Record<string, string> = {};
    for (let index = 0; index < months; index += 1) {
      const cursor = new Date(start.getFullYear(), start.getMonth() + index, 1);
      const key = this.monthKey(cursor);
      keys.push(key);
      labelsByKey[key] = this.formatMonthLabel(cursor);
    }
    return {
      keys,
      labelsByKey,
      start,
      endExclusive,
      mode: 'month'
    };
  }

  private seedTotals(keys: string[]): Record<string, number> {
    return keys.reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
  }

  private bucketKeyForDate(date: Date, buckets: PeriodBuckets): string {
    return buckets.mode === 'day' ? this.dayKey(date) : this.monthKey(date);
  }

  private monthKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private dayKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private formatMonthLabel(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' }).format(date);
  }

  private formatDayLabel(date: Date): string {
    return String(date.getDate());
  }

  private isWithinRange(date: Date, buckets: PeriodBuckets): boolean {
    return date >= buckets.start && date < buckets.endExclusive;
  }

  private parseDateLike(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (typeof value === 'number') {
      const ms = value > 1_000_000_000_000 ? value : value * 1000;
      const fromNumber = new Date(ms);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return null;
      const normalized = text.includes('T') ? text : text.replace(' ', 'T');
      const fromString = new Date(normalized);
      return Number.isNaN(fromString.getTime()) ? null : fromString;
    }

    if (typeof value === 'object') {
      const maybeTimestamp = value as { seconds?: unknown; toDate?: unknown };
      if (typeof maybeTimestamp.seconds === 'number') {
        const fromSeconds = new Date(maybeTimestamp.seconds * 1000);
        return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
      }
      if (typeof maybeTimestamp.toDate === 'function') {
        const fromMethod = (maybeTimestamp.toDate as () => Date)();
        return Number.isNaN(fromMethod.getTime()) ? null : fromMethod;
      }
    }

    return null;
  }

  private normalizeStyle(value: unknown): string | null {
    const style = String(value ?? '').trim();
    return style ? style : null;
  }

  private isClientRole(role: unknown): boolean {
    const normalized = String(role ?? '').trim().toLowerCase();
    return normalized === '' || normalized === 'client' || normalized === 'user' || normalized === 'cliente';
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getPeriodLabel(period: AnalyticsPeriod): string {
    switch (period) {
      case 'month':
        return 'Mese';
      case 'trimester':
        return 'Trimestre';
      case 'quadrimester':
        return 'Quadrimestre';
      case 'semester':
        return 'Semestre';
      case 'year':
        return 'Anno';
      default:
        return 'Periodo';
    }
  }
}
