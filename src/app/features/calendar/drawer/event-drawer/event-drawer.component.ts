import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { BehaviorSubject, Observable, combineLatest, map, startWith } from 'rxjs';
import { UiCalendarEvent } from '../../models';
import { UiArtist } from '../../models';
import { EventDrawerHelper } from './event-drawer.helper';
import {
  BookingLite,
  ClientLite,
  CreateProjectTriggerPayload,
  DrawerDraft,
  EventDrawerResult,
  ProjectLite
} from './event-drawer.types';
import {
  EVENT_DRAWER_BOOKING_STATUS_OPTIONS,
  EVENT_DRAWER_DURATION_OPTIONS,
  EVENT_DRAWER_SESSION_STATUS_OPTIONS
} from './event-drawer.constants';
import { EventDrawerFormService } from './event-drawer-form.service';
import { EventDrawerProjectSelectionService } from './event-drawer-project-selection.service';

@Component({
  selector: 'app-event-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, CdkScrollable],
  templateUrl: './event-drawer.component.html',
  styleUrls: ['./event-drawer.component.scss'],
})
export class EventDrawerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly drawerFormService = inject(EventDrawerFormService);
  private readonly projectSelectionService = inject(EventDrawerProjectSelectionService);

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

  /** consente la creazione progetto (admin) */
  @Input() canCreateProjects = false;

  /** consente la creazione progetto se lo staff sta lavorando sulla consulenza assegnata */
  @Input() canCreateProjectForAssignedBooking = false;

  /** seed/patch (create o edit) */
  @Input() initialValue: Partial<DrawerDraft> | null = null;

  /** ✅ ID evento in edit (serve per UpdatePatch) */
  @Input() editingEventId: string | null = null;

  get projectCreationEnabled(): boolean {
    return this.canCreateProjects || this.canCreateProjectForAssignedBooking;
  }

  @Output() close = new EventEmitter<void>();

  /** ✅ ORA emette EventDrawerResult (non più DrawerDraft) */
  private projectWarningConfirmedId: string | null = null;

  // ---------------------------------------------
  // UI options
  // ---------------------------------------------
  readonly timeOptions = EventDrawerHelper.buildTimes('08:00', '19:00', 30);
  availableTimeOptions: string[] = EventDrawerHelper.buildTimes('08:00', '19:00', 30);
  readonly durationOptions = EVENT_DRAWER_DURATION_OPTIONS;
  readonly bookingStatusOptions = EVENT_DRAWER_BOOKING_STATUS_OPTIONS;
  readonly sessionStatusOptions = EVENT_DRAWER_SESSION_STATUS_OPTIONS;
  readonly form = this.drawerFormService.createForm(this.fb);

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
          .filter(c => EventDrawerHelper.matchClient(c, query))
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
        const scoped = (list ?? [])
          .filter(p => !clientId || p.clientId === clientId)
          .filter(p => !artistId || !p.artistId || p.artistId === artistId);
        const base = scoped.length > 0 ? scoped : (list ?? []);

        if (!query) return base.slice(0, 30);
        return base
          .filter(p => EventDrawerHelper.matchProject(p, query))
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
        const scoped = (list ?? [])
          .filter(b => !clientId || b.clientId === clientId)
          .filter(b => !artistId || b.artistId === artistId);
        const base = scoped.length > 0 ? scoped : (list ?? []);

        if (!query) return base.slice(0, 30);
        return base
          .filter(b => EventDrawerHelper.matchBooking(b, query, this.clients ?? []))
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

  getClientOptionSubtext(value: ClientLite | null | undefined): string {
    const email = String(value?.email ?? '').trim();
    const phone = String(value?.phone ?? '').trim();
    if (email && phone) return `${email} · ${phone}`;
    if (email) return email;
    if (phone) return phone;
    return 'Non disponibile';
  }

  displayProject = (value: ProjectLite | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.title;
  };

  displayBooking = (value: BookingLite | string | null): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const time = value.start ? EventDrawerHelper.formatTime(value.start) : '';
    const clientName = EventDrawerHelper.getClientReadableLabel(this.clients ?? [], value.clientId, value.title);
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
    this.drawerFormService.recomputeDisabledState(this.form, {
      lockSchedule,
      lockAssignment,
      lockProjectSelection: this.isAssignmentLocked(),
      artistId: this.form.controls.artistId.value,
      lockSessionNumber: this.isAssignmentLocked()
    });
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
        this.clearClient(false);
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
        const c = EventDrawerHelper.findByAnyId(this.clients ?? [], p.clientId);
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
    this.projectWarningConfirmedId = null;
  }

  clearClient(emit = true) {
    this.form.controls.clientId.setValue('', { emitEvent: emit });
    this.form.controls.clientQuery.setValue('', { emitEvent: false });
    this.projectWarningConfirmedId = null;
  }

  onProjectSelected(p: ProjectLite | null | undefined) {
    if (!p || !p.id) {
      return;
    }
    queueMicrotask(async () => {
      this.projectWarningConfirmedId = await this.projectSelectionService.applySelection({
        form: this.form,
        project: p,
        clients: this.clients ?? [],
        bookings: this.bookings ?? [],
        mode: this.mode,
        isBooking: this.isBooking(),
        editingEventId: this.editingEventId,
        confirmedProjectId: this.projectWarningConfirmedId
      });
    });
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
      const c = EventDrawerHelper.findByAnyId(this.clients ?? [], b.clientId);
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
    this.projectWarningConfirmedId = null;
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
    const bookingIdFromForm = String(this.form.controls.bookingId.value ?? '').trim();
    const bookingIdFromEdit =
      this.mode === 'edit' && this.isBooking()
        ? String(this.editingEventId ?? '').trim()
        : '';
    const bookingId = bookingIdFromForm || bookingIdFromEdit;

    this.createProjectRequested.emit({
      clientId: this.form.controls.clientId.value || undefined,
      artistId: this.form.controls.artistId.value || undefined,
      titleHint: titleHint || undefined,
      bookingId: bookingId || undefined
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
    const match = (this.bookings ?? []).find(b => EventDrawerHelper.matchBooking(b, q, this.clients ?? []));
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
    const { start, end } = EventDrawerHelper.computeStartEnd(raw.day!, raw.time, raw.durationMinutes);

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

      if (!pid) {
        this.form.controls.projectQuery.setErrors({ required: true });
        this.form.controls.projectQuery.markAsTouched();
        return;
      }

      const n = raw.sessionNumber ?? 1;
      this.form.controls.sessionNumber.setValue(n, { emitEvent: false });
    }

    const draft = this.drawerFormService.buildDraft(raw, start, end);

    // CREATE
    if (this.mode === 'create') {
      this.submit.emit({
        mode: 'create',
        draft,
        projectWarningConfirmedId: this.projectWarningConfirmedId ?? undefined
      });
      return;
    }

    // EDIT
    if (!this.editingEventId) {
      console.error('[EVENT-DRAWER] mode=edit ma editingEventId è null');
      return;
    }

    const update = this.drawerFormService.buildUpdate(this.editingEventId, raw, start, end);

    this.submit.emit({
      mode: 'edit',
      draft,
      update,
      projectWarningConfirmedId: this.projectWarningConfirmedId ?? undefined
    });
  }

  private recomputeAvailableTimes(): void {
    this.availableTimeOptions = EventDrawerHelper.computeAvailableTimeOptions({
      artistId: this.form.controls.artistId.value,
      day: this.form.controls.day.value,
      durationMinutes: Number(this.form.controls.durationMinutes.value ?? 0),
      artists: this.artists ?? [],
      events: this.events ?? [],
      editingEventId: this.editingEventId,
      fallbackStart: '08:00',
      fallbackEnd: '19:00',
      fallbackStepMinutes: 30
    });

    const currentTime = this.form.controls.time.value;
    if (currentTime && !this.availableTimeOptions.includes(currentTime) && this.availableTimeOptions.length > 0) {
      this.form.controls.time.setValue(this.availableTimeOptions[0], { emitEvent: false });
    }
  }

  // ---------------------------------------------
  // Patch initial (seed/edit)
  // ---------------------------------------------
  private patchFromInitial(v: Partial<DrawerDraft>) {
    this.projectWarningConfirmedId = null;
    this.drawerFormService.patchFromInitial(this.form, v, this.clients ?? [], this.projects ?? [], this.bookings ?? []);
    this.recomputeDisabledState();
  }

  private hydrateClientQueryFromId(): void {
    this.drawerFormService.hydrateClientQueryFromId(this.form, this.clients ?? []);
  }

  private hydrateProjectQueryFromId(): void {
    this.drawerFormService.hydrateProjectQueryFromId(this.form, this.projects ?? []);
    this.syncSessionNumberFromProject(this.form.controls.projectId.value);
  }

  private hydrateBookingQueryFromId(): void {
    this.drawerFormService.hydrateBookingQueryFromId(this.form, this.bookings ?? []);
  }

  private syncSessionNumberFromProject(projectId?: string): void {
    this.drawerFormService.syncSessionNumberFromProject(this.form, projectId, this.projects ?? [], this.events ?? []);
  }
}



