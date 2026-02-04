import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { combineLatest, from, map, of, startWith, switchMap } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ProjectsService, TattooProject, ProjectStatus } from '../../../../core/services/projects/projects.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { SessionService, Session } from '../../../../core/services/session/session.service';
import { StaffService, StaffMember } from '../../../../core/services/staff/staff.service';
import { ClientService, Client } from '../../../../core/services/clients/client.service';

import { ProjectTrackerSessionDialogComponent } from './project-tracker-session-dialog/project-tracker-session-dialog.component';
import { ProjectTrackerBookingDialogComponent } from './project-tracker-booking-dialog/project-tracker-booking-dialog.component';
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

type Vm = {
  project?: TattooProject;
  booking?: BookingRow;
  sessions: UiSession[];
  paidTotal: number;      // placeholder (se poi agganci payments)
  expectedTotal?: number; // placeholder (se poi agganci prezzo stimato)
  remaining?: number;     // placeholder
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly projectsService = inject(ProjectsService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly staffService = inject(StaffService);
  private readonly clientService = inject(ClientService);

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

  // ---------- VM ----------
  readonly vm$ = combineLatest([
    this.projectId$,
    this.staffMap$,
    this.clientMap$,
    this.bookingService.getAllBookings(),
    this.sessionService.getAll({ onlyOnce: false })
  ]).pipe(
    switchMap(([projectId, staffMap, clientMap, bookings, sessions]) => {
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
            .sort((a, b) => this.toTimestamp(a._startIso) - this.toTimestamp(b._startIso));

          const artistName = this.artistLabel(String((project as any).artistId ?? ''), staffMap);
          const clientName = this.clientLabel(String((project as any).clientId ?? ''), clientMap);

          const expectedTotal =
            this.num((project as any).estimatedPrice) ??
            this.num((project as any).price) ??
            (booking ? this.num((booking as any).price) : undefined);

          const paidTotal = 0; // se poi agganci payments node, qui lo sommi
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
    const start = this.normalizeLocalDateTime(String(b.start ?? b.date ?? '').trim());
    const end = this.normalizeLocalDateTime(String(b.end ?? '').trim());
    if (!start) return '-';
    return end ? `${this.formatLocal(start)} -> ${this.formatLocal(end)}` : this.formatLocal(start);
  }

  money(n: any): string {
    const x = Number(n);
    if (!isFinite(x)) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
  }

  trackBySession = (index: number, s: UiSession) => String((s as any)?.id ?? index);

  openProjectManagerLink(): any[] {
    return ['/admin', 'project-manager'];
  }

  editBooking(b: any) {
    this.openBookingDialog(b);
  }

  addSession() {
    this.openSessionDialog();
  }

  editSession(s: UiSession) {
    this.openSessionDialog(s);
  }

  async editProject(project: TattooProject) {
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

  private normalizeSessionForUi(s: Session & any): UiSession {
    const startIso = this.normalizeLocalDateTime(String(s.start ?? s.date ?? '').trim());
    let endIso = this.normalizeLocalDateTime(String(s.end ?? '').trim());

    const duration = this.num(s.durationMinutes);
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
      _startLabel: startIso ? this.formatLocal(startIso) : '-',
      _endLabel: endIso ? this.formatLocal(endIso) : undefined,
      _durationMin: duration ?? undefined,
      _zoneLabel: String(s.zone ?? '').trim() || undefined
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

  private async openSessionDialog(session?: UiSession) {
    const projectId = String((this.route.snapshot.paramMap.get('projectId') ?? this.route.snapshot.paramMap.get('id') ?? '')).trim();
    if (!projectId) return;

    const project = await this.projectsService.getProjectById(projectId);
    if (!project) return;

    const ref = this.dialog.open(ProjectTrackerSessionDialogComponent, {
      width: '520px',
      maxWidth: '92vw',
      data: { project, session }
    });

    const res = await ref.afterClosed().toPromise();
    if (!res) return;

    try {
      if (session?.id) {
        const patch = { ...res };
        delete (patch as any).createdAt;
        await this.sessionService.update(session.id, patch);
        this.snackBar.open('Sessione aggiornata', 'OK', { duration: 2200 });
      } else {
        await this.sessionService.create(res);
        this.snackBar.open('Sessione creata', 'OK', { duration: 2200 });
      }
    } catch {
      this.snackBar.open('Errore salvataggio sessione', 'OK', { duration: 2500 });
    }
  }

  private async openBookingDialog(booking?: any) {
    const projectId = String((this.route.snapshot.paramMap.get('projectId') ?? this.route.snapshot.paramMap.get('id') ?? '')).trim();
    if (!projectId) return;
    const project = await this.projectsService.getProjectById(projectId);
    if (!project) return;

    const ref = this.dialog.open(ProjectTrackerBookingDialogComponent, {
      width: '520px',
      maxWidth: '92vw',
      data: { project, booking }
    });
    const res = await ref.afterClosed().toPromise();
    if (!res) return;

    try {
      if (booking?.id) {
        const patch = { ...res };
        delete (patch as any).createdAt;
        await this.bookingService.updateBooking(booking.id, patch);
      } else {
        const created = await this.bookingService.createBooking(res);
        if (created?.id) {
          await this.projectsService.updateProject(projectId, { bookingId: created.id });
        }
      }
      this.snackBar.open('Booking salvata', 'OK', { duration: 2200 });
    } catch {
      this.snackBar.open('Errore salvataggio booking', 'OK', { duration: 2500 });
    }
  }

  private toLocalDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }
}
