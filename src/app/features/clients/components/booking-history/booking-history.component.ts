import { Component, OnInit, inject, effect, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { Session, SessionService } from '../../../../core/services/session/session.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { Router } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, of, shareReplay, startWith, switchMap, take, timeout } from 'rxjs';
import { ReviewCreateDialogComponent } from '../../../../shared/components/dialogs/review-create-dialog/review-create-dialog.component';
import { InvoicesService } from '../../../../core/services/invoices/invoices.service';
import { ExternalActionsHelperService } from '../../../../core/services/helpers/external-actions-helper.service';
import { AppointmentDetailsDialogComponent } from '../../../../shared/components/dialogs/appointment-details-dialog/appointment-details-dialog.component';
import { BookingHistoryInvoiceHelperService } from '../../../../core/services/helpers/booking-history-invoice-helper.service';
import { StatusHelperService } from '../../../../core/services/helpers/status-helper.service';
import { ArtistDetailsDialogComponent } from '../../../../shared/components/dialogs/artist-details-dialog/artist-details-dialog.component';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  styleUrls: ['./booking-history.component.scss'],
  templateUrl: './booking-history.component.html',
  animations: [
    trigger('slideFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(8px)' }))
      ])
    ])
  ]
})
export class BookingHistoryComponent implements OnInit {
  // services
  private readonly auth = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly staffService = inject(StaffService);
  private readonly projectsService = inject(ProjectsService);
  private readonly snackbar = inject(UiFeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly reviewsService = inject(ReviewsService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly invoicesService = inject(InvoicesService);
  private readonly externalActions = inject(ExternalActionsHelperService);
  private readonly sessionService = inject(SessionService);
  private readonly bookingInvoiceHelper = inject(BookingHistoryInvoiceHelperService);
  private readonly statusHelper = inject(StatusHelperService);

  readonly WHATSAPP_NUMBER = '393333333333';

  selectedView: 'active' | 'history' | 'cancelled' = 'active';
  selectedKindFilter: 'all' | 'consultation' | 'session' = 'all';

  // data state
  user: any;
  bookings: Booking[] = [];

  nextBooking: Booking | null = null;
  otherUpcomingBookings: Booking[] = [];

  historyBookings: Booking[] = [];
  cancelledBookings: Booking[] = [];

  // maps
  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};
  artistDetailsMap: Record<string, StaffMember> = {};
  reviewMap: Record<string, any> = {};
  sessionsByBookingId: Record<string, Session[]> = {};
  sessionsByProjectId: Record<string, Session[]> = {};
  projectMap: Record<string, TattooProject> = {};

  // ===========
  // LOAD (no service changes)
  // ===========
  private readonly loadEffect = effect((onCleanup) => {
    const currentUser = this.auth.userSig();
    if (!currentUser?.uid) return;

    this.user = currentUser;
    const role = String((currentUser as any)?.role ?? '').toLowerCase();
    const bookings$ = this.bookingService
      .getBookingsByClient(currentUser.uid)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    const sessions$ = bookings$.pipe(
      switchMap((bookings) => {
        if (role === 'admin' || role === 'staff') return this.sessionService.getAll();
        const bookingIds = (bookings ?? [])
          .map(b => this.getBookingId(b))
          .filter(Boolean);
        const projectIds = (bookings ?? [])
          .map(b => this.getProjectId(b))
          .filter(Boolean);
        return this.sessionService.getSessionsByClientWithBookingFallback(String(currentUser.uid), bookingIds, projectIds);
      }),
      startWith([] as Session[])
    );

    const sub = combineLatest([
      this.staffService.getAllStaff(),
      this.reviewsService.getReviewsByUser(currentUser.uid),
      this.projectsService.getProjectsByClient(currentUser.uid).pipe(catchError(() => of([] as TattooProject[]))),
      bookings$,
      sessions$.pipe(catchError(() => of([] as Session[])))
    ]).subscribe(([staff, reviews, projects, bookings, sessions]) => {
      // staff maps
      const aMap: Record<string, string> = {};
      const pMap: Record<string, string> = {};
      for (const a of (staff ?? []) as any[]) {
        if (!a?.id) continue;
        aMap[a.id] = a.name ?? '';
        pMap[a.id] = a.photoUrl ?? '';
      }
      this.artistMap = aMap;
      this.artistPhotoMap = pMap;
      this.artistDetailsMap = Object.fromEntries(
        ((staff ?? []) as StaffMember[])
          .filter((artist) => !!artist?.id)
          .map((artist) => [String(artist.id), artist])
      );

      // reviews map
      const rMap: Record<string, any> = {};
      for (const r of (reviews ?? []) as any[]) {
        if (r?.bookingId) rMap[r.bookingId] = r;
      }
      this.reviewMap = rMap;

      const projectMap: Record<string, TattooProject> = {};
      for (const project of (projects ?? []) as TattooProject[]) {
        const id = String((project as any)?.id ?? '').trim();
        if (!id) continue;
        projectMap[id] = project;
      }
      this.projectMap = projectMap;

      // bookings sort
      const all = (bookings ?? []).slice().sort(
        (x, y) => new Date(x.start as any).getTime() - new Date(y.start as any).getTime()
      );
      this.bookings = all;
      this.syncSessionsMap(all, sessions ?? []);

      const now = Date.now();

      // cancelled
      this.cancelledBookings = all.filter(b => this.normStatus(b.status) === 'cancelled');

      // history: stati finali + appuntamenti ormai passati
      this.historyBookings = all.filter(b => {
        const s = this.normStatus(b.status);
        if (s === 'cancelled') return false;
        if (s === 'completed' || s === 'no_show') return true;
        if (['confirmed', 'paid', 'in_progress', 'pending'].includes(s)) {
          return this.getEndMs(b) < now;
        }
        return false;
      });

      // active: future non cancelled
      const activeFuture = all
        .filter(b => {
          const s = this.normStatus(b.status);
          if (s === 'cancelled' || s === 'completed' || s === 'no_show') return false;
          // future
          return this.getStartMs(b) >= now;
        })
        .sort((x, y) => this.getStartMs(x) - this.getStartMs(y));

      this.nextBooking = activeFuture[0] ?? null;
      this.otherUpcomingBookings = activeFuture.slice(1);

      // default view sensata: se non hai attive, vai nello storico
      if (!this.nextBooking && this.otherUpcomingBookings.length === 0 && this.historyBookings.length > 0) {
        this.selectedView = 'history';
      }

      this.logFinalDataSnapshot({
        userId: currentUser.uid,
        bookings: all,
        sessions: sessions ?? [],
        projects: projects ?? [],
        reviews: reviews ?? []
      });
    });

    onCleanup(() => sub.unsubscribe());
  }, { injector: this.injector });

  ngOnInit(): void {}

  // ===========
  // COMPUTED LISTS
  // ===========
  get activeBookings(): Booking[] {
    return [this.nextBooking, ...this.otherUpcomingBookings].filter(Boolean) as Booking[];
  }

  get filteredActiveBookings(): Booking[] {
    return this.filterByKind(this.activeBookings);
  }

  get filteredHistoryBookings(): Booking[] {
    return this.filterByKind(this.historyBookings);
  }

  get filteredCancelledBookings(): Booking[] {
    return this.filterByKind(this.cancelledBookings);
  }

  get displayedNextBooking(): Booking | null {
    return this.filteredActiveBookings[0] ?? null;
  }

  getSessionsForBooking(b: Booking): Session[] {
    const bookingId = this.getBookingId(b);
    const projectId = this.getProjectId(b);
    const byBooking = bookingId ? (this.sessionsByBookingId[bookingId] ?? []) : [];
    const byProject = projectId ? (this.sessionsByProjectId[projectId] ?? []) : [];

    if (byBooking.length === 0) return byProject;
    if (byProject.length === 0) return byBooking;

    const merged = [...byBooking];
    const seenIds = new Set(merged.map(s => String(s?.id ?? '').trim()).filter(Boolean));
    for (const s of byProject) {
      const sid = String(s?.id ?? '').trim();
      if (sid && seenIds.has(sid)) continue;
      merged.push(s);
    }
    return merged;
  }

  getSessionCount(b: Booking): number {
    return this.getSessionsForBooking(b).length;
  }

  getSessionStatusLabel(status: any): string {
    const s = String(status ?? '').toLowerCase();
    if (s === 'planned') return 'Pianificata';
    if (s === 'completed') return 'Completata';
    if (s === 'cancelled') return 'Annullata';
    return 'Seduta';
  }

  getSessionStatusClass(status: any): string {
    const s = String(status ?? '').toLowerCase();
    if (s === 'planned') return 'planned';
    if (s === 'completed') return 'done';
    if (s === 'cancelled') return 'cancelled';
    return '';
  }

  getAvailableActions(b: Booking): string[] {
    const s = this.normStatus(b.status);
    const actions: string[] = ['Dettagli'];

    if (s === 'cancelled') {
      actions.push('Riprenota', 'Apri ticket', 'WhatsApp');
      return actions;
    }

    actions.push('Scarica fattura', 'Riprenota');
    if (!this.reviewMap[(b as any).id]) actions.push('Lascia recensione');
    else actions.push('Vedi recensione');

    if (this.getSessionCount(b) > 0) actions.push('Vedi sedute');
    return actions;
  }

  // ===========
  // SAFE ACCESSORS (NO Booking type changes)
  // ===========
  private getStartMs(b: Booking): number {
    const t = new Date((b as any).start).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private getEndMs(b: Booking): number {
    const endIso = (b as any).end;
    if (endIso) {
      const t = new Date(endIso).getTime();
      if (Number.isFinite(t)) return t;
    }
    // fallback: start + durationMinutes se presente, altrimenti start
    const start = this.getStartMs(b);
    const mins = this.getDurationMinutes(b);
    return start + (mins ?? 0) * 60000;
  }

  getDurationMinutes(b: Booking): number | null {
    const raw = (b as any).durationMinutes;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;

    const s = this.getStartMs(b);
    const e = new Date((b as any).end).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      return Math.round((e - s) / 60000);
    }
    return null;
  }

  getDeposit(b: Booking): number | null {
    const raw = (b as any).deposit;
    return (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) ? raw : null;
  }

  // ===========
  // LABELS / STATUS
  // ===========
  getBookingLabel(b: Booking): string {
    const note = this.sanitizeBookingNote((b as any).notes);
    const artistName = this.getArtistNameForBooking(b);
    const artist = artistName && artistName !== 'Artista' ? ` - ${artistName}` : '';
    if (note) return `${note}${artist}`;
    const pid = (b as any).projectId ? ` - ${String((b as any).projectId)}` : '';
    return `Prenotazione ${(b as any).id ?? ''}${pid}${artist}`.trim();
  }

  getBookingKindLabel(b: Booking): string {
    return this.resolveBookingKind(b) === 'session' ? 'Seduta' : 'Consulenza';
  }

  getBookingKindClass(b: Booking): string {
    return this.resolveBookingKind(b);
  }

  private normStatus(status: any): string {
    return String(status ?? '').toLowerCase();
  }

  private resolveBookingKind(b: Booking): 'consultation' | 'session' {
    const raw = String((b as any)?.type ?? '').trim().toLowerCase();
    if (['session', 'seduta', 'tattoo_session'].includes(raw)) return 'session';
    if (['consultation', 'consulenza', 'consulto'].includes(raw)) return 'consultation';
    if (this.getSessionCount(b) > 0) return 'session';
    return 'consultation';
  }

  private sanitizeBookingNote(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const cleaned = raw
      .replace(/\[payment-init-failed\]/gi, ' ')
      .replace(/\bpayment-init-failed\b/gi, ' ')
      .replace(/errore interno del server\.?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  private logFinalDataSnapshot(params: {
    userId: string;
    bookings: Booking[];
    sessions: Session[];
    projects: TattooProject[];
    reviews: any[];
  }): void {
    const tag = '[BookingHistory][FINAL_DATA]';
    const active = this.activeBookings;
    const history = this.historyBookings;
    const cancelled = this.cancelledBookings;

    console.groupCollapsed(`${tag} user=${params.userId}`);
    console.log('counts', {
      bookings: params.bookings.length,
      active: active.length,
      history: history.length,
      cancelled: cancelled.length,
      sessions: params.sessions.length,
      projects: params.projects.length,
      reviews: params.reviews.length
    });

    console.log('selectedView', this.selectedView, 'selectedKindFilter', this.selectedKindFilter);
    console.log('nextBooking', this.nextBooking);
    console.log('otherUpcomingBookings', this.otherUpcomingBookings);
    console.log('historyBookings', history);
    console.log('cancelledBookings', cancelled);
    console.log('sessionsByBookingId', this.sessionsByBookingId);
    console.log('sessionsByProjectId', this.sessionsByProjectId);
    console.log('projectMap', this.projectMap);
    console.log('reviewMap', this.reviewMap);
    console.groupEnd();
  }

  private filterByKind(bookings: Booking[]): Booking[] {
    if (this.selectedKindFilter === 'all') return bookings;
    return (bookings ?? []).filter((booking) => this.resolveBookingKind(booking) === this.selectedKindFilter);
  }

  private getBookingId(b: Booking): string {
    return this.firstId((b as any)?.id, (b as any)?.bookingId, (b as any)?.idBooking, (b as any)?.booking_id);
  }

  private getProjectId(b: Booking): string {
    return this.firstId((b as any)?.projectId, (b as any)?.idProject, (b as any)?.project_id, (b as any)?.project?.id);
  }

  private getArtistId(b: Booking): string {
    const directArtistId = this.firstId((b as any)?.artistId, (b as any)?.idArtist, (b as any)?.artist?.id);
    if (directArtistId) return directArtistId;

    const project = this.getLinkedProject(b);
    if (!project) return '';
    return this.firstId((project as any)?.artistId, (project as any)?.idArtist, (project as any)?.artist?.id);
  }

  getArtistNameForBooking(b: Booking): string {
    const artistId = this.getArtistId(b);
    const fromMap = String(this.artistMap[artistId] ?? this.artistDetailsMap[artistId]?.name ?? '').trim();
    if (fromMap) return fromMap;

    const project = this.getLinkedProject(b);
    const fromProject = String((project as any)?.artistName ?? (project as any)?.artist?.name ?? '').trim();
    return fromProject || 'Artista';
  }

  private getSessionBookingId(s: Session): string {
    return this.firstId((s as any)?.bookingId, (s as any)?.idBooking, (s as any)?.booking_id);
  }

  private getSessionProjectId(s: Session): string {
    return this.firstId((s as any)?.projectId, (s as any)?.idProject, (s as any)?.project_id);
  }

  private firstId(...values: any[]): string {
    for (const value of values) {
      if (Array.isArray(value)) {
        for (const x of value) {
          const sid = String(x ?? '').trim();
          if (sid) return sid;
        }
        continue;
      }
      const raw = String(value ?? '').trim();
      if (!raw) continue;
      const sid = raw.split(/[;,|\s]+/).map(x => x.trim()).find(Boolean) ?? '';
      if (sid) return sid;
    }
    return '';
  }

  private syncSessionsMap(bookings: Booking[], sessions: Session[]): void {
    const bookingIds = new Set(
      (bookings ?? []).map(b => this.getBookingId(b)).filter(Boolean)
    );
    const projectIds = new Set(
      (bookings ?? []).map(b => this.getProjectId(b)).filter(Boolean)
    );

    const related = (sessions ?? [])
      .filter(s => {
        const bookingId = this.getSessionBookingId(s);
        const projectId = this.getSessionProjectId(s);
        return bookingIds.has(bookingId) || projectIds.has(projectId);
      })
      .slice()
      .sort((a, b) => new Date((a as any).start).getTime() - new Date((b as any).start).getTime());

    const byBooking: Record<string, Session[]> = {};
    const byProject: Record<string, Session[]> = {};

    for (const s of related) {
      const bookingId = this.getSessionBookingId(s);
      const projectId = this.getSessionProjectId(s);

      if (bookingId) {
        if (!byBooking[bookingId]) byBooking[bookingId] = [];
        byBooking[bookingId].push(s);
      }
      if (projectId) {
        if (!byProject[projectId]) byProject[projectId] = [];
        byProject[projectId].push(s);
      }
    }

    this.sessionsByBookingId = byBooking;
    this.sessionsByProjectId = byProject;
  }

  getStatusLabel(status: any): string {
    const s = this.normStatus(status);
    if (s === 'pending') return 'In attesa';
    if (s === 'confirmed') return 'Confermata';
    if (s === 'paid') return 'Pagata';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing') return 'In corso';
    if (s === 'cancelled') return 'Annullata';
    if (s === 'no_show') return 'No show';
    if (s === 'completed' || s === 'done') return 'Completata';
    if (s === 'draft') return 'Bozza';
    return 'Prenotazione';
  }

  getStatusClass(status: any): string {
    const s = this.normStatus(status);
    if (s === 'pending') return 'pending';
    if (s === 'confirmed') return 'confirmed';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing') return 'in_progress';
    if (s === 'paid') return 'confirmed';
    if (s === 'cancelled' || s === 'no_show') return 'cancelled';
    if (s === 'completed' || s === 'done') return 'done';
    return '';
  }

  getLinkedProject(b: Booking): TattooProject | null {
    const projectId = this.getProjectId(b);
    if (!projectId) return null;
    return this.projectMap[projectId] ?? null;
  }

  getProjectStatusLabel(status: any): string {
    return this.statusHelper.projectLabel(status, 'client');
  }

  getProjectStatusClass(status: any): string {
    return this.statusHelper.projectStatusKey(status);
  }

  // ===========
  // ACTIONS (client UX)
  // ===========
  openDetails(b: Booking) {
    const artistName = this.getArtistNameForBooking(b);
    const clientName = String((this.user as any)?.name ?? '').trim() || '-';
    this.dialog.open(AppointmentDetailsDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      autoFocus: false,
      data: { ...(b as any), artistName, clientName }
    });
  }



  openWhatsApp(b: Booking): void {
    const d = new Date((b as any).start);
    const msg =
      `Ciao! Ti scrivo per la prenotazione: "${this.getBookingLabel(b)}" del ${d.toLocaleDateString()} alle ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    ;
    this.externalActions.openWhatsApp(this.WHATSAPP_NUMBER, msg);
  }

  openTicket(b: Booking) {
    this.router.navigate(['/dashboard/ticket'], { queryParams: { bookingId: (b as any).id } });
  }

  openAftercare() {
    // metti qui la tua pagina guida se ce l'hai
    this.router.navigateByUrl('/contatti');
  }

  goToSupport() {
    this.router.navigateByUrl('/dashboard/ticket');
  }

  addToCalendar(b: Booking) {
    const url = this.buildGoogleCalendarUrl(b);
    if (!url) {
      this.snackbar.open('Impossibile aprire Google Calendar: data/ora non valide.', 'Chiudi', { duration: 2800 });
      return;
    }
    this.externalActions.openInNewTab(url);
  }

  async openArtistDetailsById(artistId: unknown): Promise<void> {
    const id = String(artistId ?? '').trim();
    if (!id) return;

    const existing = this.artistDetailsMap[id] ?? null;
    const fetched = existing ? null : await this.staffService.getStaffById(id);
    const resolved = fetched ?? existing;
    const fallbackName = String(this.artistMap[id] ?? '').trim();
    const fallbackPhoto = String(this.artistPhotoMap[id] ?? '').trim();

    const artist: StaffMember | null = resolved
      ? {
          ...resolved,
          id: resolved.id ?? id,
          userId: resolved.userId ?? id,
          name: String(resolved.name ?? '').trim() || fallbackName || 'Artista',
          photoUrl: String(resolved.photoUrl ?? '').trim() || fallbackPhoto || undefined
        }
      : (fallbackName || fallbackPhoto)
        ? {
            id,
            userId: id,
            name: fallbackName || 'Artista',
            role: 'altro',
            photoUrl: fallbackPhoto || undefined
          }
        : null;

    this.dialog.open(ArtistDetailsDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      autoFocus: false,
      data: {
        artistId: id,
        artist
      }
    });
  }

  openArtistDetailsForBooking(b: Booking): void {
    const artistId = this.getArtistId(b);
    if (!artistId) {
      this.snackbar.open('Dati artista non disponibili per questa prenotazione.', 'Chiudi', { duration: 2600 });
      return;
    }
    this.openArtistDetailsById(artistId);
  }

  requestReschedule(b: Booking) {
    const bookingId = String((b as any)?.id ?? '').trim();
    void this.router.navigate(['/dashboard/ticket'], {
      queryParams: {
        bookingId,
        action: 'reschedule',
        source: 'booking-history'
      }
    });
    this.snackbar.open('Aperta assistenza per richiesta cambio orario.', 'Chiudi', { duration: 2800 });
  }

  cancelRequest(b: Booking) {
    const ok = window.confirm('Confermi la richiesta di annullamento?');
    if (!ok) return;

    const bookingId = String((b as any)?.id ?? '').trim();
    void this.router.navigate(['/dashboard/ticket'], {
      queryParams: {
        bookingId,
        action: 'cancel',
        source: 'booking-history'
      }
    });
    this.snackbar.open('Aperta assistenza per richiesta annullamento.', 'Chiudi', { duration: 3000 });
  }

  rebook(b: Booking) {
    this.router.navigate(['/fast-booking'], { queryParams: { artistId: (b as any).artistId } });
  }

  // (opzionale) recensione, se gia lo usavi
  openReviewDialog(b: Booking) {
    const uid = this.user?.uid || this.user?.user?.uid || null;
    if (!uid) {
      this.snackbar.open('Errore: utente non autenticato.', 'Chiudi', { duration: 2500 });
      return;
    }

    const dialogRef = this.dialog.open(ReviewCreateDialogComponent, {
      data: {
        bookingId: (b as any).id,
        tattooTitle: this.getBookingLabel(b),
        artistId: this.getArtistId(b),
        userId: uid
      }
    });

    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this.snackbar.open('Grazie per la tua recensione!', 'Chiudi', { duration: 2500 });
        this.reviewMap[(b as any).id] = { id: 'temp', bookingId: (b as any).id };
      }
    });
  }

  viewReview(_: any) {
    this.router.navigateByUrl('/dashboard/reviews');
  }

  async downloadInvoice(b: Booking): Promise<void> {
    try {
      const invoices = await this.safeGetInvoicesArray();
      const result = this.bookingInvoiceHelper.createInvoicePdf({
        booking: b,
        invoices,
        sessions: this.getSessionsForBooking(b),
        artistName: this.getArtistNameForBooking(b),
        bookingLabel: this.getBookingLabel(b),
        user: this.user
      });

      this.externalActions.downloadBlobFile(result.blob, result.fileName);
      this.snackbar.open(
        result.usedExistingInvoice
          ? 'Fattura PDF scaricata.'
          : 'Fattura PDF ricavata dai dati della prenotazione e scaricata.',
        'Chiudi',
        { duration: 4500 }
      );
    } catch (error) {
      console.error('[BookingHistory] invoice download error', error);
      this.snackbar.open('Errore nel recupero/generazione fattura (vedi console).', 'Chiudi', { duration: 4000 });
    }
  }

  private async safeGetInvoicesArray(): Promise<any[]> {
    return firstValueFrom(
      this.invoicesService.getInvoices().pipe(
        take(1),
        timeout(4000),
        catchError(() => of([]))
      )
    );
  }

  private buildGoogleCalendarUrl(booking: Booking): string {
    const start = new Date(String((booking as any)?.start ?? ''));
    const end = new Date(String((booking as any)?.end ?? ''));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '';

    const bookingId = String((booking as any)?.id ?? '').trim();
    const title = `Consulenza - ${this.getBookingLabel(booking)}`;
    const details = [
      bookingId ? `Codice prenotazione: ${bookingId}` : '',
      `Stato: ${this.getStatusLabel((booking as any)?.status)}`,
      `Artista: ${this.getArtistNameForBooking(booking)}`
    ].filter(Boolean).join('\n');

    return (
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${this.toIcsUtc(start.toISOString())}/${this.toIcsUtc(end.toISOString())}` +
      `&details=${encodeURIComponent(details)}` +
      `&location=${encodeURIComponent('Rebis Tattoo')}`
    );
  }

  private toIcsUtc(value: string): string {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

}




