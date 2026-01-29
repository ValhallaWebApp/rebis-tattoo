import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { combineLatest, from, map, of, startWith, switchMap } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';

import { ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { SessionService, Session } from '../../../../core/services/session/session.service';
import { StaffService, StaffMember } from '../../../../core/services/staff/staff.service';
import { ClientService, Client } from '../../../../core/services/clients/client.service';

type BookingRow = any;

type UiSession = Session & {
  _startLabel?: string;
  _endLabel?: string;
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
  styleUrl: './project-tracker.component.scss'
})
export class ProjectTrackerComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly projectsService = inject(ProjectsService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly staffService = inject(StaffService);
  private readonly clientService = inject(ClientService);

  // ---------- lookups "parlanti" ----------
  readonly staffMap$ = this.staffService.getAllStaff().pipe(
    map(list => {
      const m = new Map<string, StaffMember>();
      (list ?? []).forEach(s => { if (s?.id) m.set(String(s.id), s); });
      return m;
    })
  );

  // ⚠️ Qui assumo che clientService.getClients() ritorni Observable<Client[]>
  // (come nel tuo esempio Firestore: collectionData('users'))
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
    this.bookingService.getAllBookings(),          // deve esistere già nel tuo progetto
    this.sessionService.getAll({ onlyOnce: false }) // dal tuo SessionService
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
          artistName: '—',
          clientName: '—'
        });
      }

      // ProjectsService.getProjectById è Promise nel tuo service
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
              artistName: '—',
              clientName: '—'
            } as Vm;
          }

          // booking: preferisco bookingId dal project, altrimenti cerco per projectId sul booking
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

          // sessions per projectId
          const pid = String(project.id ?? '').trim();
          const projectSessions = (sessions ?? [])
            .filter((s: any) => String(s?.projectId ?? '').trim() === pid)
            .map(s => this.normalizeSessionForUi(s as any))
            .sort((a, b) => String(a._startLabel ?? '').localeCompare(String(b._startLabel ?? '')));

          // nomi parlanti
          const artistName = this.artistLabel(String((project as any).artistId ?? ''), staffMap);
          const clientName = this.clientLabel(String((project as any).clientId ?? ''), clientMap);

          // soldi: per ora metto placeholder (pagamenti li agganci dopo)
          const expectedTotal =
            this.num((project as any).estimatedPrice) ??
            this.num((project as any).price) ??
            (booking ? this.num((booking as any).price) : undefined);

          const paidTotal = 0; // ← se poi agganci payments node, qui lo sommi
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
          artistName: '—',
          clientName: '—'
        } as Vm)
      );
    })
  );

  // ---------- TEMPLATE SAFE HELPERS (niente cast in HTML) ----------
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
    if (!b) return '—';
    const start = String(b.start ?? b.date ?? '').trim();
    const end = String(b.end ?? '').trim();
    if (!start) return '—';
    return end ? `${start} → ${end}` : start;
  }

  money(n: any): string {
    const x = Number(n);
    if (!isFinite(x)) return '—';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
  }

  // ✅ trackBy corretto
  trackBySession = (index: number, s: UiSession) => String((s as any)?.id ?? index);

  // ---------- NAV ACTIONS (placeholder) ----------
  goBackToManager() {
    // metti qui la tua rotta reale
    // es: this.router.navigate(['/admin/project-manager']);
  }

  openProjectManagerLink(): any[] {
    // usato in template per routerLink
    return ['/admin', 'project-manager'];
  }

  editBooking(b: any) {
    console.log('[TRACKER] edit booking', b?.id);
  }

  addSession() {
    console.log('[TRACKER] add session');
  }

  editSession(s: UiSession) {
    console.log('[TRACKER] edit session', (s as any)?.id);
  }

  // ---------- internal ----------
  private artistLabel(artistId: string, staffMap: Map<string, StaffMember>): string {
    const id = String(artistId ?? '').trim();
    if (!id) return '—';
    const a = staffMap.get(id);
    return (a?.name ?? '').trim() || id;
  }

  private clientLabel(clientId: string, clientMap: Map<string, Client>): string {
    const id = String(clientId ?? '').trim();
    if (!id) return '—';
    const c = clientMap.get(id);
    const full = `${(c as any)?.name ?? ''} ${(c as any)?.surname ?? ''}`.trim();
    return full || (c as any)?.email || (c as any)?.phone || id;
  }

  private num(v: any): number | undefined {
    const x = Number(v);
    return isFinite(x) ? x : undefined;
  }

  private normalizeSessionForUi(s: Session & any): UiSession {
    const start = String(s.start ?? '').trim();
    let end = String(s.end ?? '').trim();

    const duration = this.num(s.durationMinutes);
    if (!end && start && duration != null) {
      const d = new Date(start);
      if (!isNaN(d.getTime())) {
        const e = new Date(d);
        e.setMinutes(e.getMinutes() + duration);
        end = this.toLocalDateTime(e);
      }
    }

    return {
      ...(s as any),
      _startLabel: start || '—',
      _endLabel: end || undefined,
      _durationMin: duration ?? undefined,
      _zoneLabel: String(s.zone ?? '').trim() || undefined
    };
  }

  private toLocalDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }
}
