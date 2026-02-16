import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';

import { CalendarShellComponent } from './calendar-shell/calendar-shell.component';
import { CreateDraft, UiArtist, UiCalendarEvent, UpdatePatch } from './models';
import { StaffService, StaffMember } from '../../core/services/staff/staff.service';
import { BookingService } from '../../core/services/bookings/booking.service';
import { SessionService } from '../../core/services/session/session.service';
import { MaterialModule } from '../../core/modules/material.module';
import { UiFeedbackService } from '../../core/services/ui/ui-feedback.service';
import { ProjectsService } from '../../core/services/projects/projects.service';

// ✅ Adatta questi tipi alle tue interfacce reali se differiscono
type Booking = any;
type Session = any;

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
    // ⚠️ QUI devi adeguare i nomi dei metodi se nel tuo servizio sono diversi.
    // Esempio: this.bookingService.getAllBookings() / getBookings() / listBookings() ecc.

    const bookings$ =
      (this.bookingService as any).getAllBookings?.() ??
      (this.bookingService as any).getAllBookings$?.() ??
      (this.bookingService as any).getBookings?.();

    const sessions$ =
      (this.sessionService as any).getAll?.() ??               // ✅ IL TUO METODO REALE
      (this.sessionService as any).getAllSessions$?.() ??
      (this.sessionService as any).getAllSessions?.() ??
      (this.sessionService as any).getSessions?.();

    // ✅ NON BLOCCARE TUTTO: se manca uno stream, carica l’altro
    if (!bookings$ && !sessions$) {
      console.warn('[CAL-ADMIN-V2] ⚠️ Nessuno stream trovato: bookings/sessions');
      this.loading.set(false);
      return;
    }

    // merge manuale senza combineLatest per evitare import aggiuntivi
    let lastBookings: Booking[] = [];
    let lastSessions: Session[] = [];

    if (bookings$) {
      bookings$.subscribe({
        next: (b: Booking[]) => {
          lastBookings = b ?? [];
          this.rebuildEvents(lastBookings, lastSessions);
        },
        error: (e: any) => {
          console.error('[CAL-ADMIN-V2] bookings error', e);
          lastBookings = [];
          this.rebuildEvents(lastBookings, lastSessions);
        },
      });
    }

    if (sessions$) {
      sessions$.subscribe({
        next: (s: Session[]) => {
          lastSessions = s ?? [];
          this.rebuildEvents(lastBookings, lastSessions);
        },
        error: (e: any) => {
          console.error('[CAL-ADMIN-V2] sessions error', e);
          lastSessions = [];
          this.rebuildEvents(lastBookings, lastSessions);
        },
      });
    }
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
          title: 'Booking',
          subtitle: a?.name,
        } satisfies UiCalendarEvent;
      });

    const mappedSessions: UiCalendarEvent[] = (sessions ?? [])
      .filter(s => s?.id && s?.artistId && (s?.start || s?.date) && (s?.end || s?.durationMinutes))
      .map(s => {
        const start = this.formatLocal(new Date(String(s.start ?? s.date)));
        const duration = s.durationMinutes
          ? Number(s.durationMinutes ?? 0)
          : this.diffMinutes(start, String(s.end ?? ''));
        const end = s.end ? this.formatLocal(new Date(s.end)) : this.buildEndFromStart(start, duration);

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
          notes: s.notesByAdmin ? String(s.notesByAdmin) : (s.notes ? String(s.notes) : undefined),
          title: 'Session',
          subtitle: a?.name,
        } satisfies UiCalendarEvent;
      });

    this.events.set([...mappedBookings, ...mappedSessions]);
    this.loading.set(false);
  }

  private buildEndFromStart(startISO: string, durationMinutes: number): string {
    const d = new Date(startISO);
    d.setMinutes(d.getMinutes() + (durationMinutes || 0));
    return this.formatLocal(d);
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
            const raw: any = project as any;
            const legacyArtistIds = Array.isArray(raw?.artistIds)
              ? raw.artistIds.map((x: any) => String(x ?? '').trim()).filter(Boolean)
              : [];
            const projectArtistId = String(raw?.artistId ?? raw?.idArtist ?? legacyArtistIds[0] ?? '').trim();
            const projectClientId = String(raw?.clientId ?? raw?.idClient ?? '').trim();
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
        const payload = {
          artistId: resolvedArtistId,
          clientId: resolvedClientId,
          title: 'Prenotazione',
          start: draft.start,
          end: draft.end,
          projectId: projectId || undefined,
          notes: draft.notes ?? undefined,
          status: (draft.status as any) ?? 'confirmed',
          type: 'session',
        };

        const fn = (this.bookingService as any).createBooking ?? (this.bookingService as any).addBooking ?? (this.bookingService as any).create;
        if (!fn) throw new Error('BookingService.createBooking non trovato');
        await fn.call(this.bookingService, payload);

        // BookingService already syncs project.bookingId when projectId is provided.
      }

      if (draft.type === 'session') {
        const projectId = String(draft.projectId ?? '').trim();
        if (projectId) {
          const guard = this.validateSessionSequence({
            projectId,
            start: draft.start,
            sessionNumber: (draft as any).sessionNumber
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
        const rawStatus = String(draft.status ?? '').trim();
        const sessionStatus =
          rawStatus === 'planned' || rawStatus === 'completed' || rawStatus === 'cancelled'
            ? (rawStatus as any)
            : 'planned';

        const payload = {
          artistId: draft.artistId,
          start: draft.start,
          end: draft.end,
          clientId: draft.clientId ?? undefined,
          projectId: draft.projectId ?? undefined,
          bookingId: (draft as any).bookingId ?? undefined,
          notesByAdmin: (draft as any).notesByAdmin ?? (draft.notes ?? undefined),
          paidAmount: (draft as any).paidAmount ?? undefined,
          status: sessionStatus,
        };

        const fn = (this.sessionService as any).createSession ?? (this.sessionService as any).addSession ?? (this.sessionService as any).create;
        if (!fn) throw new Error('SessionService.createSession non trovato');
        await fn.call(this.sessionService, payload);
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
      const nextStart = String((upd.patch as any)?.start ?? '');
      const nextEnd = String((upd.patch as any)?.end ?? '');
      const nextArtistId = String((upd.patch as any)?.artistId ?? current?.artistId ?? '');
      const currentStart = String((current as any)?.start ?? '');
      const currentEnd = String((current as any)?.end ?? '');
      const currentArtistId = String((current as any)?.artistId ?? '');

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
        const nextStatus = (patch as any)?.status;
        const hasStatusChange = typeof nextStatus === 'string' && nextStatus.trim().length > 0;

        if (hasStatusChange) {
          const extra = this.stripUndef({ ...patch });
          delete (extra as any).status;

          const res = await this.bookingService.safeSetStatusSafe(
            upd.id,
            nextStatus as any,
            extra as any
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
          const fn = (this.bookingService as any).updateBooking ?? (this.bookingService as any).update;
          if (!fn) throw new Error('BookingService.updateBooking non trovato');
          await fn.call(this.bookingService, upd.id, patch);
        }
      }

      if (upd.type === 'session') {
        const patchAny = upd.patch as any;
        const currentAny = current as any;
        const currentProjectId = String(currentAny?.projectId ?? '').trim();
        const nextProjectId = String(patchAny?.projectId ?? currentAny?.projectId ?? '').trim();
        const projectChanged = nextProjectId !== currentProjectId;
        const startChanged = this.changedAtMinutePrecision(
          String(patchAny?.start ?? currentAny?.start ?? ''),
          String(currentAny?.start ?? '')
        );
        const currentSessionNumber =
          currentAny?.sessionNumber == null ? null : Number(currentAny?.sessionNumber);
        const nextSessionNumber =
          patchAny?.sessionNumber == null ? currentSessionNumber : Number(patchAny?.sessionNumber);
        const sessionNumberChanged =
          nextSessionNumber != null &&
          currentSessionNumber != null &&
          nextSessionNumber !== currentSessionNumber;

        const needsSequenceCheck = projectChanged || startChanged || sessionNumberChanged;

        if (needsSequenceCheck) {
          const projectId = String(nextProjectId ?? '').trim();
          if (projectId) {
            const start = String(patchAny?.start ?? currentAny?.start ?? '');
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

        const fn = (this.sessionService as any).updateSession ?? (this.sessionService as any).update;
        if (!fn) throw new Error('SessionService.updateSession non trovato');
        await fn.call(this.sessionService, upd.id, patch);
      }
    } catch (e) {
      console.error('[CAL-ADMIN-V2] update failed', e);
      this.showOpError(e, 'Errore aggiornamento evento.');
    }
  }

  private showOpError(err: any, fallback: string): void {
    const raw = String(err?.message ?? '').trim();
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

  private stripUndef<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) out[key] = obj[key];
    }
    return out;
  }

  private hasConflict(artistId: string, startISO: string, endISO: string, excludeId?: string): boolean {
    if (!artistId || !startISO || !endISO) return false;
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

    const events = this.events();
    return events.some(ev => {
      if (excludeId && ev.id === excludeId) return false;
      if (String(ev.artistId) !== String(artistId)) return false;
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
        message: `Numero sessione non valido. Deve essere ${expectedNumber}.`
      };
    }

    const nextStart = new Date(start);
    if (lastEnd && !Number.isNaN(nextStart.getTime()) && nextStart.getTime() <= lastEnd.getTime()) {
      return {
        ok: false,
        message: `La sessione deve iniziare dopo l’ultima (${this.formatLocal(lastEnd)}).`
      };
    }

    return { ok: true, message: '' };
  }
}
