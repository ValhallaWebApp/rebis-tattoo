import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';

import { CalendarShellComponent } from './calendar-shell/calendar-shell.component';
import { CreateDraft, UiArtist, UiCalendarEvent, UpdatePatch } from './models';
import { StaffService, StaffMember } from '../../core/services/staff/staff.service';
import { Booking, BookingService, BookingStatus } from '../../core/services/bookings/booking.service';
import { Session, SessionService } from '../../core/services/session/session.service';
import { MaterialModule } from '../../core/modules/material.module';
import { UiFeedbackService } from '../../core/services/ui/ui-feedback.service';
import { ProjectsService } from '../../core/services/projects/projects.service';


@Component({
  selector: 'app-calendar-admin-v2',
  standalone: true,
  imports: [CommonModule, CalendarShellComponent, MaterialModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent {
  private readonly staffService = inject(StaffService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly snackBar = inject(UiFeedbackService);
  private readonly projectService = inject(ProjectsService);

  // --- STATE ---
  readonly loading = signal(true);

  readonly artists = signal<UiArtist[]>([]);
  readonly events = signal<UiCalendarEvent[]>([]);

  // --- FETCH ---
  constructor() {
    // 1) staff
    this.staffService.getAllStaff()
      .pipe(
        map((list: StaffMember[]) =>
          (list ?? [])
            .filter(s => s?.id)
            .map(s => ({
              id: String(s.id),
              name: s.name,
              photoUrl: s.photoUrl,
              isActive: s.isActive !== false,
              calendarEnabled: (s.calendar?.enabled !== false),
              workdayStart: s.calendar?.workdayStart ?? '08:00',
              workdayEnd: s.calendar?.workdayEnd ?? '20:00',
              stepMinutes: Number(s.calendar?.stepMinutes ?? 30),
              color: s.calendar?.color ?? '#be9045',
            }))
        )
      )
      .subscribe({
        next: (artists) => {
          this.artists.set(artists);
        },
        error: () => {
          this.artists.set([]);
        }
      });

    // 2) bookings + sessions

    const bookings$ = this.bookingService.getAllBookings();
    const sessions$ = this.sessionService.getAll();

    // merge manuale senza combineLatest per evitare import aggiuntivi
    let lastBookings: Booking[] = [];
    let lastSessions: Session[] = [];

    bookings$.subscribe({
      next: (bookings: Booking[]) => {
        lastBookings = bookings ?? [];
        this.rebuildEvents(lastBookings, lastSessions);
      },
      error: (error: unknown) => {
        console.error('[CAL-ADMIN-V2] bookings error', error);
        lastBookings = [];
        this.rebuildEvents(lastBookings, lastSessions);
      },
    });

    sessions$.subscribe({
      next: (sessions: Session[]) => {
        lastSessions = sessions ?? [];
        this.rebuildEvents(lastBookings, lastSessions);
      },
      error: (error: unknown) => {
        console.error('[CAL-ADMIN-V2] sessions error', error);
        lastSessions = [];
        this.rebuildEvents(lastBookings, lastSessions);
      },
    });
  }

  private rebuildEvents(bookings: Booking[], sessions: Session[]) {
    const staffMap = new Map(this.artists().map(a => [a.id, a]));

    const mappedBookings: UiCalendarEvent[] = (bookings ?? [])
      .filter(b => b?.id && b?.artistId && b?.start && b?.end)
      .map(b => {
        const start = this.formatLocal(new Date(b.start));
        const end = this.formatLocal(new Date(b.end));
        const durationMinutes = this.diffMinutes(start, end);
        const a = staffMap.get(String(b.artistId));
        const createdById = String(b.createdById ?? '').trim() || undefined;
        const zone = String((b as Booking & { zone?: string }).zone ?? '').trim() || undefined;
        return {
          id: String(b.id),
          type: 'booking',
          artistId: String(b.artistId),
          start,
          end,
          durationMinutes,
          clientId: b.clientId ? String(b.clientId) : undefined,
          projectId: b.projectId ? String(b.projectId) : undefined,
          status: b.status ? String(b.status) : undefined,
          notes: b.notes ? String(b.notes) : undefined,
          zone,
          createdById,
          title: 'Consulenza',
          subtitle: a?.name,
        } satisfies UiCalendarEvent;
      });

    const mappedSessions: UiCalendarEvent[] = (sessions ?? [])
      .filter(s => s?.id && s?.artistId && s?.start && s?.end)
      .map(s => {
        const start = this.formatLocal(new Date(String(s.start)));
        const end = this.formatLocal(new Date(String(s.end)));
        const duration = this.diffMinutes(start, end);

        const a = staffMap.get(String(s.artistId));
        return {
          id: String(s.id),
          type: 'session',
          artistId: String(s.artistId),
          start,
          end,
          durationMinutes: duration,
          sessionNumber: s.sessionNumber != null ? Number(s.sessionNumber) : undefined,
          clientId: s.clientId ? String(s.clientId) : undefined,
          projectId: s.projectId ? String(s.projectId) : undefined,
          bookingId: s.bookingId ? String(s.bookingId) : undefined,
          status: s.status ? String(s.status) : undefined,
          notes: s.notesByAdmin ? String(s.notesByAdmin) : undefined,
          notesByAdmin: s.notesByAdmin ? String(s.notesByAdmin) : undefined,
          healingNotes: s.healingNotes ? String(s.healingNotes) : undefined,
          painLevel: s.painLevel != null ? Number(s.painLevel) : undefined,
          paidAmount: s.paidAmount != null ? Number(s.paidAmount) : undefined,
          zone: s.zone ? String(s.zone).trim() || undefined : undefined,
          title: 'Seduta',
          subtitle: a?.name,
        } satisfies UiCalendarEvent;
      });

    this.events.set([...mappedBookings, ...mappedSessions]);
    this.loading.set(false);
  }

  private diffMinutes(startISO: string, endISO: string): number {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  private formatLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // --- HANDLERS from Calendar ---
  async onCreateRequested(draft: CreateDraft) {
    if (!draft) return;

    try {
      const deferBookingConflictCheck = draft.type === 'booking' && String(draft.projectId ?? '').trim().length > 0;
      if (!deferBookingConflictCheck && this.hasConflict(draft.artistId, draft.start, draft.end)) {
        console.warn('[CAL-ADMIN-V2] create blocked: slot not available', {
          artistId: draft.artistId,
          start: draft.start,
          end: draft.end
        });
        this.showConflictMessage();
        return;
      }

      if (draft.type === 'booking') {
        const projectId = String(draft.projectId ?? '').trim();
        let resolvedArtistId = String(draft.artistId ?? '').trim();
        let resolvedClientId = String(draft.clientId ?? '').trim();

        if (projectId) {
          const project = await this.projectService.getProjectById(projectId);
          if (project) {
            const projectArtistId = String(project.artistId ?? '').trim();
            const projectClientId = String(project.clientId ?? '').trim();
            if (projectArtistId) resolvedArtistId = projectArtistId;
            if (projectClientId) resolvedClientId = projectClientId;
          }
        }

        if (this.hasConflict(resolvedArtistId, draft.start, draft.end)) {
          console.warn('[CAL-ADMIN-V2] create blocked: slot not available', {
            artistId: resolvedArtistId,
            start: draft.start,
            end: draft.end
          });
          this.showConflictMessage();
          return;
        }

        // ⚠️ adatta al tuo BookingService
        const payload: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
          artistId: resolvedArtistId,
          clientId: resolvedClientId,
          title: 'Prenotazione',
          start: draft.start,
          end: draft.end,
          projectId: projectId || undefined,
          notes: draft.notes ?? undefined,
          status: this.toBookingStatus(draft.status),
          type: 'consultation',
        };

        await this.bookingService.createBooking(payload);

        // BookingService already syncs project.bookingId when projectId is provided.
      }

      if (draft.type === 'session') {
        const projectId = String(draft.projectId ?? '').trim();
        if (!projectId) {
          this.snackBar.open('Una seduta richiede un progetto di riferimento.', 'OK', {
            duration: 2800,
            horizontalPosition: 'right',
            verticalPosition: 'bottom'
          });
          return;
        }
        if (projectId) {
          const guard = this.validateSessionSequence({
            projectId,
            start: draft.start,
            sessionNumber: draft.sessionNumber
          });
          if (!guard.ok) {
            this.snackBar.open(guard.message, 'OK', {
              duration: 2800,
              horizontalPosition: 'right',
              verticalPosition: 'bottom'
            });
            return;
          }
        }

        // ⚠️ adatta al tuo SessionService
        

        const payload: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> = {
          artistId: draft.artistId,
          start: draft.start,
          end: draft.end,
          clientId: draft.clientId ?? undefined,
          projectId: draft.projectId ?? undefined,
          bookingId: draft.bookingId ?? undefined,
          sessionNumber: draft.sessionNumber ?? undefined,
          painLevel: draft.painLevel ?? undefined,
          healingNotes: draft.healingNotes ?? undefined,
          zone: draft.zone ?? undefined,
          notesByAdmin: draft.notesByAdmin ?? (draft.notes ?? undefined),
          paidAmount: draft.paidAmount ?? undefined,
          status: this.toSessionStatus(draft.status),
        };

        await this.sessionService.create(payload);
      }

    } catch (e) {
      console.error('[CAL-ADMIN-V2] create failed', e);
      this.showOpError(e, 'Errore creazione evento.');
    }
  }

  async onUpdateRequested(upd: UpdatePatch) {
    if (!upd?.id) return;

    try {
      const current = this.findEventById(upd.id);
      const nextStart = String(upd.patch.start ?? '');
      const nextEnd = String(upd.patch.end ?? '');
      const nextArtistId = String(upd.patch.artistId ?? current?.artistId ?? '');
      const currentStart = String(current?.start ?? '');
      const currentEnd = String(current?.end ?? '');
      const currentArtistId = String(current?.artistId ?? '');

      if (upd.type === 'session') {
        const nextProjectId = String(upd.patch.projectId ?? current?.projectId ?? '').trim();
        if (!nextProjectId) {
          this.snackBar.open('Una seduta richiede un progetto di riferimento.', 'OK', {
            duration: 2800,
            horizontalPosition: 'right',
            verticalPosition: 'bottom'
          });
          return;
        }
      }

      const scheduleChanged =
        this.changedAtMinutePrecision(nextStart, currentStart) ||
        this.changedAtMinutePrecision(nextEnd, currentEnd) ||
        String(nextArtistId) !== String(currentArtistId);

      if (scheduleChanged && nextStart && nextEnd) {
        if (this.hasConflict(nextArtistId, nextStart, nextEnd, upd.id)) {
          console.warn('[CAL-ADMIN-V2] update blocked: slot not available', {
            id: upd.id,
            start: nextStart,
            end: nextEnd
          });
          this.showConflictMessage();
          return;
        }
      }

      const patch = this.stripUndef({ ...upd.patch, updatedAt: new Date().toISOString() });

      if (upd.type === 'booking') {
        const bookingPatch = this.toBookingPatch(patch);
        const requestedStatusRaw = typeof patch.status === 'string'
          ? patch.status.trim()
          : '';
        const currentStatus = String(current?.status ?? '').trim();
        const hasStatusChange = requestedStatusRaw.length > 0 && requestedStatusRaw !== currentStatus;

        if (hasStatusChange) {
          const nextStatus = this.parseBookingStatus(requestedStatusRaw);
          if (!nextStatus) {
            this.snackBar.open('Stato consulenza non valido.', 'OK', {
              duration: 2800,
              horizontalPosition: 'right',
              verticalPosition: 'bottom'
            });
            return;
          }
          const extra = this.stripUndef({ ...bookingPatch });
          delete extra.status;

          const res = await this.bookingService.safeSetStatusSafe(
            upd.id,
            nextStatus,
            extra
          );
          if (!res.ok) {
            this.snackBar.open(res.error, 'OK', {
              duration: 2800,
              horizontalPosition: 'right',
              verticalPosition: 'bottom'
            });
            return;
          }
        } else {
          await this.bookingService.updateBooking(upd.id, bookingPatch);
        }
      }

      if (upd.type === 'session') {
        const sessionPatch = this.toSessionPatch(patch);
        const currentProjectId = String(current?.projectId ?? '').trim();
        const nextProjectId = String(sessionPatch.projectId ?? current?.projectId ?? '').trim();
        const projectChanged = nextProjectId !== currentProjectId;
        const startChanged = this.changedAtMinutePrecision(
          String(sessionPatch.start ?? current?.start ?? ''),
          String(current?.start ?? '')
        );
        const currentSessionNumber =
          current?.sessionNumber == null ? null : Number(current.sessionNumber);
        const nextSessionNumber =
          sessionPatch.sessionNumber == null ? currentSessionNumber : Number(sessionPatch.sessionNumber);
        const sessionNumberChanged =
          nextSessionNumber != null &&
          currentSessionNumber != null &&
          nextSessionNumber !== currentSessionNumber;

        const needsSequenceCheck = projectChanged || startChanged || sessionNumberChanged;

        if (needsSequenceCheck) {
          const projectId = String(nextProjectId ?? '').trim();
          if (projectId) {
            const start = String(sessionPatch.start ?? current?.start ?? '');
            const sessionNumber = nextSessionNumber ?? undefined;
            const guard = this.validateSessionSequence({
              projectId,
              start,
              sessionNumber,
              excludeId: upd.id
            });
            if (!guard.ok) {
              this.snackBar.open(guard.message, 'OK', {
                duration: 2800,
                horizontalPosition: 'right',
                verticalPosition: 'bottom'
              });
              return;
            }
          }
        }

        await this.sessionService.update(upd.id, sessionPatch);
      }

    } catch (e) {
      console.error('[CAL-ADMIN-V2] update failed', e);
      this.showOpError(e, 'Errore aggiornamento evento.');
    }
  }

  private parseBookingStatus(value: unknown): BookingStatus | undefined {
    const raw = String(value ?? '').trim();
    const allowed: BookingStatus[] = [
      'draft',
      'pending',
      'confirmed',
      'paid',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    ];
    return (allowed as string[]).includes(raw) ? (raw as BookingStatus) : undefined;
  }

  private toBookingStatus(value: unknown): BookingStatus {
    return this.parseBookingStatus(value) ?? 'confirmed';
  }

  private toSessionStatus(value: unknown): Session['status'] {
    const raw = String(value ?? '').trim();
    if (raw === 'planned' || raw === 'completed' || raw === 'cancelled') {
      return raw;
    }
    return 'planned';
  }

  private toBookingPatch(patch: UpdatePatch['patch'] & { updatedAt?: string }): Partial<Booking> {
    return this.stripUndef({
      artistId: patch.artistId,
      clientId: patch.clientId,
      projectId: patch.projectId,
      start: patch.start,
      end: patch.end,
      notes: patch.notes,
      status: this.parseBookingStatus(patch.status),
      updatedAt: patch.updatedAt,
    });
  }

  private toSessionPatch(patch: UpdatePatch['patch'] & { updatedAt?: string }): Partial<Session> {
    return this.stripUndef({
      artistId: patch.artistId,
      clientId: patch.clientId,
      projectId: patch.projectId,
      bookingId: patch.bookingId,
      start: patch.start,
      end: patch.end,
      sessionNumber: patch.sessionNumber,
      notesByAdmin: patch.notesByAdmin ?? patch.notes,
      healingNotes: patch.healingNotes,
      painLevel: patch.painLevel,
      paidAmount: patch.paidAmount,
      zone: patch.zone,
      status: patch.status ? this.toSessionStatus(patch.status) : undefined,
      updatedAt: patch.updatedAt,
    });
  }

  private showOpError(err: unknown, fallback: string): void {
    const messageFromError = err instanceof Error
      ? err.message
      : String((err as { message?: unknown } | null)?.message ?? '');
    const raw = messageFromError.trim();
    let msg = fallback;

    if (raw.startsWith('PERMISSION_DENIED:')) {
      msg = 'Permesso mancante per eseguire questa operazione.';
    } else if (raw.startsWith('PROJECT_BOOKING_CONFLICT:')) {
      msg = 'Il progetto selezionato ha già una prenotazione collegata.';
    } else if (raw.startsWith('PROJECT_ARTIST_MISMATCH:')) {
      msg = 'Artista non coerente col progetto selezionato.';
    } else if (raw.startsWith('PROJECT_CLIENT_MISMATCH:')) {
      msg = 'Cliente non coerente col progetto selezionato.';
    } else if (raw.startsWith('PROJECT_NOT_FOUND:')) {
      msg = 'Progetto non trovato.';
    } else if (raw.startsWith('SESSION_BOOKING_REQUIRED:')) {
      msg = 'Prima di creare una seduta devi collegare una consulenza al progetto.';
    } else if (raw.startsWith('SESSION_BOOKING_NOT_FOUND:')) {
      msg = 'Consulenza collegata al progetto non trovata.';
    } else if (raw.startsWith('SESSION_BOOKING_END_INVALID:')) {
      msg = 'Data fine consulenza non valida: impossibile pianificare la seduta.';
    } else if (raw.startsWith('SESSION_BEFORE_BOOKING_END:')) {
      const endIso = raw.split(':').slice(1).join(':').trim();
      const endDate = new Date(endIso);
      const when = Number.isNaN(endDate.getTime()) ? endIso : this.formatLocal(endDate);
      msg = `La seduta non puo iniziare prima della fine consulenza (${when}).`;
    } else if (raw) {
      // fallback to message if it's readable (avoid dumping big objects)
      msg = raw.length > 160 ? fallback : raw;
    }

    this.snackBar.open(msg, 'OK', {
      duration: 3200,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }

  private stripUndef<T extends Record<string, unknown>>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) out[key] = obj[key];
    }
    return out as T;
  }

  private hasConflict(artistId: string, startISO: string, endISO: string, excludeId?: string): boolean {
    if (!artistId || !startISO || !endISO) return false;
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

    const nonBlockingStatuses = new Set(['cancelled', 'no_show']);
    const events = this.events();
    return events.some(ev => {
      if (excludeId && ev.id === excludeId) return false;
      if (String(ev.artistId) !== String(artistId)) return false;
      const status = String(ev.status ?? '').trim().toLowerCase();
      if (nonBlockingStatuses.has(status)) return false;
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) return false;
      return start < evEnd && end > evStart;
    });
  }

  private findEventById(id: string): UiCalendarEvent | undefined {
    return this.events().find(e => e.id === id);
  }

  private changedAtMinutePrecision(nextISO: string, currentISO: string): boolean {
    if (!nextISO || !currentISO) return nextISO !== currentISO;
    const next = new Date(nextISO);
    const current = new Date(currentISO);

    if (!Number.isNaN(next.getTime()) && !Number.isNaN(current.getTime())) {
      return Math.floor(next.getTime() / 60000) !== Math.floor(current.getTime() / 60000);
    }

    return String(nextISO).slice(0, 16) !== String(currentISO).slice(0, 16);
  }

  private showConflictMessage(): void {
    this.snackBar.open('Orario non disponibile: esiste già un appuntamento in questo slot.', 'OK', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }

  private validateSessionSequence(params: {
    projectId: string;
    start: string;
    sessionNumber?: number;
    excludeId?: string;
  }): { ok: boolean; message: string } {
    const { projectId, start, sessionNumber, excludeId } = params;

    const sessions = this.events()
      .filter(e => e.type === 'session' && e.projectId === projectId)
      .filter(e => !excludeId || e.id !== excludeId);

    const lastEnd = sessions
      .map(s => new Date(s.end))
      .filter(d => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
      .pop();

    const expectedNumber = (sessions.length || 0) + 1;

    if (sessionNumber != null && Number(sessionNumber) !== expectedNumber) {
      return {
        ok: false,
        message: `Numero seduta non valido. Deve essere ${expectedNumber}.`
      };
    }

    const nextStart = new Date(start);
    if (lastEnd && !Number.isNaN(nextStart.getTime()) && nextStart.getTime() <= lastEnd.getTime()) {
      return {
        ok: false,
        message: `La seduta deve iniziare dopo l’ultima (${this.formatLocal(lastEnd)}).`
      };
    }

    const bookingForProject = this.events()
      .filter(e => e.type === 'booking' && e.projectId === projectId)
      .filter(e => !excludeId || e.id !== excludeId)
      .map(e => new Date(e.end))
      .filter(d => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
      .pop();

    if (!bookingForProject) {
      return {
        ok: false,
        message: 'Collega prima una consulenza al progetto.'
      };
    }

    if (!Number.isNaN(nextStart.getTime()) && nextStart.getTime() < bookingForProject.getTime()) {
      return {
        ok: false,
        message: `La seduta deve iniziare dalla fine consulenza (${this.formatLocal(bookingForProject)}).`
      };
    }

    return { ok: true, message: '' };
  }
}



