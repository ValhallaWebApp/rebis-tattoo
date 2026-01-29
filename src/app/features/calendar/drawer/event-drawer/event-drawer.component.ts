import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Observable, combineLatest, map, of, startWith } from 'rxjs';
import { CreateDraft, UpdatePatch } from '../../models';

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

@Component({
  selector: 'app-event-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './event-drawer.component.html',
  styleUrls: ['./event-drawer.component.scss'],
})
export class EventDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  // ---------------------------------------------
  // INPUTS
  // ---------------------------------------------
  @Output() submit = new EventEmitter<EventDrawerResult>();

  /** create/edit */
  @Input() mode: 'create' | 'edit' = 'create';

  /** lista artisti (id + name) */
  @Input() artists: Array<{ id: string; name: string }> = [];

  /** ✅ PRELOAD: clienti */
  @Input() clients: ClientLite[] = [];

  /** ✅ PRELOAD: progetti */
  @Input() projects: ProjectLite[] = [];

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
  readonly durationOptions = [30, 45, 60, 90, 120, 150, 180];

  readonly bookingStatusOptions = [
    { value: 'draft', label: 'Bozza' },
    { value: 'pending', label: 'In attesa' },
    { value: 'confirmed', label: 'Confermata' },
    { value: 'paid', label: 'Pagata' },
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

    // opzionali comuni
    zone: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control(''),

    // extra session
    sessionNumber: this.fb.control<number | null>(null),
    painLevel: this.fb.control<number | null>(null),
    notesByAdmin: this.fb.nonNullable.control(''),
    healingNotes: this.fb.nonNullable.control(''),
  });

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
    combineLatest([this.clientQueryText$, of(this.clients)]).pipe(
      map(([q]) => {
        const query = q.trim();
        if (!query) return this.clients.slice(0, 30);
        return this.clients
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
    combineLatest([this.projectQueryText$, of(this.projects)]).pipe(
      map(([q]) => {
        const query = q.trim();
        if (!query) return this.projects.slice(0, 30);
        return this.projects
          .filter(p => this.matchProject(p, query))
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

  // ---------------------------------------------
  // Helpers per template
  // ---------------------------------------------
  isBooking() { return this.form.controls.type.value === 'booking'; }
  isSession() { return this.form.controls.type.value === 'session'; }

  ngOnInit(): void {
    // Regola: cambio type -> status default + pulizia campi non pertinenti
    this.form.controls.type.valueChanges.subscribe(t => {
      if (t === 'booking') {
        this.form.controls.status.setValue('draft', { emitEvent: false });
        this.clearProject(false);
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

    // Patch initial value
    if (this.initialValue) {
      this.patchFromInitial(this.initialValue);
    }

    // progetto -> sessionNumber auto + client auto (opzionale)
    this.form.controls.projectId.valueChanges.subscribe(pid => {
      if (!pid) {
        if (this.isSession()) this.form.controls.sessionNumber.setValue(1, { emitEvent: false });
        return;
      }

      const p = this.projects.find(x => x.id === pid);
      const count = p?.sessionIds?.length ?? 0;
      const next = count + 1;

      this.form.controls.sessionNumber.setValue(next, { emitEvent: false });

      if (p?.clientId) {
        const c = this.clients.find(x => x.id === p.clientId);
        if (c) {
          this.form.controls.clientId.setValue(c.id, { emitEvent: false });
          this.form.controls.clientQuery.setValue(c, { emitEvent: false });
        }
      }
    });
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

  clearProject(emit = true) {
    this.form.controls.projectId.setValue('', { emitEvent: emit });
    this.form.controls.projectQuery.setValue('', { emitEvent: false });
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

      zone: raw.zone.trim() || undefined,
      notes: raw.notes.trim() || undefined,

      // extra session (se supportati dal tuo model)
      sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
      painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
      notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
      healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
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
        start,
        end,
        durationMinutes: raw.durationMinutes,
        status: raw.status,

        clientId: raw.clientId.trim() || undefined,
        projectId: raw.projectId.trim() || undefined,
        zone: raw.zone.trim() || undefined,
        notes: raw.notes.trim() || undefined,

        // extra session (se supportati dal tuo model)
        sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
        painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
        notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
        healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
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

      zone: v.zone ?? '',
      notes: v.notes ?? '',

      sessionNumber: v.sessionNumber ?? null,
      painLevel: v.painLevel ?? null,
      notesByAdmin: v.notesByAdmin ?? '',
      healingNotes: v.healingNotes ?? '',
    });

    // popola la UI con oggetti (nome/titolo)
    if (v.clientId) {
      const c = this.clients.find(x => x.id === v.clientId);
      if (c) this.form.controls.clientQuery.setValue(c, { emitEvent: false });
    }
    if (v.projectId) {
      const p = this.projects.find(x => x.id === v.projectId);
      if (p) this.form.controls.projectQuery.setValue(p, { emitEvent: false });
    }
  }
}
