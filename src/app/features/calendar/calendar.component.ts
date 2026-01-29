import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';

import { CalendarShellComponent } from './calendar-shell/calendar-shell.component';
import { CreateDraft, UiArtist, UiCalendarEvent, UpdatePatch } from './models';
import { StaffService ,StaffMember} from '../../core/services/staff/staff.service';
import { BookingService } from '../../core/services/bookings/booking.service';
import { SessionService } from '../../core/services/session/session.service';
import { MaterialModule } from '../../core/modules/material.module';

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

// 2) bookings + sessions
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


if (bookings$) {
  bookings$.subscribe({
    next: (b: any[]) => {
      lastBookings = b ?? [];
      console.log('[CAL-ADMIN-V2] bookings:', lastBookings.length);
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
    next: (s: any[]) => {
      lastSessions = s ?? [];
      console.log('[CAL-ADMIN-V2] sessions:', lastSessions.length);
      this.rebuildEvents(lastBookings, lastSessions);
    },
    error: (e: any) => {
      console.error('[CAL-ADMIN-V2] sessions error', e);
      lastSessions = [];
      this.rebuildEvents(lastBookings, lastSessions);
    },
  });
}

    if (!bookings$ || !sessions$) {
      console.warn('[CAL-ADMIN-V2] ⚠️ Adatta i metodi dei services: bookings$ / sessions$ non trovati.');
      this.loading.set(false);
      return;
    }

    // merge manuale senza combineLatest per evitare import aggiuntivi
    let lastBookings: Booking[] = [];
    let lastSessions: Session[] = [];

    bookings$.subscribe({
      next: (b: Booking[]) => { lastBookings = b ?? []; this.rebuildEvents(lastBookings, lastSessions); },
      error: () => { lastBookings = []; this.rebuildEvents(lastBookings, lastSessions); },
    });

    sessions$.subscribe({
      next: (s: Session[]) => { lastSessions = s ?? []; this.rebuildEvents(lastBookings, lastSessions); },
      error: () => { lastSessions = []; this.rebuildEvents(lastBookings, lastSessions); },
    });
  }

  private rebuildEvents(bookings: Booking[], sessions: Session[]) {
    const staffMap = new Map(this.artists().map(a => [a.id, a]));

    const mappedBookings: UiCalendarEvent[] = (bookings ?? [])
      .filter(b => b?.id && b?.artistId && b?.start && b?.end)
      .map(b => {
        const a = staffMap.get(String(b.artistId));
        return {
          id: String(b.id),
          type: 'booking',
          artistId: String(b.artistId),
          start: String(b.start),
          end: String(b.end),
          durationMinutes: Number(b.durationMinutes ?? 0),
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
        const start = String(s.start ?? s.date);
        const duration = Number(s.durationMinutes ?? 0);
        const end = s.end ? String(s.end) : this.buildEndFromStart(start, duration);

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
          status: s.status ? String(s.status) : undefined,
          notes: s.notes ? String(s.notes) : undefined,
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
    return d.toISOString();
  }

  // --- HANDLERS from Calendar ---
  async onCreateRequested(draft: CreateDraft) {
    if (!draft) return;

    try {
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
        await fn.call(this.bookingService, payload);
      }

      if (draft.type === 'session') {
        // ⚠️ adatta al tuo SessionService
        const payload = {
          artistId: draft.artistId,
          date: draft.start,
          start: draft.start,
          end: draft.end,
          durationMinutes: draft.durationMinutes,
          clientId: draft.clientId ?? null,
          projectId: draft.projectId ?? null,
          notes: draft.notes ?? '',
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
      const patch = { ...upd.patch, updatedAt: new Date().toISOString() };

      if (upd.type === 'booking') {
        const fn = (this.bookingService as any).updateBooking ?? (this.bookingService as any).update;
        if (!fn) throw new Error('BookingService.updateBooking non trovato');
        await fn.call(this.bookingService, upd.id, patch);
      }

      if (upd.type === 'session') {
        const fn = (this.sessionService as any).updateSession ?? (this.sessionService as any).update;
        if (!fn) throw new Error('SessionService.updateSession non trovato');
        await fn.call(this.sessionService, upd.id, patch);
      }
    } catch (e) {
      console.error('[CAL-ADMIN-V2] update failed', e);
    }
  }
}
