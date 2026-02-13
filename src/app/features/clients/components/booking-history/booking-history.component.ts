import { Component, OnInit, inject, effect, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ReviewCreateDialogComponent } from '../../../../shared/components/dialogs/review-create-dialog/review-create-dialog.component';
import { firstValueFrom } from 'rxjs';
import { InvoicesService, Invoice } from '../../../../core/services/invoices/invoices.service';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
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

  // ===========
  // LOAD (no service changes)
  // ===========
  private readonly loadEffect = effect((onCleanup) => {
    const currentUser = this.auth.userSig();
    if (!currentUser?.uid) return;

    this.user = currentUser;

    const sub = combineLatest([
      this.staffService.getAllStaff(),
      this.reviewsService.getReviewsByUser(currentUser.uid),
      this.bookingService.getBookingsByClient(currentUser.uid)
    ]).subscribe(([staff, reviews, bookings]) => {
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

      const now = Date.now();

      // cancelled
      this.cancelledBookings = all.filter(b => this.normStatus(b.status) === 'cancelled');

      // history: completate o confermate già finite
      this.historyBookings = all.filter(b => {
        const s = this.normStatus(b.status);
        if (s === 'cancelled') return false;
        if (s === 'completed') return true;
        if (s === 'confirmed') return this.getEndMs(b) < now;
        return false;
      });

      // active: future non cancelled
      const activeFuture = all
        .filter(b => {
          const s = this.normStatus(b.status);
          if (s === 'cancelled') return false;
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
    const artist = this.artistMap[(b as any).artistId] ? ` • ${this.artistMap[(b as any).artistId]}` : '';
    if (note) return `${note}${artist}`;
    const pid = (b as any).projectId ? ` • ${String((b as any).projectId)}` : '';
    return `Prenotazione ${(b as any).id ?? ''}${pid}${artist}`.trim();
  }

  private normStatus(status: any): string {
    return String(status ?? '').toLowerCase();
  }

  getStatusLabel(status: any): string {
    const s = this.normStatus(status);
    if (s === 'pending') return 'In attesa';
    if (s === 'confirmed') return 'Confermata';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing' || s === 'paid') return 'In corso';
    if (s === 'cancelled') return 'Annullata';
    if (s === 'completed' || s === 'done') return 'Completata';
    if (s === 'draft') return 'Bozza';
    return 'Prenotazione';
  }

  getStatusClass(status: any): string {
    const s = this.normStatus(status);
    if (s === 'pending') return 'pending';
    if (s === 'confirmed') return 'confirmed';
    if (s === 'in_progress' || s === 'on-going' || s === 'ongoing' || s === 'paid') return 'in_progress';
    if (s === 'cancelled') return 'cancelled';
    if (s === 'completed' || s === 'done') return 'done';
    return '';
  }

  // ===========
  // ACTIONS (client UX)
  // ===========
  openDetails(b: Booking) {
    // se hai già una route dettagli, cambiala qui
    this.snackbar.open(`Dettagli: ${this.getBookingLabel(b)}`, 'Chiudi', { duration: 2200 });
  }



  openWhatsApp(b: Booking): void {
    const d = new Date((b as any).start);
    const msg = encodeURIComponent(
      `Ciao! Ti scrivo per la prenotazione: "${this.getBookingLabel(b)}" del ${d.toLocaleDateString()} alle ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    );
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  }

  openTicket(b: Booking) {
    this.router.navigate(['/dashboard/ticket'], { queryParams: { bookingId: (b as any).id } });
  }

  openAftercare() {
    // metti qui la tua pagina guida se ce l’hai
    this.router.navigateByUrl('/contatti');
  }

  goToSupport() {
    this.router.navigateByUrl('/dashboard/ticket');
  }

  addToCalendar(_: Booking) {
    this.snackbar.open('Aggiunto al calendario. (Simulazione)', 'Chiudi', { duration: 2200 });
  }

  requestReschedule(_: Booking) {
    this.snackbar.open('Richiesta cambio orario inviata. (Simulazione)', 'Chiudi', { duration: 2200 });
  }

  cancelRequest(_: Booking) {
    this.snackbar.open('Richiesta annullamento inviata. (Simulazione)', 'Chiudi', { duration: 2400 });
  }

  rebook(b: Booking) {
    this.router.navigate(['/fast-booking'], { queryParams: { artistId: (b as any).artistId } });
  }

  // (opzionale) recensione, se già lo usavi
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
    // 1) Carico fatture
    const invoices = await this.safeGetInvoicesArray();
    console.log('invoices count:', invoices.length);
    console.log('invoices sample:', invoices.slice(0, 3));

    // 2) Cerco la fattura legata al booking
    const inv = invoices.find(i => (i as any).bookingId === bookingId) || null;
    console.log('matched invoice:', inv);

    if (!inv) {
      this.snackbar.open('Nessuna fattura trovata per questa prenotazione.', 'Chiudi', { duration: 3500 });
      console.groupEnd();
      return;
    }

    // 3) Creo HTML e lo scarico come file
    const html = this.buildInvoiceHtml(inv, b);
    this.downloadHtmlFile(html, `fattura-${(inv as any).number ?? (inv as any).id ?? bookingId}.html`);

    this.snackbar.open('Fattura pronta: file HTML scaricato. Aprilo e stampa → “Salva come PDF”.', 'Chiudi', {
      duration: 4500
    });
  } catch (err) {
    console.error('[Invoice] Error:', err);
    this.snackbar.open('Errore nel recupero/generazione fattura (vedi console).', 'Chiudi', { duration: 4000 });
  } finally {
    console.groupEnd();
  }
}
private async safeGetInvoicesArray(): Promise<any[]> {
  // Se il tuo InvoicesService espone un observable diverso, qui almeno lo intercettiamo con fallback.
  // ATTENZIONE: qui presuppongo che tu abbia già `private readonly invoicesService = inject(InvoicesService);`
  const obs: any = (this as any).invoicesService?.getInvoices?.();

  if (!obs || typeof obs.subscribe !== 'function') {
    throw new Error('InvoicesService.getInvoices() non disponibile o non è un Observable');
  }

  // firstValueFrom con timeout “soft” per non restare appeso
  const { firstValueFrom, timeout, catchError, of } = await import('rxjs');
  const { timeoutWith } = await import('rxjs/operators').catch(() => ({ timeoutWith: null as any }));

  // Se non hai rxjs/operators importabili, usiamo un wrapper più semplice:
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

  // supporta sia `items` (array) sia `amount/total`
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const total = Number(invoice.total ?? invoice.amount ?? 0);
  const paid = Number(invoice.paid ?? 0);
  const status = String(invoice.status ?? 'issued').toUpperCase();

  const bookingStart = new Date(booking.start);
  const bookingLine = isFinite(bookingStart.getTime())
    ? `${bookingStart.toLocaleDateString()} ${bookingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '—';

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
    <div class="hint">Apri questo file → Stampa → “Salva come PDF”.</div>

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
      <div><div class="k">Booking ID</div><div class="v">${this.escapeHtml(String(booking.id ?? '—'))}</div></div>
      <div><div class="k">Cliente</div><div class="v">${this.escapeHtml(String(invoice.clientId ?? invoice.clientName ?? '—'))}</div></div>
    </div>

    <div class="card">
      <div class="k">Dettaglio</div>
      <table>
        <thead>
          <tr>
            <th>Descrizione</th>
            <th class="num">Qtà</th>
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



private downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}
private money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
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
