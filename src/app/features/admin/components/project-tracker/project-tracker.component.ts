import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, combineLatest, from, map, of, startWith, switchMap } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { MatDialog } from '@angular/material/dialog';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

import { ProjectsService, TattooProject, ProjectStatus } from '../../../../core/services/projects/projects.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { SessionService, Session } from '../../../../core/services/session/session.service';
import { StaffService, StaffMember } from '../../../../core/services/staff/staff.service';
import { ClientService, Client } from '../../../../core/services/clients/client.service';
import { DateTimeHelperService } from '../../../../core/services/helpers/date-time-helper.service';
import { CurrencyHelperService } from '../../../../core/services/helpers/currency-helper.service';
import { BackofficeAccessService } from '../../../../core/services/helpers/backoffice-access.service';
import { StatusHelperService } from '../../../../core/services/helpers/status-helper.service';
import { Database, onValue, ref } from '@angular/fire/database';

import { ProjectTrackerProjectDialogComponent } from './project-tracker-project-dialog/project-tracker-project-dialog.component';

type BookingRow = any;

type UiSession = Session & {
  _startLabel?: string;
  _endLabel?: string;
  _startIso?: string;
  _endIso?: string;
  _durationMin?: number;
  _zoneLabel?: string;
};

type PaymentRow = {
  id: string;
  amount?: number;
  status?: string;
  projectId?: string;
  bookingId?: string;
};

type Vm = {
  project?: TattooProject;
  booking?: BookingRow;
  sessions: UiSession[];
  paidTotal: number;
  expectedTotal?: number;
  remaining?: number;
  loading: boolean;
  notFound: boolean;

  artistName: string;
  clientName: string;
};

@Component({
  selector: 'app-project-tracker',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './project-tracker.component.html',
  styleUrls: ['./project-tracker.component.scss']
})
export class ProjectTrackerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(UiFeedbackService);

  private readonly projectsService = inject(ProjectsService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly staffService = inject(StaffService);
  private readonly clientService = inject(ClientService);
  private readonly dateTime = inject(DateTimeHelperService);
  private readonly currency = inject(CurrencyHelperService);
  private readonly access = inject(BackofficeAccessService);
  private readonly status = inject(StatusHelperService);
  private readonly db = inject(Database);

  // ---------- lookups ----------
  readonly staffMap$ = this.staffService.getAllStaff().pipe(
    map(list => {
      const m = new Map<string, StaffMember>();
      (list ?? []).forEach(s => { if (s?.id) m.set(String(s.id), s); });
      return m;
    })
  );

  // NOTE: qui assumo che clientService.getClients() ritorni Observable<Client[]>
  readonly clientMap$ = this.clientService.getClients().pipe(
    map(list => {
      const m = new Map<string, Client>();
      (list ?? []).forEach(c => { if (c?.id) m.set(String(c.id), c); });
      return m;
    })
  );

  // ---------- projectId da route ----------
  readonly projectId$ = this.route.paramMap.pipe(
    map(pm => String(pm.get('projectId') ?? pm.get('id') ?? '').trim()),
    startWith(String(this.route.snapshot.paramMap.get('projectId') ?? this.route.snapshot.paramMap.get('id') ?? '').trim())
  );

  private payments$() {
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
        err => {
          const code = String((err as any)?.code ?? '').toLowerCase();
          if (code.includes('permission_denied')) {
            obs.next([]);
            return;
          }
          obs.error(err);
        }
      );
      return () => unsub();
    });
  }

  // ---------- VM ----------
  readonly vm$ = combineLatest([
    this.projectId$,
    this.staffMap$,
    this.clientMap$,
    this.bookingService.getAllBookings(),
    this.sessionService.getAll({ onlyOnce: false }),
    this.payments$()
  ]).pipe(
    switchMap(([projectId, staffMap, clientMap, bookings, sessions, payments]) => {
      if (!projectId) {
        return of<Vm>({
          project: undefined,
          booking: undefined,
          sessions: [],
          paidTotal: 0,
          loading: false,
          notFound: true,
          artistName: '-',
          clientName: '-'
        });
      }

      return from(this.projectsService.getProjectById(projectId)).pipe(
        map(project => {
          if (!project) {
            return {
              project: undefined,
              booking: undefined,
              sessions: [],
              paidTotal: 0,
              loading: false,
              notFound: true,
              artistName: '-',
              clientName: '-'
            } as Vm;
          }

          const bookingId = String((project as any).bookingId ?? '').trim();
          const bookingById = new Map<string, any>();
          (bookings ?? []).forEach((b: any) => {
            const bid = String(b?.id ?? '').trim();
            if (bid) bookingById.set(bid, b);
          });

          const bookingByProject = (bookings ?? []).find((b: any) =>
            String(b?.projectId ?? '').trim() === String(project.id ?? '').trim()
          );

          const booking = (bookingId && bookingById.get(bookingId)) || bookingByProject || undefined;

          const pid = String(project.id ?? '').trim();
          const projectSessions = (sessions ?? [])
            .filter((s: any) => {
              const sid = String(s?.projectId ?? '').trim();
              if (sid) return sid === pid;
              const bid = String(s?.bookingId ?? '').trim();
              if (!bid) return false;
              const b = bookingById.get(bid);
              return String((b as any)?.projectId ?? '').trim() === pid;
            })
            .map(s => this.normalizeSessionForUi(s as any))
            .sort((a, b) => this.dateTime.toTimestamp(a._startIso) - this.dateTime.toTimestamp(b._startIso));

          const artistName = this.artistLabel(String((project as any).artistId ?? ''), staffMap);
          const clientName = this.clientLabel(String((project as any).clientId ?? ''), clientMap);

          const expectedTotal =
            this.num((project as any).estimatedPrice) ??
            this.num((project as any).price) ??
            (booking ? this.num((booking as any).price) : undefined) ??
            this.sumSessionsPrice(projectSessions);

          const payList =
            (pid
              ? (payments ?? []).filter((x: any) => String((x as any)?.projectId ?? '').trim() === pid)
              : []
            ).concat(
              booking
                ? (payments ?? []).filter((x: any) =>
                    String((x as any)?.bookingId ?? '').trim() === String((booking as any)?.id ?? '').trim()
                  )
                : []
            );

          const seenPay = new Set<string>();
          const paymentsUniq = payList.filter((x: any) => {
            const id = String((x as any)?.id ?? '').trim();
            if (!id) return false;
            if (seenPay.has(id)) return false;
            seenPay.add(id);
            return true;
          });

          const paidTotal = paymentsUniq
            .filter((x: any) => {
              const s = String((x as any)?.status ?? '').toLowerCase();
              return s === 'succeeded' || s === 'paid';
            })
            .reduce((sum: number, x: any) => sum + (Number((x as any)?.amount ?? 0) || 0), 0);

          const remaining = expectedTotal != null ? Math.max(0, expectedTotal - paidTotal) : undefined;

          return {
            project,
            booking,
            sessions: projectSessions,
            paidTotal,
            expectedTotal,
            remaining,
            loading: false,
            notFound: false,
            artistName,
            clientName
          } as Vm;
        }),
        startWith({
          project: undefined,
          booking: undefined,
          sessions: [],
          paidTotal: 0,
          loading: true,
          notFound: false,
          artistName: '-',
          clientName: '-'
        } as Vm)
      );
    })
  );

  // ---------- TEMPLATE HELPERS ----------
  sessionPrice(s: UiSession): number | null {
    const x = this.num((s as any)?.price);
    return x ?? null;
  }

  sessionPaid(s: UiSession): number | null {
    const x = this.num((s as any)?.paidAmount);
    return x ?? null;
  }

  sessionNotes(s: UiSession): string {
    return String((s as any)?.notesByAdmin ?? (s as any)?.notes ?? '').trim();
  }

  sessionZone(s: UiSession): string {
    return String((s as any)?.zone ?? '').trim();
  }

  bookingWhenLabel(b: any): string {
    if (!b) return '-';
    const start = this.dateTime.normalizeLocalDateTime(String(b.start ?? b.date ?? '').trim());
    const end = this.dateTime.normalizeLocalDateTime(String(b.end ?? '').trim());
    if (!start) return '-';
    return end ? `${this.dateTime.formatLocalDateTime(start)} -> ${this.dateTime.formatLocalDateTime(end)}` : this.dateTime.formatLocalDateTime(start);
  }

  money(n: any): string {
    return this.currency.formatEur(n, '-');
  }

  projectStatusLabel(status: unknown): string {
    const label = this.status.projectLabel(status, 'admin');
    return label === 'N/A' ? (String(status ?? '').trim() || '-') : label;
  }

  projectStatusClass(status: unknown): string {
    return this.status.projectStatusKey(status);
  }

  bookingStatusLabel(status: unknown): string {
    const key = this.status.bookingStatusKey(status);
    return key ? this.status.bookingLabel(status) : '-';
  }

  sessionStatusLabel(status: unknown): string {
    return this.status.sessionLabel(status);
  }

  sessionStatusClass(status: unknown): string {
    return this.status.sessionStatusKey(status);
  }

  trackBySession = (index: number, s: UiSession) => String((s as any)?.id ?? index);

  openProjectManagerLink(): any[] {
    return [this.access.getBackofficeBase(), 'project-manager'];
  }

  openClientsLink(): any[] {
    return [this.access.getBackofficeBase(), 'clients'];
  }

  clientFilterParams(clientId: string | undefined | null): Record<string, string> {
    const id = String(clientId ?? '').trim();
    if (!id) return {};
    return { userId: id, q: id };
  }

  async editBooking(b: any) {
    if (!this.access.hasStaffPermission('canManageBookings')) {
      this.snackBar.open('Permesso mancante: gestione prenotazioni.', 'OK', { duration: 2200 });
      return;
    }
    const bookingId = String(b?.id ?? '').trim();
    if (bookingId) {
      void this.openCalendarDrawer({
        open: 'edit-booking',
        bookingId
      });
      return;
    }

    const project = await this.getCurrentProjectForCalendarSeed();
    if (!project) return;

    const title = String((project as any)?.title ?? '').trim();
    const zone = String((project as any)?.zone ?? '').trim();
    const notes = String((project as any)?.notes ?? '').trim();
    const artistId = String((project as any)?.artistId ?? '').trim();
    const clientId = String((project as any)?.clientId ?? '').trim();
    const notesSeed = [title ? `Progetto: ${title}` : '', zone ? `Zona: ${zone}` : '', notes]
      .filter(Boolean)
      .join(' | ');

    void this.openCalendarDrawer({
      open: 'create-booking',
      projectId: String((project as any).id ?? '').trim(),
      artistId: artistId || undefined,
      clientId: clientId || undefined,
      zone: zone || undefined,
      notes: notesSeed || undefined
    });
  }

  async addSession() {
    if (!this.access.hasStaffPermission('canManageSessions')) {
      this.snackBar.open('Permesso mancante: gestione sedute.', 'OK', { duration: 2200 });
      return;
    }
    const project = await this.getCurrentProjectForCalendarSeed();
    if (!project) return;

    const artistId = String((project as any)?.artistId ?? '').trim();
    const clientId = String((project as any)?.clientId ?? '').trim();

    void this.openCalendarDrawer({
      open: 'create-session',
      projectId: String((project as any).id ?? '').trim(),
      artistId: artistId || undefined,
      clientId: clientId || undefined
    });
  }

  editSession(s: UiSession) {
    if (!this.access.hasStaffPermission('canManageSessions')) {
      this.snackBar.open('Permesso mancante: gestione sedute.', 'OK', { duration: 2200 });
      return;
    }
    const sessionId = String((s as any)?.id ?? '').trim();
    if (!sessionId) return;
    void this.openCalendarDrawer({
      open: 'edit-session',
      sessionId
    });
  }

  async editProject(project: TattooProject) {
    if (!this.access.hasStaffPermission('canManageProjects')) {
      this.snackBar.open('Permesso mancante: gestione progetti.', 'OK', { duration: 2200 });
      return;
    }
    const ref = this.dialog.open(ProjectTrackerProjectDialogComponent, {
      width: '520px',
      maxWidth: '92vw',
      data: { project }
    });
    const res = await ref.afterClosed().toPromise();
    if (!res) return;
    try {
      await this.projectsService.updateProject(String((project as any).id), res);
      this.snackBar.open('Progetto aggiornato', 'OK', { duration: 2200 });
    } catch {
      this.snackBar.open('Errore aggiornamento progetto', 'OK', { duration: 2500 });
    }
  }

  async setProjectStatus(project: TattooProject, status: ProjectStatus) {
    if (!project) return;
    if (!this.access.hasStaffPermission('canManageProjects')) {
      this.snackBar.open('Permesso mancante: gestione progetti.', 'OK', { duration: 2200 });
      return;
    }
    try {
      await this.projectsService.updateProject(String((project as any).id), { status });
      this.snackBar.open('Stato progetto aggiornato', 'OK', { duration: 2200 });
    } catch {
      this.snackBar.open('Errore aggiornamento stato progetto', 'OK', { duration: 2500 });
    }
  }

  private artistLabel(artistId: string, staffMap: Map<string, StaffMember>): string {
    const id = String(artistId ?? '').trim();
    if (!id) return '-';
    const a = staffMap.get(id);
    return (a?.name ?? '').trim() || id;
  }

  private clientLabel(clientId: string, clientMap: Map<string, Client>): string {
    const id = String(clientId ?? '').trim();
    if (!id) return '-';
    const c = clientMap.get(id);
    const full = `${(c as any)?.name ?? ''} ${(c as any)?.surname ?? ''}`.trim();
    return full || (c as any)?.email || (c as any)?.phone || id;
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
    const startIso = this.dateTime.normalizeLocalDateTime(String(s.start ?? s.date ?? '').trim());
    let endIso = this.dateTime.normalizeLocalDateTime(String(s.end ?? '').trim());

    const duration = this.num(s.durationMinutes);
    if (!endIso && startIso && duration != null) {
      const d = new Date(startIso);
      if (!isNaN(d.getTime())) {
        const e = new Date(d);
        e.setMinutes(e.getMinutes() + duration);
        endIso = this.dateTime.toLocalDateTime(e);
      }
    }

    return {
      ...(s as any),
      status: this.status.sessionStatusKey((s as any).status),
      _startIso: startIso || undefined,
      _endIso: endIso || undefined,
      _startLabel: startIso ? this.dateTime.formatLocalDateTime(startIso) : '-',
      _endLabel: endIso ? this.dateTime.formatLocalDateTime(endIso) : undefined,
      _durationMin: duration ?? undefined,
      _zoneLabel: String(s.zone ?? '').trim() || undefined
    };
  }

  private async getCurrentProjectForCalendarSeed(): Promise<TattooProject | null> {
    const projectId = String((this.route.snapshot.paramMap.get('projectId') ?? this.route.snapshot.paramMap.get('id') ?? '')).trim();
    if (!projectId) {
      this.snackBar.open('ID progetto non valido.', 'OK', { duration: 2200 });
      return null;
    }
    const project = await this.projectsService.getProjectById(projectId);
    if (!project) {
      this.snackBar.open('Progetto non trovato.', 'OK', { duration: 2200 });
      return null;
    }
    return project;
  }

  private openCalendarDrawer(queryParams: Record<string, string | undefined>) {
    const cleaned = Object.fromEntries(
      Object.entries(queryParams).filter(([, value]) => String(value ?? '').trim().length > 0)
    );
    return this.router.navigate([`${this.access.getBackofficeBase()}/calendar`], { queryParams: cleaned });
  }
}


