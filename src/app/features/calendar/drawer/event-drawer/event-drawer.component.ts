import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { BehaviorSubject, Observable, combineLatest, map, startWith } from 'rxjs';
import { CreateDraft, UpdatePatch, UiCalendarEvent } from '../../models';
import { UiArtist } from '../../models';

/**
 * Tipi evento gestiti dal drawer
 */
export type UiEventType = 'booking' | 'session';

/**
 * Cliente (versione “lite”) usata per autocomplete.
 */
export interface ClientLite {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

/**
 * Progetto “lite” usato per autocomplete.
 */
export interface ProjectLite {
  id: string;
  title: string;
  clientId?: string;
  artistId?: string;
  sessionIds?: string[];
}

/**
 * Booking “lite” usato per autocomplete sessione.
 */
export interface BookingLite {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  artistId?: string;
  clientId?: string;
  projectId?: string;
}

/**
 * Draft “unificato” usato SOLO per:
 * - initialValue (seed/patch)
 * - eventuale compat legacy
 *
 * Il submit verso il parent ora emette EventDrawerResult.
 */
export interface DrawerDraft {
  type: UiEventType;
  artistId: string;

  start: string;
  end: string;
  durationMinutes: number;

  // compat legacy
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  duration: number; // minuti

  status: string;

  // link
  clientId?: string;
  projectId?: string;
  bookingId?: string;

  // extra
  zone?: string;
  notes?: string;

  // extra session
  sessionNumber?: number;
  painLevel?: number;
  notesByAdmin?: string;
  healingNotes?: string;
}

export interface EventDrawerResult {
  mode: 'create' | 'edit';
  draft: CreateDraft;
  update?: UpdatePatch;
}

export interface CreateProjectTriggerPayload {
  clientId?: string;
  artistId?: string;
  titleHint?: string;
}

@Component({
  selector: 'app-event-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './event-drawer.component.html',
  styleUrls: ['./event-drawer.component.scss'],
})
export class EventDrawerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  // ---------------------------------------------
  // INPUTS
  // ---------------------------------------------
  @Output() submit = new EventEmitter<EventDrawerResult>();
  @Output() createProjectRequested = new EventEmitter<CreateProjectTriggerPayload>();

  /** create/edit */
  @Input() mode: 'create' | 'edit' = 'create';

  /** lista artisti (id + name) */
  @Input() artists: UiArtist[] = [];

  /** ✅ PRELOAD: clienti */
  @Input() clients: ClientLite[] = [];

  /** ✅ PRELOAD: progetti */
  @Input() projects: ProjectLite[] = [];

  /** ✅ PRELOAD: bookings */
  @Input() bookings: BookingLite[] = [];

  /** ✅ eventi esistenti (per bloccare orari non disponibili) */
  @Input() events: UiCalendarEvent[] = [];

  /** ✅ progetto appena creato (da shell) */
  @Input() createdProject: ProjectLite | null = null;

  /** consenti session senza project? default NO */
  @Input() allowStandaloneSession = false;

  /** seed/patch (create o edit) */
  @Input() initialValue: Partial<DrawerDraft> | null = null;

  /** ✅ ID evento in edit (serve per UpdatePatch) */
  @Input() editingEventId: string | null = null;

  @Output() close = new EventEmitter<void>();

  /** ✅ ORA emette EventDrawerResult (non più DrawerDraft) */

  // ---------------------------------------------
  // UI options
  // ---------------------------------------------
  readonly timeOptions = this.buildTimes('08:00', '19:00', 30);
  availableTimeOptions: string[] = this.buildTimes('08:00', '19:00', 30);
  readonly durationOptions = [30, 45, 60, 90, 120, 150, 180];

  readonly bookingStatusOptions = [
    { value: 'draft', label: 'Bozza' },
    { value: 'pending', label: 'In attesa' },
    { value: 'confirmed', label: 'Confermata' },
    { value: 'in_progress', label: 'In corso' },
    { value: 'completed', label: 'Completata' },
    { value: 'cancelled', label: 'Annullata' },
    { value: 'no_show', label: 'No-show' },
  ] as const;

  readonly sessionStatusOptions = [
    { value: 'planned', label: 'Pianificata' },
    { value: 'completed', label: 'Completata' },
    { value: 'cancelled', label: 'Annullata' },
  ] as const;

  // ---------------------------------------------
  // FORM: ibrido booking + session
  // ---------------------------------------------
  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<UiEventType>('booking', Validators.required),
    artistId: this.fb.nonNullable.control('', Validators.required),

    // scheduling (UI)
    day: this.fb.control<Date | null>(new Date(), Validators.required),
    time: this.fb.nonNullable.control('10:00', Validators.required),
    durationMinutes: this.fb.nonNullable.control(60, [Validators.required, Validators.min(15)]),

    // status
    status: this.fb.nonNullable.control('draft', Validators.required),

    // booking: client
    clientId: this.fb.nonNullable.control(''),
    clientQuery: this.fb.control<ClientLite | string>(''),

    // session: project
    projectId: this.fb.nonNullable.control(''),
    projectQuery: this.fb.control<ProjectLite | string>(''),

    // session: booking
    bookingId: this.fb.nonNullable.control(''),
    bookingQuery: this.fb.control<BookingLite | string>(''),

    // opzionali comuni
    zone: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control(''),

    // extra session
    sessionNumber: this.fb.control<number | null>(null),
    painLevel: this.fb.control<number | null>(null),
    notesByAdmin: this.fb.nonNullable.control(''),
    healingNotes: this.fb.nonNullable.control(''),
    paidAmount: this.fb.control<number | null>(null),
  });

  private readonly clients$ = new BehaviorSubject<ClientLite[]>([]);
  private readonly projects$ = new BehaviorSubject<ProjectLite[]>([]);
  private readonly bookings$ = new BehaviorSubject<BookingLite[]>([]);

  // ---------------------------------------------
  // AUTOCOMPLETE: filtro locale
  // ---------------------------------------------
  private readonly clientQueryText$: Observable<string> =
    this.form.controls.clientQuery.valueChanges.pipe(
      startWith(this.form.controls.clientQuery.value),
      map(v => (typeof v === 'string' ? v : (v?.fullName ?? ''))),
      map(s => (s ?? '').trim().toLowerCase())
    );

  readonly filteredClients$: Observable<ClientLite[]> =
    combineLatest([this.clientQueryText$, this.clients$]).pipe(
      map(([q, list]) => {
        const query = q.trim();
        if (!query) return list.slice(0, 30);
        return list
          .filter(c => this.matchClient(c, query))
          .slice(0, 30);
      })
    );

  private readonly projectQueryText$: Observable<string> =
    this.form.controls.projectQuery.valueChanges.pipe(
      startWith(this.form.controls.projectQuery.value),
      map(v => (typeof v === 'string' ? v : (v?.title ?? ''))),
      map(s => (s ?? '').trim().toLowerCase())
    );

  readonly filteredProjects$: Observable<ProjectLite[]> =
    combineLatest([
      this.projectQueryText$,
      this.form.controls.clientId.valueChanges.pipe(startWith(this.form.controls.clientId.value)),
      this.form.controls.artistId.valueChanges.pipe(startWith(this.form.controls.artistId.value)),
      this.projects$
    ]).pipe(
      map(([q, clientId, artistId, list]) => {
        const query = (q ?? '').trim();
        const base = (list ?? [])
          .filter(p => !clientId || p.clientId === clientId)
          .filter(p => !artistId || !p.artistId || p.artistId === artistId);

        if (!query) return base.slice(0, 30);
        return base
          .filter(p => this.matchProject(p, query))
          .slice(0, 30);
      })
    );

  private readonly bookingQueryText$: Observable<string> =
    this.form.controls.bookingQuery.valueChanges.pipe(
      startWith(this.form.controls.bookingQuery.value),
      map(v => (typeof v === 'string' ? v : (this.displayBooking(v) ?? ''))),
      map(s => (s ?? '').trim().toLowerCase())
    );

  readonly filteredBookings$: Observable<BookingLite[]> =
    combineLatest([
      this.bookingQueryText$,
      this.form.controls.clientId.valueChanges.pipe(startWith(this.form.controls.clientId.value)),
      this.form.controls.artistId.valueChanges.pipe(startWith(this.form.controls.artistId.value)),
      this.bookings$
    ]).pipe(
      map(([q, clientId, artistId, list]) => {
        const query = (q ?? '').trim();
        const base = (list ?? [])
          .filter(b => !clientId || b.clientId === clientId)
          .filter(b => !artistId || b.artistId === artistId);

        if (!query) return base.slice(0, 30);
        return base
          .filter(b => this.matchBooking(b, query))
          .slice(0, 30);
      })
    );

  // ---------------------------------------------
  // Display functions
  // ---------------------------------------------
  displayClient = (value: ClientLite | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const extra = value.email ? ` · ${value.email}` : (value.phone ? ` · ${value.phone}` : '');
    return `${value.fullName}${extra}`;
  };

  displayProject = (value: ProjectLite | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.title;
  };

  displayBooking = (value: BookingLite | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const time = value.start ? this.formatTime(value.start) : '';
    const clientName =
      this.clients.find(c => c.id === value.clientId)?.fullName ||
      value.clientId ||
      'Cliente';
    return time ? `${clientName} · ${time}` : clientName;
  };

  // ---------------------------------------------
  // Helpers per template
  // ---------------------------------------------
  isBooking() { return this.form.controls.type.value === 'booking'; }
  isSession() { return this.form.controls.type.value === 'session'; }
  shouldShowSelectedArtistFallback(): boolean {
    const selectedArtistId = String(this.form.controls.artistId.value ?? '').trim();
    if (!selectedArtistId) return false;
    return !(this.artists ?? []).some(a => String(a.id) === selectedArtistId);
  }
  private isSessionEdit(): boolean {
    return this.isSession() && this.mode === 'edit';
  }

  isScheduleLocked(): boolean {
    return this.isSessionEdit() && this.form.controls.status.value === 'completed';
  }

  isBookingScheduleLocked(): boolean {
    return this.mode === 'edit' && this.isBooking();
  }

  isAssignmentLocked(): boolean {
    return this.isSessionEdit();
  }

  isBookingAssignmentLocked(): boolean {
    return this.mode === 'edit' && this.isBooking();
  }

  private recomputeDisabledState(): void {
    const lockSchedule = this.isScheduleLocked() || this.isBookingScheduleLocked();
    const lockAssignment = this.isAssignmentLocked() || this.isBookingAssignmentLocked();

    const artistId = String(this.form.controls.artistId.value ?? '').trim();
    const lockTime = lockSchedule || !artistId;

    this.setDisabled(this.form.controls.artistId, lockAssignment);
    this.setDisabled(this.form.controls.day, lockSchedule);
    this.setDisabled(this.form.controls.time, lockTime);
    this.setDisabled(this.form.controls.durationMinutes, lockSchedule);

    // Autocomplete inputs: prefer disabling the FormControl (avoid [disabled] on reactive directives).
    this.setDisabled(this.form.controls.projectQuery, lockAssignment);
    this.setDisabled(this.form.controls.bookingQuery, lockAssignment);
    this.setDisabled(this.form.controls.sessionNumber, this.isAssignmentLocked());
  }

  private setDisabled(ctrl: { disable: (opts?: any) => void; enable: (opts?: any) => void; disabled: boolean }, disabled: boolean): void {
    if (disabled) {
      if (!ctrl.disabled) ctrl.disable({ emitEvent: false });
      return;
    }
    if (ctrl.disabled) ctrl.enable({ emitEvent: false });
  }

  ngOnInit(): void {
    // Regola: cambio type -> status default + pulizia campi non pertinenti
    this.form.controls.type.valueChanges.subscribe(t => {
      if (t === 'booking') {
        this.form.controls.status.setValue('draft', { emitEvent: false });
        this.clearProject(false);
        this.clearBooking(false);
        this.form.controls.sessionNumber.setValue(null, { emitEvent: false });
      } else {
        this.form.controls.status.setValue('planned', { emitEvent: false });
        if (!this.form.controls.sessionNumber.value) {
          this.form.controls.sessionNumber.setValue(1, { emitEvent: false });
        }
      }

      // ripulisci errori business
      this.form.controls.clientQuery.setErrors(null);
      this.form.controls.projectQuery.setErrors(null);
      this.form.controls.projectId.setErrors(null);
      this.form.controls.clientId.setErrors(null);
    });

    // seed liste iniziali
    this.clients$.next(this.clients ?? []);
    this.projects$.next(this.projects ?? []);
    this.bookings$.next(this.bookings ?? []);

    // Patch initial value
    if (this.initialValue) {
      this.patchFromInitial(this.initialValue);
    }

    this.recomputeAvailableTimes();
    this.recomputeDisabledState();

    this.form.controls.artistId.valueChanges.subscribe(() => this.recomputeAvailableTimes());
    this.form.controls.day.valueChanges.subscribe(() => this.recomputeAvailableTimes());
    this.form.controls.durationMinutes.valueChanges.subscribe(() => this.recomputeAvailableTimes());

    // disabled state driven by business rules
    this.form.controls.artistId.valueChanges.subscribe(() => this.recomputeDisabledState());
    this.form.controls.type.valueChanges.subscribe(() => this.recomputeDisabledState());
    this.form.controls.status.valueChanges.subscribe(() => this.recomputeDisabledState());

    // progetto -> sessionNumber auto + client auto (opzionale)
    this.form.controls.projectId.valueChanges.subscribe(pid => {
      if (!pid) {
        if (this.isSession()) this.form.controls.sessionNumber.setValue(1, { emitEvent: false });
        return;
      }

      const p = this.projects.find(x => x.id === pid);
      this.syncSessionNumberFromProject(pid);

      if (p?.clientId) {
        const c = this.clients.find(x => x.id === p.clientId);
        if (c) {
          this.form.controls.clientId.setValue(c.id, { emitEvent: false });
          this.form.controls.clientQuery.setValue(c, { emitEvent: false });
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clients']) {
      this.clients$.next(this.clients ?? []);
      this.hydrateClientQueryFromId();
    }

    if (changes['projects']) {
      this.projects$.next(this.projects ?? []);
      this.hydrateProjectQueryFromId();
      this.syncSessionNumberFromProject(this.form.controls.projectId.value);
    }

    if (changes['bookings']) {
      this.bookings$.next(this.bookings ?? []);
      this.hydrateBookingQueryFromId();
    }

    if (changes['initialValue'] && changes['initialValue'].currentValue) {
      this.patchFromInitial(changes['initialValue'].currentValue);
    }

    if (changes['createdProject'] && changes['createdProject'].currentValue) {
      const created = changes['createdProject'].currentValue as ProjectLite;
      if (created?.id) {
        const exists = (this.projects ?? []).some(p => p.id === created.id);
        if (!exists) {
          this.projects = [created, ...(this.projects ?? [])];
        }
        this.projects$.next(this.projects ?? []);
        this.onProjectSelected(created);
      }
    }

    if (changes['events'] || changes['editingEventId']) {
      this.recomputeAvailableTimes();
      this.recomputeDisabledState();
    }
  }

  // ---------------------------------------------
  // Events: selezione autocomplete
  // ---------------------------------------------
  onClientSelected(c: ClientLite) {
    this.form.controls.clientId.setValue(c.id);
    this.form.controls.clientQuery.setValue(c, { emitEvent: false });
    this.form.controls.clientQuery.setErrors(null);
  }

  clearClient(emit = true) {
    this.form.controls.clientId.setValue('', { emitEvent: emit });
    this.form.controls.clientQuery.setValue('', { emitEvent: false });
  }

  onProjectSelected(p: ProjectLite) {
    this.form.controls.projectId.setValue(p.id);
    this.form.controls.projectQuery.setValue(p, { emitEvent: false });
    this.form.controls.projectQuery.setErrors(null);
  }

  onBookingSelected(b: BookingLite) {
    if (this.form.controls.type.value !== 'session') {
      this.form.controls.type.setValue('session', { emitEvent: false });
      this.form.controls.status.setValue('planned', { emitEvent: false });
    }
    this.form.controls.bookingId.setValue(b.id);
    this.form.controls.bookingQuery.setValue(b, { emitEvent: false });
    this.form.controls.bookingQuery.setErrors(null);

    if (b.artistId) this.form.controls.artistId.setValue(b.artistId);
    if (b.clientId) {
      this.form.controls.clientId.setValue(b.clientId, { emitEvent: false });
      const c = this.clients.find(x => x.id === b.clientId);
      if (c) this.form.controls.clientQuery.setValue(c, { emitEvent: false });
    }
    if (b.projectId) {
      this.form.controls.projectId.setValue(b.projectId);
      const p = this.projects.find(x => x.id === b.projectId);
      if (p) this.form.controls.projectQuery.setValue(p, { emitEvent: false });
    }
  }

  clearProject(emit = true) {
    this.form.controls.projectId.setValue('', { emitEvent: emit });
    this.form.controls.projectQuery.setValue('', { emitEvent: false });
  }

  clearBooking(emit = true) {
    this.form.controls.bookingId.setValue('', { emitEvent: emit });
    this.form.controls.bookingQuery.setValue('', { emitEvent: false });
  }

  createProjectFromDrawer(): void {
    if (!this.form.controls.artistId.value) {
      this.form.controls.artistId.setErrors({ required: true });
      this.form.controls.artistId.markAsTouched();
    }

    if (!this.form.controls.clientId.value) {
      this.form.controls.clientQuery.setErrors({ required: true });
      this.form.controls.clientQuery.markAsTouched();
    }

    if (!this.form.controls.artistId.value || !this.form.controls.clientId.value) {
      return;
    }

    const titleHint =
      typeof this.form.controls.projectQuery.value === 'string'
        ? String(this.form.controls.projectQuery.value).trim()
        : '';

    this.createProjectRequested.emit({
      clientId: this.form.controls.clientId.value || undefined,
      artistId: this.form.controls.artistId.value || undefined,
      titleHint: titleHint || undefined
    });
  }

  onProjectBlur(): void {
    const value = this.form.controls.projectQuery.value;
    if (typeof value !== 'string') return;
    const q = value.trim().toLowerCase();
    if (!q) return;
    const match = (this.projects ?? []).find(p => (p.title ?? '').toLowerCase() === q);
    if (match) this.onProjectSelected(match);
  }

  onBookingBlur(): void {
    const value = this.form.controls.bookingQuery.value;
    if (typeof value !== 'string') return;
    const q = value.trim().toLowerCase();
    if (!q) return;
    const match = (this.bookings ?? []).find(b => this.matchBooking(b, q));
    if (match) this.onBookingSelected(match);
  }

  onClientBlur(): void {
    const value = this.form.controls.clientQuery.value;
    if (typeof value !== 'string') return;
    const q = value.trim().toLowerCase();
    if (!q) return;
    const match = (this.clients ?? []).find(c => (c.fullName ?? '').toLowerCase() === q);
    if (match) this.onClientSelected(match);
  }

  // ---------------------------------------------
  // SUBMIT: ora emette EventDrawerResult
  // ---------------------------------------------
  onSubmit() {
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const { start, end } = this.computeStartEnd(raw.day!, raw.time, raw.durationMinutes);

    // Business rules
    if (raw.type === 'booking') {
      if (!raw.clientId.trim()) {
        this.form.controls.clientQuery.setErrors({ required: true });
        this.form.controls.clientQuery.markAsTouched();
        return;
      }
    }

    if (raw.type === 'session') {
      const pid = raw.projectId.trim();

      if (!this.allowStandaloneSession && !pid) {
        this.form.controls.projectQuery.setErrors({ required: true });
        this.form.controls.projectQuery.markAsTouched();
        return;
      }

      if (this.allowStandaloneSession && !pid && !raw.clientId.trim()) {
        this.form.controls.projectQuery.setErrors({ required: true });
        this.form.controls.projectQuery.markAsTouched();
        this.form.controls.clientQuery.setErrors({ required: true });
        this.form.controls.clientQuery.markAsTouched();
        return;
      }

      const n = raw.sessionNumber ?? 1;
      this.form.controls.sessionNumber.setValue(n, { emitEvent: false });
    }

    // CreateDraft (canonico)
    const draft: CreateDraft = {
      type: raw.type,
      artistId: raw.artistId,
      start,
      end,
      durationMinutes: raw.durationMinutes,
      status: raw.status,

      clientId: raw.clientId.trim() || undefined,
      projectId: raw.projectId.trim() || undefined,
      bookingId: raw.bookingId.trim() || undefined,

      zone: raw.zone.trim() || undefined,
      notes: raw.notes.trim() || undefined,

      // extra session (se supportati dal tuo model)
      sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
      painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
      notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
      healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
      paidAmount: raw.type === 'session' ? (raw.paidAmount ?? undefined) : undefined,
    } as any;

    // CREATE
    if (this.mode === 'create') {
      this.submit.emit({ mode: 'create', draft });
      return;
    }

    // EDIT
    if (!this.editingEventId) {
      console.error('[EVENT-DRAWER] mode=edit ma editingEventId è null');
      return;
    }

    const update: UpdatePatch = {
      id: this.editingEventId,
      type: raw.type,
      patch: {
        artistId: raw.artistId,
        start,
        end,
        durationMinutes: raw.durationMinutes,
        status: raw.status,

        clientId: raw.clientId.trim() || undefined,
        projectId: raw.projectId.trim() || undefined,
        bookingId: raw.bookingId.trim() || undefined,
        zone: raw.zone.trim() || undefined,
        notes: raw.notes.trim() || undefined,

        // extra session (se supportati dal tuo model)
        sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
        painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
        notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
        healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
        paidAmount: raw.type === 'session' ? (raw.paidAmount ?? undefined) : undefined,
      } as any,
    };

    this.submit.emit({ mode: 'edit', draft, update });
  }

  // ---------------------------------------------
  // Helpers: date/time
  // ---------------------------------------------
  private computeStartEnd(day: Date, timeHHmm: string, durationMin: number) {
    const [hh, mm] = timeHHmm.split(':').map(Number);
    const startDate = new Date(day);
    startDate.setHours(hh, mm, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + durationMin);

    return {
      start: this.toLocalDateTime(startDate),
      end: this.toLocalDateTime(endDate),
    };
  }

  private recomputeAvailableTimes(): void {
    const artistId = this.form.controls.artistId.value;
    const day = this.form.controls.day.value;
    const durationMinutes = Number(this.form.controls.durationMinutes.value ?? 0);

    const artist = (this.artists ?? []).find(a => String(a.id) === String(artistId));
    const workdayStart = String((artist as any)?.workdayStart ?? '08:00');
    const workdayEnd = String((artist as any)?.workdayEnd ?? '19:00');
    const step = Number((artist as any)?.stepMinutes ?? 30) || 30;
    const timeOptions = this.buildTimes(workdayStart, workdayEnd, step);

    if (!artistId || !day || !durationMinutes) {
      this.availableTimeOptions = [...timeOptions];
      return;
    }

    const dayKey = this.toLocalDateKey(day);
    const busy = (this.events ?? [])
      .filter(e => e?.artistId === artistId)
      .filter(e => this.toLocalDateKey(new Date(e.start)) === dayKey)
      .filter(e => !this.editingEventId || e.id !== this.editingEventId);

    const nonBlocking = new Set(['cancelled', 'no_show']);
    const busyFiltered = busy.filter(e => !nonBlocking.has(String((e as any).status ?? '').toLowerCase()));

    const free: string[] = [];
    for (const t of timeOptions) {
      const slotStart = new Date(`${dayKey}T${t}:00`);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      const overlaps = busyFiltered.some(ev => {
        const evStart = new Date(ev.start);
        const evEnd = new Date(ev.end);
        return slotStart < evEnd && slotEnd > evStart;
      });

      if (!overlaps) free.push(t);
    }

    this.availableTimeOptions = free;

    const currentTime = this.form.controls.time.value;
    if (currentTime && !free.includes(currentTime) && free.length > 0) {
      this.form.controls.time.setValue(free[0], { emitEvent: false });
    }
  }

  private toLocalDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toLocalDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  private buildTimes(from: string, to: string, stepMin: number): string[] {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const start = fh * 60 + fm;
    const end = th * 60 + tm;

    const out: string[] = [];
    for (let m = start; m <= end; m += stepMin) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    return out;
  }

  // ---------------------------------------------
  // Helpers: filtri autocomplete
  // ---------------------------------------------
  private matchClient(c: ClientLite, q: string): boolean {
    const name = (c.fullName ?? '').toLowerCase();
    const email = (c.email ?? '').toLowerCase();
    const phone = (c.phone ?? '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  }

  private matchProject(p: ProjectLite, q: string): boolean {
    return (p.title ?? '').toLowerCase().includes(q);
  }

  private matchBooking(b: BookingLite, q: string): boolean {
    const clientName = (this.clients.find(c => c.id === b.clientId)?.fullName ?? '').toLowerCase();
    const time = b.start ? this.formatTime(b.start).toLowerCase() : '';
    const id = String(b.id ?? '').toLowerCase();
    return clientName.includes(q) || time.includes(q) || id.includes(q);
  }

  private matchesAnyId(entity: any, expected: string): boolean {
    const want = String(expected ?? '').trim();
    if (!want) return false;
    const candidates = [
      String(entity?.id ?? '').trim(),
      String(entity?.uid ?? '').trim(),
      String(entity?.userId ?? '').trim()
    ].filter(Boolean);
    return candidates.includes(want);
  }

  // ---------------------------------------------
  // Patch initial (seed/edit)
  // ---------------------------------------------
  private patchFromInitial(v: Partial<DrawerDraft>) {
    let day: Date | null = null;
    let time = '10:00';

    if (v.start) {
      const d = new Date(v.start);
      if (!isNaN(d.getTime())) {
        day = d;
        time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }

    this.form.patchValue({
      type: (v.type ?? 'booking') as UiEventType,
      artistId: v.artistId ?? '',
      day: day ?? new Date(),
      time,
      durationMinutes: v.durationMinutes ?? v.duration ?? 60,
      status: v.status ?? (v.type === 'session' ? 'planned' : 'draft'),

      clientId: v.clientId ?? '',
      projectId: v.projectId ?? '',
      bookingId: v.bookingId ?? '',

      zone: v.zone ?? '',
      notes: v.notes ?? '',

      sessionNumber: v.sessionNumber ?? null,
      painLevel: v.painLevel ?? null,
      notesByAdmin: v.notesByAdmin ?? '',
      healingNotes: v.healingNotes ?? '',
      paidAmount: (v as any).paidAmount ?? null,
    });

    if (v.type === 'session' && (v.sessionNumber == null || Number.isNaN(Number(v.sessionNumber)))) {
      this.form.controls.sessionNumber.setValue(1, { emitEvent: false });
    }
    if (v.type === 'session' && v.sessionNumber != null && !Number.isNaN(Number(v.sessionNumber))) {
      this.form.controls.sessionNumber.setValue(Number(v.sessionNumber), { emitEvent: false });
    }

    // popola la UI con oggetti (nome/titolo)
    if (v.clientId) {
      const c = this.clients.find(x => this.matchesAnyId(x, String(v.clientId)));
      if (c) this.form.controls.clientQuery.setValue(c, { emitEvent: false });
      else this.form.controls.clientQuery.setValue(String(v.clientId), { emitEvent: false });
    }
    if (v.projectId) {
      const p = this.projects.find(x => this.matchesAnyId(x, String(v.projectId)));
      if (p) this.form.controls.projectQuery.setValue(p, { emitEvent: false });
      else this.form.controls.projectQuery.setValue(String(v.projectId), { emitEvent: false });
    }
    if (v.bookingId) {
      const b = this.bookings.find(x => this.matchesAnyId(x, String(v.bookingId)));
      if (b) this.form.controls.bookingQuery.setValue(b, { emitEvent: false });
      else this.form.controls.bookingQuery.setValue(String(v.bookingId), { emitEvent: false });
    }

    this.recomputeDisabledState();
  }

  private hydrateClientQueryFromId(): void {
    const clientId = this.form.controls.clientId.value;
    if (!clientId) return;
    const current = this.form.controls.clientQuery.value;
    if (current && typeof current !== 'string') return;
    const c = (this.clients ?? []).find(x => this.matchesAnyId(x, clientId));
    if (c) this.form.controls.clientQuery.setValue(c, { emitEvent: false });
    else this.form.controls.clientQuery.setValue(String(clientId), { emitEvent: false });
  }

  private hydrateProjectQueryFromId(): void {
    const projectId = this.form.controls.projectId.value;
    if (!projectId) return;
    const current = this.form.controls.projectQuery.value;
    if (current && typeof current !== 'string') return;
    const p = (this.projects ?? []).find(x => this.matchesAnyId(x, projectId));
    if (p) this.form.controls.projectQuery.setValue(p, { emitEvent: false });
    else this.form.controls.projectQuery.setValue(String(projectId), { emitEvent: false });
    this.syncSessionNumberFromProject(projectId);
  }

  private hydrateBookingQueryFromId(): void {
    const bookingId = this.form.controls.bookingId.value;
    if (!bookingId) return;
    const current = this.form.controls.bookingQuery.value;
    if (current && typeof current !== 'string') return;
    const b = (this.bookings ?? []).find(x => this.matchesAnyId(x, bookingId));
    if (b) this.form.controls.bookingQuery.setValue(b, { emitEvent: false });
    else this.form.controls.bookingQuery.setValue(String(bookingId), { emitEvent: false });
  }

  private syncSessionNumberFromProject(projectId?: string): void {
    if (!projectId) return;
    const p = (this.projects ?? []).find(x => x.id === projectId);
    const countFromProject = p?.sessionIds?.length ?? 0;
    const countFromEvents = (this.events ?? [])
      .filter(e => e.type === 'session' && e.projectId === projectId)
      .length;
    const count = Math.max(countFromProject, countFromEvents);
    const next = count + 1;
    this.form.controls.sessionNumber.setValue(next, { emitEvent: false });
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
}
