import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, map, startWith, Observable } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { MatDialog } from '@angular/material/dialog';
import { ProjectTrackerProjectDialogComponent } from '../project-tracker/project-tracker-project-dialog/project-tracker-project-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { BookingService, Booking } from '../../../../core/services/bookings/booking.service';
import { SessionService, Session } from '../../../../core/services/session/session.service';
import { InvoicesService, Invoice } from '../../../../core/services/invoices/invoices.service';
import { ClientService, Client } from '../../../../core/services/clients/client.service';

import { Database, onValue, ref } from '@angular/fire/database';

type TabKey = 'all' | 'needs_booking' | 'active_only' | 'completed';

type PaymentRow = {
  id: string;
  amount?: number;
  status?: string;
  createdAt?: string;

  projectId?: string;
  bookingId?: string;

  clientId?: string;
  artistId?: string;
};

type UiSession = Session & { _start?: string; _end?: string; _startIso?: string; _endIso?: string; _durationMin?: number };

type VmRow = {
  project: TattooProject;

  client?: Client; // ✅ join da Firestore
  clientLabel: string;

  booking?: Booking;
  hasBooking: boolean;

  sessions: UiSession[];
  sessionsCount: number;

  invoices: Invoice[];
  invoiceTotal: number;

  payments: PaymentRow[];
  paidTotal: number;

  expectedTotal?: number; // stima: project.estimatedPrice/price -> booking.price -> somma session.price
  remaining?: number;

  isClosed: boolean;
  canAddSession: boolean;
};

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss'],
})
export class ProjectManagerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly projectsService = inject(ProjectsService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly clientService = inject(ClientService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly db = inject(Database);

  readonly tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'all', label: 'Tutti', icon: 'apps' },
    { key: 'needs_booking', label: 'Senza Booking', icon: 'event_busy' },
    { key: 'active_only', label: 'Attivi', icon: 'bolt' },
    { key: 'completed', label: 'Conclusi', icon: 'task_alt' },
  ];

  readonly form = this.fb.nonNullable.group({
    tab: this.fb.nonNullable.control<TabKey>('all'),
    q: this.fb.nonNullable.control(''),
    onlyNotClosed: this.fb.nonNullable.control(true),
  });

  // ---- Payments RTDB (nodo: payments) ----
  private payments$(): Observable<PaymentRow[]> {
    return new Observable<PaymentRow[]>(obs => {
      const paymentsRef = ref(this.db, 'payments');
      const unsub = onValue(
        paymentsRef,
        snap => {
          const val = snap.val();
          const list: PaymentRow[] = val
            ? Object.entries<any>(val).map(([id, v]) => ({ id, ...(v ?? {}) }))
            : [];
          obs.next(list);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  // ---- Clients Firestore (one-shot) ----
  private clientsOnce$(): Observable<Client[]> {
    // usa getAllUsersOnce() dal tuo ClientService (Firestore)
    return this.clientService.getAllUsersOnce();
  }

  readonly vm$ = combineLatest([
    this.projectsService.getProjects(),
    this.bookingService.getAllBookings(),
    this.sessionService.getAll({ onlyOnce: false }),
    this.invoicesService.getInvoices(),
    this.payments$(),
    this.clientsOnce$(),
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
  ]).pipe(
    map(([projects, bookings, sessions, invoices, payments, clients, f]) => {
      const safeProjects = projects ?? [];
      const safeBookings = bookings ?? [];
      const safeSessions = sessions ?? [];
      const safeInvoices = invoices ?? [];
      const safePayments = payments ?? [];
      const safeClients = clients ?? [];

      // ---- maps ----
      const clientById = new Map<string, Client>();
      for (const c of safeClients) {
        const id = String((c as any).id ?? '').trim();
        if (id) clientById.set(id, c);
      }

      const bookingById = new Map<string, Booking>();
      const bookingByProjectId = new Map<string, Booking>();

      for (const b of safeBookings) {
        const id = String((b as any).id ?? '').trim();
        if (id) bookingById.set(id, b as any);

        const pid = String((b as any).projectId ?? '').trim();
        if (!pid) continue;

        const prev = bookingByProjectId.get(pid);
        if (!prev) bookingByProjectId.set(pid, b as any);
        else {
          const prevStart = String((prev as any).start ?? '');
          const curStart = String((b as any).start ?? '');
          if (curStart.localeCompare(prevStart) > 0) bookingByProjectId.set(pid, b as any);
        }
      }

      const sessionsByProjectId = new Map<string, Session[]>();
      for (const s of safeSessions) {
        let pid = String((s as any).projectId ?? '').trim();
        if (!pid) {
          const bid = String((s as any).bookingId ?? '').trim();
          if (bid) {
            const b = bookingById.get(bid);
            pid = String((b as any)?.projectId ?? '').trim();
          }
        }
        if (!pid) continue;
        const arr = sessionsByProjectId.get(pid) ?? [];
        arr.push(s);
        sessionsByProjectId.set(pid, arr);
      }

      const invoicesByClient = new Map<string, Invoice[]>();
      const invoicesByBooking = new Map<string, Invoice[]>();
      for (const inv of safeInvoices) {
        const cid = String((inv as any).clientId ?? '').trim();
        const bid = String((inv as any).bookingId ?? '').trim();
        if (cid) {
          const arr = invoicesByClient.get(cid) ?? [];
          arr.push(inv);
          invoicesByClient.set(cid, arr);
        }
        if (bid) {
          const arr = invoicesByBooking.get(bid) ?? [];
          arr.push(inv);
          invoicesByBooking.set(bid, arr);
        }
      }

      const paymentsByProjectId = new Map<string, PaymentRow[]>();
      const paymentsByBookingId = new Map<string, PaymentRow[]>();

      for (const p of safePayments) {
        const pid = String(p.projectId ?? '').trim();
        const bid = String(p.bookingId ?? '').trim();

        if (pid) {
          const arr = paymentsByProjectId.get(pid) ?? [];
          arr.push(p);
          paymentsByProjectId.set(pid, arr);
        }
        if (bid) {
          const arr = paymentsByBookingId.get(bid) ?? [];
          arr.push(p);
          paymentsByBookingId.set(bid, arr);
        }
      }

      // ---- rows ----
      let list: VmRow[] = safeProjects.map(prj => {
        const pid = String((prj as any).id ?? '').trim();
        const clientId = String((prj as any).clientId ?? '').trim();

        const client = clientId ? clientById.get(clientId) : undefined;
        const clientLabel = this.clientLabel(client, clientId);

        // booking: prima project.bookingId, poi booking con projectId
        const projectBookingId = String((prj as any).bookingId ?? '').trim();
        const booking =
          (projectBookingId ? bookingById.get(projectBookingId) : undefined) ||
          (pid ? bookingByProjectId.get(pid) : undefined);

        const hasBooking = !!booking;

        // sessions
        const sess = pid ? (sessionsByProjectId.get(pid) ?? []) : [];
        const normalizedSessions = sess
          .map(s => this.normalizeSessionForUi(s as any))
          .sort((a, b) => this.toTimestamp(a._startIso) - this.toTimestamp(b._startIso));

        const sessionsCount = normalizedSessions.length;

        // closed?
        const status = String((prj as any).status ?? '').trim();
        const isClosed = status === 'completed' || status === 'cancelled';
        const canAddSession = !isClosed;

        // payments: projectId + bookingId (dedup)
        const payList =
          (pid ? (paymentsByProjectId.get(pid) ?? []) : [])
            .concat(booking ? (paymentsByBookingId.get(String((booking as any).id ?? '').trim()) ?? []) : []);

        const seenPay = new Set<string>();
        const paymentsUniq = payList.filter(x => {
          if (!x?.id) return false;
          if (seenPay.has(x.id)) return false;
          seenPay.add(x.id);
          return true;
        });

        const paidTotal = paymentsUniq
          .filter(x => {
            const s = String(x.status ?? '').toLowerCase();
            return s === 'succeeded' || s === 'paid';
          })
          .reduce((sum, x) => sum + (Number(x.amount ?? 0) || 0), 0);

        // invoices: per bookingId se presente, altrimenti per clientId (fallback)
        const invList = booking
          ? (invoicesByBooking.get(String((booking as any).id ?? '').trim()) ?? [])
          : (clientId ? (invoicesByClient.get(clientId) ?? []) : []);

        const invoiceTotal = invList.reduce((sum, x) => sum + (Number((x as any).amount ?? 0) || 0), 0);

        // expected total: project.estimatedPrice/price -> booking.price -> somma session.price
        const expectedTotal =
          this.num((prj as any).estimatedPrice) ??
          this.num((prj as any).price) ??
          (booking ? this.num((booking as any).price) : undefined) ??
          this.sumSessionsPrice(normalizedSessions);

        const remaining =
          expectedTotal != null ? Math.max(0, expectedTotal - paidTotal) : undefined;

        return {
          project: prj,
          client,
          clientLabel,
          booking,
          hasBooking,
          sessions: normalizedSessions,
          sessionsCount,
          invoices: invList,
          invoiceTotal,
          payments: paymentsUniq,
          paidTotal,
          expectedTotal,
          remaining,
          isClosed,
          canAddSession,
        };
      });

      // ---- filters ----
      if (f.tab === 'needs_booking') list = list.filter(x => !x.hasBooking);
      if (f.tab === 'active_only') list = list.filter(x => !x.isClosed);
      if (f.tab === 'completed') list = list.filter(x => x.isClosed);

      if (f.onlyNotClosed && f.tab !== 'completed') list = list.filter(x => !x.isClosed);

      const q = (f.q ?? '').trim().toLowerCase();
      if (q) {
        list = list.filter(x => {
          const p: any = x.project as any;
          const hay = [
            p.title,
            p.name,
            p.id,
            p.clientId,
            x.client?.name,
            x.client?.surname,
            x.client?.email,
            x.client?.phone,
            p.artistId,
            p.zone,
            p.notes,
            p.style,
            p.subject,
            p.placement,
            p.status,
            (x.booking as any)?.id,
            (x.booking as any)?.status,
          ].filter(Boolean).join(' ').toLowerCase();
          return hay.includes(q);
        });
      }

      // ---- sort ----
      list.sort((a, b) => {
        if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
        return String((b.project as any).updatedAt ?? '').localeCompare(String((a.project as any).updatedAt ?? ''));
      });

      const counts = {
        all: safeProjects.length,
        needs_booking: safeProjects.filter(p => !String((p as any).bookingId ?? '').trim()).length,
        active_only: safeProjects.filter(p => {
          const s = String((p as any).status ?? '');
          return s !== 'completed' && s !== 'cancelled';
        }).length,
        completed: safeProjects.filter(p => {
          const s = String((p as any).status ?? '');
          return s === 'completed' || s === 'cancelled';
        }).length,
      } as Record<TabKey, number>;

      return { list, counts };
    })
  );

  setTab(tab: TabKey) {
    this.form.controls.tab.setValue(tab);
  }

  async editProject(p: TattooProject): Promise<void> {
    const ref = this.dialog.open(ProjectTrackerProjectDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      data: { project: p }
    });
    const res = await ref.afterClosed().toPromise();
    if (!res) return;
    try {
      await this.projectsService.updateProject(String((p as any).id), res);
      this.snackBar.open('Progetto aggiornato', 'OK', { duration: 2200 });
    } catch {
      this.snackBar.open('Errore aggiornamento progetto', 'OK', { duration: 2500 });
    }
  }

  async togglePublic(p: TattooProject): Promise<void> {
    const id = String((p as any)?.id ?? '').trim();
    if (!id) return;
    const current = (p as any)?.isPublic;
    const next = current === false ? true : false;
    try {
      await this.projectsService.updateProject(id, { isPublic: next });
      this.snackBar.open(next ? 'Progetto pubblicato' : 'Progetto nascosto', 'OK', { duration: 2000 });
    } catch {
      this.snackBar.open('Errore aggiornamento visibilita', 'OK', { duration: 2400 });
    }
  }

  // -----------------------------
  // Actions (agganci reali dopo)
  // -----------------------------
  openProject(p: TattooProject) {
    // metti il route che vuoi (admin/public)
    return ['/admin/portfolio', (p as any).id];
  }

  createBookingForProject(p: TattooProject) {
    // TODO: apri EventDrawer in modalità booking con projectId precompilato
  }

  editBooking(b: Booking) {
    void b;
  }

  addSessionToProject(p: TattooProject) {
    // TODO: apri EventDrawer in modalità session con projectId precompilato
  }

  editSession(s: Session) {
    void s;
  }

  // ✅ “Messaggia cliente” (WhatsApp se phone, altrimenti email)
  messageClient(row: VmRow) {
    const phone = String(row.client?.phone ?? '').replace(/\s+/g, '').trim();
    const email = String(row.client?.email ?? '').trim();

    if (phone) {
      // WhatsApp: aggiungi prefisso se serve (qui lascio com'è)
      const url = `https://wa.me/${encodeURIComponent(phone)}`;
      window.open(url, '_blank');
      return;
    }

    if (email) {
      const subject = encodeURIComponent(`Rebis Tattoo — Progetto ${row.project.title}`);
      const body = encodeURIComponent(`Ciao,\n\nTi scriviamo per aggiornamenti sul progetto "${row.project.title}".\n\n— Rebis Tattoo`);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
      return;
    }

    this.snackBar.open('Nessun contatto cliente disponibile', 'OK', { duration: 2200 });
  }

  // ✅ Fattura “completa” (booking + sessioni) — stub pronto
  downloadFullInvoice(row: VmRow) {
    // TODO: qui decidi se:
    // 1) generare PDF lato client (consigliato)
    // 2) usare/salvare su RTDB invoices con items
    void row;
  }

  // ✅ Fattura singola sessione — stub pronto
  downloadSessionInvoice(row: VmRow, s: UiSession) {
    void row;
    void s;
  }

  // -----------------------------
  // UI helpers
  // -----------------------------
  statusLabel(s: any): string {
    const v = String(s ?? '').trim();
    switch (v) {
      case 'draft': return 'Bozza';
      case 'scheduled': return 'Prenotato';
      case 'active': return 'Attivo';
      case 'healing': return 'Guarigione';
      case 'completed': return 'Concluso';
      case 'cancelled': return 'Annullato';
      default: return v || '—';
    }
  }

  bookingWhenLabel(b?: any): string {
    if (!b) return '—';
    const start = this.normalizeLocalDateTime(String(b.start ?? b.date ?? '').trim());
    const end = this.normalizeLocalDateTime(String(b.end ?? '').trim());
    if (!start) return '—';
    return end ? `${this.formatLocal(start)} → ${this.formatLocal(end)}` : this.formatLocal(start);
  }

  money(n: any): string {
    const x = Number(n);
    if (!isFinite(x)) return '—';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
  }

  invoiceAmount(inv: Invoice): number | undefined {
    const amount = (inv as any)?.amount ?? (inv as any)?.total ?? undefined;
    const n = Number(amount);
    return isFinite(n) ? n : undefined;
  }

  invoiceDate(inv: Invoice): string {
    const raw =
      String((inv as any)?.date ?? (inv as any)?.issuedAt ?? (inv as any)?.createdAt ?? '').trim();
    if (!raw) return '—';
    const iso = this.normalizeLocalDateTime(raw);
    return this.formatLocal(iso);
  }

  invoiceStatus(inv: Invoice): string {
    return String((inv as any)?.status ?? '').trim() || '—';
  }

  zoneLabel(p: TattooProject): string {
    const a = String((p as any).zone ?? '').trim();
    const pl = String((p as any).placement ?? '').trim();
    const z = [a, pl].filter(Boolean).join(' · ');
    return z || '—';
  }

  trackByProjectId = (_: number, row: VmRow) =>
    (row.project as any).id ?? `${(row.project as any).artistId}-${(row.project as any).clientId}-${(row.project as any).title}`;

  titleOf(p: TattooProject): string {
    return String((p as any).title ?? (p as any).name ?? '').trim() || 'Progetto';
  }

  updatedAtOf(p: TattooProject): string {
    return String((p as any).updatedAt ?? (p as any).updateAt ?? '').trim();
  }

  styleLabel(p: TattooProject): string {
    return String((p as any).style ?? (p as any).genere ?? '').trim();
  }

  subjectLabel(p: TattooProject): string {
    return String((p as any).subject ?? '').trim();
  }

  imageUrlsOf(p: TattooProject): string[] {
    const listA = Array.isArray((p as any).imageUrls) ? (p as any).imageUrls : [];
    const listB = Array.isArray((p as any).copertine) ? (p as any).copertine : [];
    const finalImgs = Array.isArray((p as any).finalImages)
      ? (p as any).finalImages.map((i: any) => String(i?.url ?? '').trim()).filter(Boolean)
      : [];
    const all = [...finalImgs, ...listA, ...listB].map(x => String(x ?? '').trim()).filter(Boolean);
    return all.length ? Array.from(new Set(all)) : [];
  }

  // -----------------------------
  // internals
  // -----------------------------
  private clientLabel(c?: Client, fallbackId?: string): string {
    const name = `${c?.name ?? ''} ${c?.surname ?? ''}`.trim();
    return name || c?.email || c?.phone || fallbackId || '—';
  }

  private num(v: any): number | undefined {
    const x = Number(v);
    return isFinite(x) ? x : undefined;
  }

  private sumSessionsPrice(sessions: UiSession[]): number | undefined {
    if (!sessions?.length) return undefined;
    let sum = 0;
    let has = false;
    for (const s of sessions) {
      const p = this.num((s as any).price);
      if (p != null) { sum += p; has = true; }
    }
    return has ? sum : undefined;
  }

  private normalizeSessionForUi(s: Session & any): UiSession {
    const startIso = this.normalizeLocalDateTime(String(s.start ?? s.date ?? '').trim());
    let endIso = this.normalizeLocalDateTime(String(s.end ?? '').trim());

    // durata (se mai la aggiungi in futuro)
    const duration = this.num(s.durationMinutes ?? s._durationMin);

    if (!endIso && startIso && duration != null) {
      const d = new Date(startIso);
      if (!isNaN(d.getTime())) {
        const e = new Date(d);
        e.setMinutes(e.getMinutes() + duration);
        endIso = this.toLocalDateTime(e);
      }
    }

    return {
      ...(s as any),
      status: this.normalizeSessionStatus((s as any).status),
      _startIso: startIso || undefined,
      _endIso: endIso || undefined,
      _start: startIso ? this.formatLocal(startIso) : '—',
      _end: endIso ? this.formatLocal(endIso) : undefined,
      _durationMin: duration ?? undefined,
    };
  }

  private normalizeSessionStatus(status: any): string {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'done') return 'completed';
    return s || 'planned';
  }

  private normalizeLocalDateTime(input: string): string {
    if (!input) return '';
    let s = String(input).replace('Z', '');
    s = s.split('.')[0];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    const d = new Date(input);
    if (!isNaN(d.getTime())) return this.toLocalDateTime(d);
    return s;
  }

  private formatLocal(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private toTimestamp(iso?: string): number {
    if (!iso) return 0;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  private toLocalDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }
}
