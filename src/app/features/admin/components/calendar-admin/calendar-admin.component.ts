import {
  Component,
  OnInit,
  inject,
  effect,
  DestroyRef,
  Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { CalendarComponent } from '../../../calendar/calendar.component';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { Session, SessionService } from '../../../../core/services/session/session.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { combineLatest, map, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type UiType = 'booking' | 'session';
export interface CalendarEvent {
  id: string;
  date: string;      // YYYY-MM-DD
  start: string;     // YYYY-MM-DDTHH:mm:ss (local)
  end: string;       // YYYY-MM-DDTHH:mm:ss (local)
  artistId: string;
  artistName?: string;

  type?: 'booking' | 'session';
  notes?: string;

  // UI helpers
  isMine?: boolean;
  count?: number;
  duration?: number;   // minuti
  slotCount?: number;  // es: ceil(duration/30)
}

@Component({
  selector: 'app-calendar-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, CalendarComponent],
  templateUrl: './calendar-admin.component.html',
  styleUrls: ['./calendar-admin.component.scss'],
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
export class CalendarAdminComponent implements OnInit {
  // services
  private readonly auth = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly sessionService = inject(SessionService);
  private readonly staffService = inject(StaffService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ============================================================
  // ✅ CAL-ADMIN DEBUG CONSOLE
  // ============================================================
  private readonly CAL_DEBUG = true;

  private log(...args: any[]) {
    if (!this.CAL_DEBUG) return;
    // eslint-disable-next-line no-console
    console.log('%c[CAL-ADMIN]', 'color:#7dd3fc;font-weight:700', ...args);
  }

  private group(title: string, data?: any) {
    if (!this.CAL_DEBUG) return;
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[CAL-ADMIN] ${title}`, 'color:#a78bfa;font-weight:700');
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.log(data);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  private table(label: string, rows: any[]) {
    if (!this.CAL_DEBUG) return;
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[CAL-ADMIN] ${label}`, 'color:#34d399;font-weight:700');
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  private sanityCheck(): void {
    if (!this.CAL_DEBUG) return;

    const events = this.events ?? [];
    const mapIds = new Set(Object.keys(this.artistMap ?? {}));
    const eventArtistIds = new Set(events.map(e => e.artistId).filter(Boolean));

    const missingInMap = [...eventArtistIds].filter(id => !mapIds.has(id));
    if (missingInMap.length) {
      this.group('⚠️ Eventi con artistId NON presenti in artistMap', missingInMap);
    } else {
      this.log('✅ sanityCheck: tutti gli artistId degli eventi sono presenti in artistMap');
    }

    const badDates = events.filter(e => {
      const s = Date.parse(e.start);
      const en = Date.parse(e.end);
      return Number.isNaN(s) || Number.isNaN(en) || en <= s;
    });
    if (badDates.length) this.group('⚠️ Eventi con start/end invalidi', badDates);

    const malformed = events.filter(e => !e.start || !e.end || !e.artistId);
    if (malformed.length) this.group('⚠️ EVENTI MALFORMATI (mancano start/end/artistId)', malformed);
  }

  // state
  events: CalendarEvent[] = [];
  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};
  user: { uid: string; role?: string } | null = null;

  selectedType: UiType = 'booking';
  bookingTypes: UiType[] = ['booking', 'session'];

  formGroup!: FormGroup;

  // ============================================================
  // EFFECT: load staff + bookings + sessions
  // ✅ FIX: cleanup subscription (evita duplicati)
  // ============================================================
  private loadDataEffect = effect((onCleanup) => {
    const u = this.auth.userSig();
    if (!u?.uid) return;

    this.user = { uid: u.uid, role: u.role };
    this.group('AUTH userSig()', this.user);

    let sub: Subscription | null = null;

    sub = combineLatest([
      this.staffService.getAllStaff(),
      this.bookingService.getAllBookings(),
      this.sessionService.getAll()
    ])
      .pipe(
        map(([staff, bookings, sessions]) => {
          // ---------- STAFF ----------
          const active = (staff ?? []).filter(s => s?.isActive !== false);

          this.group('STAFF ricevuto', { total: staff?.length ?? 0, active: active.length });
          this.table('STAFF list (active)', active.map(s => ({
            id: s.id,
            name: s.name,
            role: s.role,
            isActive: s.isActive,
            photoUrl: (s as any).photoUrl ?? ''
          })));

          this.artistMap = active.reduce((acc, s) => {
            if (s.id) acc[s.id] = s.name;
            return acc;
          }, {} as Record<string, string>);

          this.artistPhotoMap = active.reduce((acc, s) => {
            if (s.id) acc[s.id] = (s as any).photoUrl || '';
            return acc;
          }, {} as Record<string, string>);

          this.group('artistMap', this.artistMap);
          this.group('artistPhotoMap', this.artistPhotoMap);

          // ---------- BOOKINGS ----------
          this.group('BOOKINGS ricevuti', { count: bookings?.length ?? 0 });
          this.table('BOOKINGS sample', (bookings ?? []).slice(0, 20).map(b => ({
            id: b.id,
            artistId: (b as any).artistId,
            start: (b as any).start,
            end: (b as any).end,
            title: (b as any).title ?? '',
            notes: (b as any).notes ?? ''
          })));

          // ---------- SESSIONS ----------
          this.group('SESSIONS ricevute', { count: sessions?.length ?? 0 });
          this.table('SESSIONS sample', (sessions ?? []).slice(0, 20).map(s => ({
            id: s.id,
            artistId: (s as any).artistId,
            start: (s as any).start,
            end: (s as any).end,
            sessionNumber: (s as any).sessionNumber ?? 1
          })));

          const bookingEvents = (bookings ?? []).map(b => this.mapBookingToEvent(b));
          const sessionEvents = (sessions ?? []).flatMap(s => this.mapSessionToEvent(s));

          const all = [...bookingEvents, ...sessionEvents].sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
          );

          // log eventi finali
          this.group('EVENTS (finali) => passati a <app-calendar>', { count: all.length });
          this.table('EVENTS sample', all.slice(0, 30).map(e => ({
            id: e.id,
            type: e.type,
            artistId: e.artistId,
            start: e.start,
            end: e.end,
            duration: (e as any).duration,
            slotCount: (e as any).slotCount,
            notes: e.notes
          })));

          return all;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(all => {
        this.events = all;
        this.sanityCheck();
      });

    // ✅ cleanup: fondamentale per non duplicare subscribe ad ogni rerun dell'effect
    onCleanup(() => {
      if (sub) {
        sub.unsubscribe();
        sub = null;
        this.log('cleanup effect: unsub combineLatest');
      }
    });
  }, { injector: this.injector });

  ngOnInit(): void {
    this.formGroup = this.buildFormForType(this.selectedType);
    this.group('INIT formGroup', this.formGroup.getRawValue());
  }

  // ============================================================
  // FORM
  // ============================================================
  private buildFormForType(type: UiType): FormGroup {
    return this.fb.group({
      type: new FormControl<UiType>(type, { nonNullable: true, validators: [Validators.required] }),

      // ✅ NUOVI campi (no legacy)
      artistId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      clientId: new FormControl<string>('', { nonNullable: true }), // opzionale
      projectId: new FormControl<string>('', { nonNullable: true }),

      title: new FormControl<string>('', { nonNullable: true }),
      notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),

      // datetime
      date: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      time: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      duration: new FormControl<number>(type === 'session' ? 60 : 30, { nonNullable: true }),

      start: new FormControl<string>('', { nonNullable: true }),
      end: new FormControl<string>('', { nonNullable: true }),

      // session specific
      sessionNumber: new FormControl<number>(1, { nonNullable: true }),

      // payment-ish
      price: new FormControl<number>(0, { nonNullable: true }),
      paidAmount: new FormControl<number>(0, { nonNullable: true })
    });
  }

  onSelectedTypeChanged(newType: any): void {
    const t = (newType === 'session' ? 'session' : 'booking') as UiType;
    this.group('selectedTypeChange (dal Calendar)', { from: this.selectedType, to: t });
    this.selectedType = t;
    this.formGroup = this.buildFormForType(t);
    this.group('formGroup rebuilt', this.formGroup.getRawValue());
  }

  // ============================================================
  // MAPPERS
  // ============================================================
  private mapBookingToEvent(booking: Booking): CalendarEvent {
    const start = this.normalizeLocalDateTime((booking as any).start);
    const end = this.normalizeLocalDateTime((booking as any).end ?? this.addMinutesLocal(start, 30));
    const duration = Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 60000));
    const date = start.slice(0, 10);

    const artistId = String((booking as any).artistId || '').trim();
    return {
      id: (booking as any).id,
      date,
      start,
      end,
      artistId,
      artistName: this.artistMap[artistId] || '',
      notes: (booking as any).notes || (booking as any).title || 'Prenotazione',
      isMine: false,
      count: 1,
      type: 'booking',
      duration,
      slotCount: Math.ceil(duration / 30)
    } as any;
  }

private mapSessionToEvent(session: Session): CalendarEvent[] {
  const rawStart = (session as any).start;
  const rawEnd = (session as any).end;

  const start = this.normalizeLocalDateTime(rawStart || '');
  if (!start || start.length < 10) {
    this.group('⚠️ SESSIONE senza start valido -> SKIP', {
      id: (session as any).id,
      rawStart,
      session
    });
    return [];
  }

  const end = this.normalizeLocalDateTime(rawEnd || this.addMinutesLocal(start, 60));
  if (!end || end.length < 10) {
    this.group('⚠️ SESSIONE senza end valido -> fallback +60', {
      id: (session as any).id,
      rawEnd
    });
  }

  const safeEnd = end || this.addMinutesLocal(start, 60);

  const duration = Math.max(1, Math.round((+new Date(safeEnd) - +new Date(start)) / 60000));
  const date = start.slice(0, 10);

  const artistId = String((session as any).artistId || '').trim();

  return [{
    id: (session as any).id!,
    date,
    start,
    end: safeEnd,
    artistId,
    artistName: this.artistMap[artistId] || '',
    notes: (session as any).notesByAdmin || 'Seduta',
    isMine: false,
    count: 1,
    type: 'session',
    duration,
    slotCount: Math.ceil(duration / 30)
  } as any];
}


  // ============================================================
  // CREATE: booking draft or session
handleBooking(draft: any): void {
  console.groupCollapsed(
    '%c[CAL-ADMIN] ✅ CLICK SALVA -> bookingSubmitted ricevuto',
    'color:#22c55e;font-weight:800'
  );
  console.log('draft:', draft);
  console.log('formGroup raw:', this.formGroup?.getRawValue());
  console.log('selectedType:', this.selectedType);
  console.groupEnd();

  if (!draft) {
    console.error('[CAL-ADMIN] ❌ draft è null/undefined: il CalendarComponent non sta emettendo bookingSubmitted.');
    return;
  }

  const type: UiType = (draft?.type ?? 'booking') as UiType;

  // campi minimi
  const artistId = String(draft.artistId ?? '').trim();
  const dateStr = String(draft.date ?? '').trim();
  const timeStr = String(draft.time ?? '').trim();

  if (!artistId || !dateStr || !timeStr) {
    console.error('[CAL-ADMIN] ❌ campi minimi mancanti', { artistId, date: dateStr, time: timeStr, draft });
    return;
  }

  const clientId = String(draft.clientId ?? '').trim();
  const projectId = String(draft.projectId ?? '').trim();

  // start/end coerenti
  const start = this.normalizeLocalDateTime(
    draft.start || this.buildStartFromDateTime(dateStr, timeStr)
  );

  const duration = Number(draft.duration ?? (type === 'session' ? 60 : 30));
  const end = this.normalizeLocalDateTime(
    draft.end || this.addMinutesLocal(start, duration)
  );

  const date = start.slice(0, 10);

  this.group('Draft normalized', { type, artistId, clientId, projectId, start, end, duration, date });

  // =========================
  // SESSION (reale)
  // =========================
  if (type === 'session') {
    const session: Session = {
      id: undefined,
      artistId,
      clientId,
      projectId,
      start,
      end,
      price: Number(draft.price ?? 0),
      paidAmount: Number(draft.paidAmount ?? 0),
      sessionNumber: Number(draft.sessionNumber ?? 1),
      notesByAdmin: String(draft.notes ?? ''),
      painLevel: 1,
      healingNotes: '',
      photoUrlList: [],
      status: 'planned',
      createdAt: this.formatLocal(new Date()),
      updatedAt: this.formatLocal(new Date())
    } as any;

    this.group('CREATE session payload', session);

    this.sessionService.create(session)
      .then(() => {
        const generated = this.mapSessionToEvent(session);
        this.events = [...this.events, ...generated].sort((a, b) => +new Date(a.start) - +new Date(b.start));
        this.log('✅ session created -> events appended');
        this.sanityCheck();
      })
      .catch((err: any) => console.error('❌ Errore creazione sessione:', err));

    return;
  }

  // =========================
  // BOOKING (reale: no draft in pratica)
  // =========================
  const payload = {
    title: String(draft.title || 'Prenotazione'),
    start,
    end,
    clientId,
    artistId,
    notes: String(draft.notes || ''),
    price: Number(draft.price ?? 0),
    paidAmount: Number(draft.paidAmount ?? 0),
    projectId: projectId || undefined,
    createdAt: this.formatLocal(new Date()),
    updatedAt: this.formatLocal(new Date())
  };

  this.group('CREATE booking payload (will be promoted)', payload);

  // 1) creo (usando addDraft per ottenere id)
  // 2) promuovo subito a reale aggiornando lo status
  const REAL_STATUS = 'planned'; // cambia in 'confirmed' se vuoi

  this.bookingService.addDraft(payload as any)
    .then((id: string) => {
      const finalId = id || (payload as any).id;
      if (!finalId) throw new Error('Nessun id da addDraft');

      this.log('✅ addDraft ok, promote ->', { finalId, REAL_STATUS });

      return this.bookingService.updateBooking(finalId, {
        status: REAL_STATUS,
        updatedAt: this.formatLocal(new Date())
      } as any).then(() => finalId);
    })
    .then((finalId: string) => {
      const durationMin = Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 60000));

      const newEvent: CalendarEvent = {
        id: finalId,
        date,
        start,
        end,
        artistId,
        artistName: this.artistMap[artistId] || '',
        notes: payload.notes || payload.title || 'Prenotazione',
        isMine: false,
        count: 1,
        type: 'booking',
        duration: durationMin,
        slotCount: Math.ceil(durationMin / 30)
      } as any;

      this.events = [...this.events, newEvent].sort((a, b) => +new Date(a.start) - +new Date(b.start));
      this.log(`✅ booking REAL created (status=${REAL_STATUS})`, finalId);
      this.sanityCheck();
    })
    .catch((err: any) => console.error('❌ Errore creazione booking reale:', err));
}


  // ============================================================
  // UPDATE: drag/drop or form update
  // ============================================================
  handleUpdateEvent({ event, newDate, newHour, newArtistId }: any): void {
    this.group('eventDropped (dal Calendar)', { event, newDate, newHour, newArtistId });

    const newStart = this.normalizeLocalDateTime(`${newDate}T${newHour}:00`);
    const durationMin = Math.max(1, Math.round((+new Date(event.end) - +new Date(event.start)) / 60000));
    const newEnd = this.addMinutesLocal(newStart, durationMin);

    const updatedEventUI: CalendarEvent = {
      ...event,
      start: newStart,
      end: newEnd,
      artistId: String(newArtistId || '')
    };

    const isSession = event.type === 'session';

    if (isSession) {
      this.group('UPDATE session payload', {
        id: event.id,
        start: newStart,
        end: newEnd,
        artistId: String(newArtistId || '')
      });

      this.sessionService.update(event.id!, {
        start: newStart,
        end: newEnd,
        artistId: String(newArtistId || ''),
        updatedAt: this.formatLocal(new Date())
      } as any)
        .then(() => {
          this.updateEventInList(updatedEventUI);
          this.log('✅ session updated');
          this.sanityCheck();
        })
        .catch((err: any) => console.error('❌ Errore aggiornamento sessione:', err));
    } else {
      this.group('UPDATE booking payload', {
        id: event.id,
        start: newStart,
        end: newEnd,
        artistId: String(newArtistId || '')
      });

      this.bookingService.updateBooking(event.id!, {
        start: newStart,
        end: newEnd,
        artistId: String(newArtistId || ''),
        updatedAt: this.formatLocal(new Date())
      } as any)
        .then(() => {
          this.updateEventInList(updatedEventUI);
          this.log('✅ booking updated');
          this.sanityCheck();
        })
        .catch((err: any) => console.error('❌ Errore aggiornamento prenotazione:', err));
    }
  }

  private updateEventInList(updated: CalendarEvent): void {
    this.events = this.events.map(e => e.id === updated.id ? updated : e);
  }

  // ============================================================
  // DATETIME HELPERS (locale "YYYY-MM-DDTHH:mm:ss")
  // ============================================================
  private pad(n: number): string { return String(n).padStart(2, '0'); }

  private formatLocal(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mm = this.pad(d.getMinutes());
    const ss = this.pad(d.getSeconds());
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }

  private normalizeLocalDateTime(input: string): string {
    if (!input) return input;
    let s = String(input).replace('Z', '');
    s = s.split('.')[0];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s;

    const d = new Date(input);
    if (!isNaN(d.getTime())) return this.formatLocal(d);
    return s;
  }

  private addMinutesLocal(startLocal: string, minutes: number): string {
    const d = new Date(this.normalizeLocalDateTime(startLocal));
    d.setMinutes(d.getMinutes() + minutes);
    return this.formatLocal(d);
  }

  private buildStartFromDateTime(date: string, time: string): string {
    // date: YYYY-MM-DD, time: HH:mm
    if (!date || !time) return this.formatLocal(new Date());
    return this.normalizeLocalDateTime(`${date}T${time}:00`);
  }
}
