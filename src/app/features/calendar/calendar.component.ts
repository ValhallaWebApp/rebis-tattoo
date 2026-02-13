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
      if (this.hasConflict(draft.artistId, draft.start, draft.end)) {
        console.warn('[CAL-ADMIN-V2] create blocked: slot not available', {
          artistId: draft.artistId,
          start: draft.start,
          end: draft.end
        });
        this.showConflictMessage();
        return;
      }

      if (draft.type === 'booking') {
        // ⚠️ adatta al tuo BookingService
        const payload = {
          artistId: draft.artistId,
          start: draft.start,
          end: draft.end,
          durationMinutes: draft.durationMinutes,
          clientId: draft.clientId ?? null,
          projectId: draft.projectId ?? null,
          notes: draft.notes ?? '',
          status: draft.status ?? 'confirmed',
          type: 'booking',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        const fn = (this.bookingService as any).createBooking ?? (this.bookingService as any).addBooking ?? (this.bookingService as any).create;
        if (!fn) throw new Error('BookingService.createBooking non trovato');
        const created = await fn.call(this.bookingService, payload);
        const bookingId =
          typeof created === 'string' ? created :
          created?.id ? String(created.id) : null;

        if (bookingId && draft.projectId) {
          await this.projectService.updateProject(draft.projectId, { bookingId });
        }
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
        const payload = {
          artistId: draft.artistId,
          date: draft.start,
          start: draft.start,
          end: draft.end,
          durationMinutes: draft.durationMinutes,
          clientId: draft.clientId ?? null,
          projectId: draft.projectId ?? null,
          bookingId: (draft as any).bookingId ?? null,
          notesByAdmin: (draft as any).notesByAdmin ?? (draft.notes ?? ''),
          paidAmount: (draft as any).paidAmount ?? null,
          status: draft.status ?? 'confirmed',
          type: 'session',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        const fn = (this.sessionService as any).createSession ?? (this.sessionService as any).addSession ?? (this.sessionService as any).create;
        if (!fn) throw new Error('SessionService.createSession non trovato');
        await fn.call(this.sessionService, payload);
      }
    } catch (e) {
      console.error('[CAL-ADMIN-V2] create failed', e);
    }
  }

  async onUpdateRequested(upd: UpdatePatch) {
    if (!upd?.id) return;

    try {
      const current = this.findEventById(upd.id);
      const nextStart = String(upd.patch.start ?? '');
      const nextEnd = String(upd.patch.end ?? '');
      if (nextStart && nextEnd) {
        const artistId = (upd.patch as any)?.artistId ?? current?.artistId ?? '';
        if (this.hasConflict(artistId, nextStart, nextEnd, upd.id)) {
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
        const fn = (this.bookingService as any).updateBooking ?? (this.bookingService as any).update;
        if (!fn) throw new Error('BookingService.updateBooking non trovato');
        await fn.call(this.bookingService, upd.id, patch);
      }

      if (upd.type === 'session') {
        const patchAny = upd.patch as any;
        const needsSequenceCheck =
          patchAny?.start != null ||
          patchAny?.end != null ||
          patchAny?.sessionNumber != null ||
          patchAny?.projectId != null;

        if (needsSequenceCheck) {
          const projectId = String(patchAny?.projectId ?? (current as any)?.projectId ?? '').trim();
          if (projectId) {
            const start = String(patchAny?.start ?? (current as any)?.start ?? '');
            const sessionNumber = patchAny?.sessionNumber ?? (current as any)?.sessionNumber;
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
    }
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
