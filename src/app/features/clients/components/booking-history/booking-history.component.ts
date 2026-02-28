import { Component, OnInit, inject, effect, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { Session, SessionService } from '../../../../core/services/session/session.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { Router } from '@angular/router';
import { catchError, combineLatest, of, shareReplay, startWith, switchMap } from 'rxjs';
import { ReviewCreateDialogComponent } from '../../../../shared/components/dialogs/review-create-dialog/review-create-dialog.component';
import { firstValueFrom } from 'rxjs';
import { InvoicesService, Invoice } from '../../../../core/services/invoices/invoices.service';
import { ExternalActionsHelperService } from '../../../../core/services/helpers/external-actions-helper.service';
import { AppointmentDetailsDialogComponent } from '../../../../shared/components/dialogs/appointment-details-dialog/appointment-details-dialog.component';

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
  private readonly snackbar = inject(UiFeedbackService);
  private readonly dialog = inject(MatDialog);
  private readonly reviewsService = inject(ReviewsService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly invoicesService = inject(InvoicesService);
  private readonly externalActions = inject(ExternalActionsHelperService);
  private readonly sessionService = inject(SessionService);

  readonly WHATSAPP_NUMBER = '393333333333';

  selectedView: 'active' | 'history' | 'cancelled' = 'active';

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
  reviewMap: Record<string, any> = {};
  sessionsByBookingId: Record<string, Session[]> = {};
  sessionsByProjectId: Record<string, Session[]> = {};

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
      bookings$,
      sessions$.pipe(catchError(() => of([] as Session[])))
    ]).subscribe(([staff, reviews, bookings, sessions]) => {
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

      // reviews map
      const rMap: Record<string, any> = {};
      for (const r of (reviews ?? []) as any[]) {
        if (r?.bookingId) rMap[r.bookingId] = r;
      }
      this.reviewMap = rMap;

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
    const note = ((b as any).notes ?? '').trim();
    const artist = this.artistMap[(b as any).artistId] ? ` - ${this.artistMap[(b as any).artistId]}` : '';
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

  private getBookingId(b: Booking): string {
    return this.firstId((b as any)?.id, (b as any)?.bookingId, (b as any)?.idBooking, (b as any)?.booking_id);
  }

  private getProjectId(b: Booking): string {
    return this.firstId((b as any)?.projectId, (b as any)?.idProject, (b as any)?.project_id, (b as any)?.project?.id);
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
      const sid = String(value ?? '').trim();
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

  // ===========
  // ACTIONS (client UX)
  // ===========
  openDetails(b: Booking) {
    this.dialog.open(AppointmentDetailsDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      data: b
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
      data: { bookingId: (b as any).id, tattooTitle: this.getBookingLabel(b), artistId: (b as any).artistId, userId: uid }
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
  const bookingId = (b as any).id;

  console.groupCollapsed('%c[Invoice] downloadInvoice()', 'color:#00e5ff');
  console.log('bookingId:', bookingId);
  console.log('booking:', b);

  try {
    // 1) Carico fatture (se non disponibili: fallback a fattura derivata dai dati live)
    let invoices: any[] = [];
    try {
      invoices = await this.safeGetInvoicesArray();
    } catch (fetchErr) {
      console.warn('[Invoice] getInvoices fallback:', fetchErr);
    }
    console.log('invoices count:', invoices.length);
    console.log('invoices sample:', invoices.slice(0, 3));

    // 2) Cerco la fattura legata al booking
    const inv = invoices.find(i => (i as any).bookingId === bookingId) || null;
    console.log('matched invoice:', inv);
    const invoiceToPrint = inv ?? this.buildDerivedInvoiceFromBooking(b);

    // 3) Creo PDF e lo scarico come file
    const pdfBytes = this.buildInvoicePdf(invoiceToPrint, b);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    this.externalActions.downloadBlobFile(
      pdfBlob,
      `fattura-${(invoiceToPrint as any).number ?? (invoiceToPrint as any).id ?? bookingId}.pdf`
    );

    if (inv) {
      this.snackbar.open('Fattura PDF scaricata.', 'Chiudi', {
        duration: 4500
      });
    } else {
      this.snackbar.open('Fattura PDF ricavata dai dati della prenotazione e scaricata.', 'Chiudi', {
        duration: 4500
      });
    }
  } catch (err) {
    console.error('[Invoice] Error:', err);
    this.snackbar.open('Errore nel recupero/generazione fattura (vedi console).', 'Chiudi', { duration: 4000 });
  } finally {
    console.groupEnd();
  }
}
private async safeGetInvoicesArray(): Promise<any[]> {
  // Se il tuo InvoicesService espone un observable diverso, qui almeno lo intercettiamo con fallback.
  // ATTENZIONE: qui presuppongo che tu abbia gia `private readonly invoicesService = inject(InvoicesService);`
  const obs: any = (this as any).invoicesService?.getInvoices?.();

  if (!obs || typeof obs.subscribe !== 'function') {
    throw new Error('InvoicesService.getInvoices() non disponibile o non e un Observable');
  }

  // firstValueFrom con timeout "soft" per non restare appeso
  const { firstValueFrom, timeout, catchError, of } = await import('rxjs');
  const { timeoutWith } = await import('rxjs/operators').catch(() => ({ timeoutWith: null as any }));

  // Se non hai rxjs/operators importabili, usiamo un wrapper piu semplice:
  return await new Promise<any[]>((resolve, reject) => {
    const t = setTimeout(() => {
      sub.unsubscribe();
      reject(new Error('Timeout: getInvoices() non ha emesso'));
    }, 4000);

    const sub = obs.subscribe({
      next: (val: any) => {
        clearTimeout(t);
        sub.unsubscribe();
        resolve(Array.isArray(val) ? val : []);
      },
      error: (e: any) => {
        clearTimeout(t);
        sub.unsubscribe();
        reject(e);
      }
    });
  });
}

private buildInvoiceHtml(invoice: any, booking: any): string {
  const artistName = this.artistMap[booking.artistId] || 'Rebis Tattoo';
  const invNumber = invoice.number || invoice.id || 'FATTURA';
  const currency = invoice.currency || 'EUR';
  const issuedAt = invoice.issuedAt || invoice.date || new Date().toISOString();
  const date = new Date(issuedAt);
  const clientLabel = this.resolveClientLabel(invoice, booking);

  // supporta sia `items` (array) sia `amount/total`
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const total = Number(invoice.total ?? invoice.amount ?? 0);
  const paid = Number(invoice.paid ?? 0);
  const status = String(invoice.status ?? 'issued').toUpperCase();

  const bookingStart = new Date(booking.start);
  const bookingLine = isFinite(bookingStart.getTime())
    ? `${bookingStart.toLocaleDateString()} ${bookingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '-';

  const rows = items.length
    ? items.map((it: any, idx: number) => {
        const label = it.label ?? it.description ?? `Voce ${idx + 1}`;
        const qty = Number(it.qty ?? it.quantity ?? 1);
        const unit = Number(it.unitPrice ?? it.price ?? 0);
        const line = qty * unit;
        return `
          <tr>
            <td>${this.escapeHtml(String(label))}</td>
            <td class="num">${qty}</td>
            <td class="num">${this.money(unit, currency)}</td>
            <td class="num">${this.money(line, currency)}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="4" class="muted">Nessuna voce dettagliata</td></tr>`;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(invNumber)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; background:#fff; color:#111; }
    .wrap { max-width: 820px; margin: 0 auto; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; margin: 10px 0 16px; }
    .brand { font-weight: 800; font-size: 18px; }
    .muted { color:#666; }
    .badge { border:1px solid #e6e6e6; padding:8px 10px; border-radius:10px; font-size:12px; }
    .card { border:1px solid #e6e6e6; border-radius:14px; padding:14px; margin-bottom:14px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .k { font-size:12px; color:#666; margin-bottom:4px; }
    .v { font-size:14px; font-weight:700; }
    table { width:100%; border-collapse: collapse; margin-top:10px; }
    th, td { border-bottom:1px solid #e6e6e6; padding:10px 8px; text-align:left; }
    th { font-size:12px; color:#666; text-transform:uppercase; letter-spacing:.06em; }
    .num { text-align:right; white-space:nowrap; }
    .total { display:flex; justify-content:flex-end; margin-top:10px; }
    .box { min-width:280px; border:1px solid #e6e6e6; border-radius:12px; padding:12px; }
    .row { display:flex; justify-content:space-between; margin:4px 0; font-size:13px; }
    .row strong { font-size:16px; }
    .hint { font-size:12px; color:#666; margin: 8px 0 14px; }
    @media print { .hint { display:none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hint">Apri questo file -> Stampa -> "Salva come PDF".</div>

    <div class="top">
      <div>
        <div class="brand">Rebis Tattoo</div>
        <div class="muted">Fattura / Ricevuta</div>
      </div>
      <div class="badge">${this.escapeHtml(status)}</div>
    </div>

    <div class="card grid">
      <div><div class="k">Numero</div><div class="v">${this.escapeHtml(invNumber)}</div></div>
      <div><div class="k">Data</div><div class="v">${date.toLocaleDateString()}</div></div>
      <div><div class="k">Artista</div><div class="v">${this.escapeHtml(artistName)}</div></div>
      <div><div class="k">Appuntamento</div><div class="v">${this.escapeHtml(bookingLine)}</div></div>
      <div><div class="k">Consulenza ID</div><div class="v">${this.escapeHtml(String(booking.id ?? '-'))}</div></div>
      <div><div class="k">Cliente</div><div class="v">${this.escapeHtml(clientLabel)}</div></div>
    </div>

    <div class="card">
      <div class="k">Dettaglio</div>
      <table>
        <thead>
          <tr>
            <th>Descrizione</th>
            <th class="num">Qta</th>
            <th class="num">Prezzo</th>
            <th class="num">Totale</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="total">
        <div class="box">
          <div class="row"><span class="muted">Totale</span><strong>${this.money(total, currency)}</strong></div>
          ${paid ? `<div class="row"><span class="muted">Pagato</span><span>${this.money(paid, currency)}</span></div>` : ''}
          ${paid ? `<div class="row"><span class="muted">Residuo</span><span>${this.money(Math.max(0, total - paid), currency)}</span></div>` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

private buildInvoicePdf(invoice: any, booking: any): Uint8Array {
  const invNumber = String(invoice?.number ?? invoice?.id ?? 'FATTURA');
  const currency = String(invoice?.currency ?? 'EUR');
  const issuedAt = String(invoice?.issuedAt ?? invoice?.date ?? new Date().toISOString());
  const issueDate = new Date(issuedAt);
  const dateLabel = Number.isFinite(issueDate.getTime()) ? issueDate.toLocaleDateString('it-IT') : issuedAt;
  const artistName = String(this.artistMap[(booking as any)?.artistId] ?? 'Rebis Tattoo');
  const clientLabel = this.resolveClientLabel(invoice, booking);
  const bookingStart = new Date((booking as any)?.start);
  const bookingLine = Number.isFinite(bookingStart.getTime())
    ? `${bookingStart.toLocaleDateString('it-IT')} ${bookingStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
    : '-';

  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const total = Number(invoice?.total ?? invoice?.amount ?? 0) || 0;
  const paid = Number(invoice?.paid ?? 0) || 0;
  const residual = Math.max(0, total - paid);
  const status = String(invoice?.status ?? 'issued').toUpperCase();

  const lines: string[] = [];
  lines.push('Rebis Tattoo - Fattura / Ricevuta');
  lines.push(`Numero: ${invNumber}`);
  lines.push(`Data: ${dateLabel}`);
  lines.push(`Stato: ${status}`);
  lines.push(`Cliente: ${clientLabel}`);
  lines.push(`Artista: ${artistName}`);
  lines.push(`Consulenza ID: ${String((booking as any)?.id ?? '-')}`);
  lines.push(`Appuntamento: ${bookingLine}`);
  lines.push('');
  lines.push('Dettaglio voci:');

  if (items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] ?? {};
      const label = String(it?.label ?? it?.description ?? `Voce ${i + 1}`);
      const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
      const unit = Number(it?.unitPrice ?? it?.price ?? 0) || 0;
      const lineTotal = qty * unit;
      const row = `- ${label} | Qta: ${qty} | Prezzo: ${this.moneyPlain(unit, currency)} | Totale: ${this.moneyPlain(lineTotal, currency)}`;
      lines.push(...this.wrapPdfText(row, 95));
    }
  } else {
    lines.push('- Nessuna voce dettagliata');
  }

  lines.push('');
  lines.push(`Totale: ${this.moneyPlain(total, currency)}`);
  lines.push(`Pagato: ${this.moneyPlain(paid, currency)}`);
  lines.push(`Residuo: ${this.moneyPlain(residual, currency)}`);

  return this.buildSimplePdf(lines);
}

private buildDerivedInvoiceFromBooking(booking: Booking): any {
  const bookingId = String((booking as any)?.id ?? '').trim();
  const nowIso = new Date().toISOString();
  const sessions = this.getSessionsForBooking(booking);

  const items: Array<{ description: string; quantity: number; price: number }> = [];
  const bookingBase =
    this.toFiniteNumber((booking as any)?.price) ??
    this.toFiniteNumber((booking as any)?.depositRequired) ??
    this.toFiniteNumber((booking as any)?.paidAmount) ??
    0;

  if (bookingBase > 0) {
    items.push({
      description: `Consulenza ${this.getBookingLabel(booking)}`,
      quantity: 1,
      price: bookingBase
    });
  }

  for (const s of sessions) {
    const amount = this.toFiniteNumber((s as any)?.price) ?? this.toFiniteNumber((s as any)?.paidAmount) ?? 0;
    if (amount <= 0) continue;
    const start = String((s as any)?.start ?? (s as any)?._start ?? '').trim();
    items.push({
      description: `Seduta ${start || '-'} (${String((s as any)?.status ?? 'planned')})`,
      quantity: 1,
      price: amount
    });
  }

  if (!items.length) {
    items.push({
      description: `Prestazione ${this.getBookingLabel(booking)}`,
      quantity: 1,
      price: 0
    });
  }

  const total = items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0);
  const bookingPaid = this.toFiniteNumber((booking as any)?.paidAmount) ?? 0;
  const sessionsPaid = sessions.reduce((sum, s) => sum + (this.toFiniteNumber((s as any)?.paidAmount) ?? 0), 0);
  const paid = bookingPaid + sessionsPaid;
  const normalizedTotal = total > 0 ? total : paid;

  return {
    id: `derived-${bookingId || Date.now()}`,
    number: `DRV-${bookingId || Date.now()}`,
    bookingId,
    clientName: this.resolveClientLabel({}, booking as any),
    date: nowIso,
    issuedAt: nowIso,
    currency: 'EUR',
    items,
    amount: normalizedTotal,
    total: normalizedTotal,
    paid,
    status: normalizedTotal > 0 && paid >= normalizedTotal ? 'paid' : 'pending'
  };
}

private buildBookingIcs(booking: Booking): string {
  const start = this.toIcsUtc((booking as any)?.start);
  const end = this.toIcsUtc((booking as any)?.end);
  const now = this.toIcsUtc(new Date().toISOString());
  const bookingId = String((booking as any)?.id ?? 'booking').trim();
  const title = this.icsEscape(this.getBookingLabel(booking));
  const artist = this.icsEscape(this.artistMap[(booking as any)?.artistId] || 'Rebis Tattoo');
  const description = this.icsEscape(
    `Prenotazione ${bookingId}\\nArtista: ${artist}\\nStato: ${this.getStatusLabel((booking as any)?.status)}`
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rebis Tattoo//Booking//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${bookingId}@rebis-tattoo`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'LOCATION:Rebis Tattoo',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
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
    `Artista: ${this.artistMap[(booking as any)?.artistId] || 'Rebis Tattoo'}`
  ].filter(Boolean).join('\n');

  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${this.toIcsUtc(start.toISOString())}/${this.toIcsUtc(end.toISOString())}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent('Rebis Tattoo')}`
  );
}

private buildSimplePdf(lines: string[]): Uint8Array {
  const contentLines: string[] = ['BT', '/F1 11 Tf', '50 800 Td'];
  for (let i = 0; i < lines.length; i++) {
    const raw = this.pdfAscii(lines[i] ?? '');
    const safe = this.pdfEscape(raw);
    contentLines.push(`(${safe}) Tj`);
    if (i < lines.length - 1) contentLines.push('0 -14 Td');
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [0];
  let cursor = header.length;
  for (const obj of objects) {
    offsets.push(cursor);
    body += obj;
    cursor += obj.length;
  }

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(header + body + xref + trailer);
}

private wrapPdfText(input: string, maxLen: number): string[] {
  const text = String(input ?? '').trim();
  if (!text) return [''];
  if (text.length <= maxLen) return [text];

  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) rows.push(current);
    current = w;
  }
  if (current) rows.push(current);
  return rows;
}

private moneyPlain(value: number, currency: string): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(currency || 'EUR').toUpperCase()}`;
}

private pdfEscape(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

private pdfAscii(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

private toIcsUtc(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

private icsEscape(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

private resolveClientLabel(invoice: any, booking: any): string {
  const candidates = [
    invoice?.clientName,
    invoice?.customerName,
    invoice?.clientEmail,
    invoice?.email,
    booking?.clientName,
    booking?.customerName,
    booking?.clientEmail,
    this.user?.name,
    this.user?.displayName,
    this.user?.email
  ];

  for (const c of candidates) {
    const value = String(c ?? '').trim();
    if (value) return value;
  }
  return 'Cliente';
}



private downloadHtmlFile(html: string, filename: string): void {
  this.externalActions.downloadTextFile(html, filename, 'text/html;charset=utf-8');
}
private money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

private toFiniteNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}


private escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

}




