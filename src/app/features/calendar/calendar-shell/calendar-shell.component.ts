import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatChipListboxChange } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

import { CalendarViewMode, CreateDraft, UiArtist, UiCalendarEvent, UpdatePatch } from '../models';
import { addDays } from '../utils';

import { AdminActionPayload, DayViewComponent } from '../views/day-view/day-view.component';
import { WeekResourceComponent } from '../views/week-resource/week-resource/week-resource.component';
import { MonthViewComponent } from '../views/month-view/month-view.component';

import {
  NewEventDialogComponent,
  NewEventDialogResult
} from '../dialogs/new-event-dialog/new-event-dialog/new-event-dialog.component';

import {
  AvailabilitySheetComponent,
  AvailabilitySheetResult
} from '../dialogs/availability-sheet/availability-sheet/availability-sheet.component';

import { BookingLite, EventDrawerComponent, EventDrawerResult } from '../drawer/event-drawer/event-drawer.component';
import { MaterialModule } from '../../../core/modules/material.module';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { UiFeedbackService } from '../../../core/services/ui/ui-feedback.service';
import { CreateProjectDialogComponent, CreateProjectDialogResult } from '../dialogs/create-project-dialog/create-project-dialog.component';
import { CompleteSessionDecision, CompleteSessionDialogComponent } from '../dialogs/complete-session-dialog/complete-session-dialog.component';
import { CreateProjectTriggerPayload } from '../drawer/event-drawer/event-drawer.component';

// ✅ servizi preload (adatta i path al tuo progetto)

// ✅ tipi lite usati dal drawer (importali dal drawer per evitare duplicazioni)
import { ClientLite, ProjectLite } from '../drawer/event-drawer/event-drawer.component';
import { ClientService } from '../../../core/services/clients/client.service';
import { ProjectsService } from '../../../core/services/projects/projects.service';

@Component({
  selector: 'app-calendar-shell',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    DayViewComponent,
    WeekResourceComponent,
    MonthViewComponent,
    EventDrawerComponent,
    CompleteSessionDialogComponent,
  ],
  templateUrl: './calendar-shell.component.html',
  styleUrls: ['./calendar-shell.component.scss'],
})
export class CalendarShellComponent implements OnChanges {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(UiFeedbackService);
  private readonly router = inject(Router);
  private readonly sheet = inject(MatBottomSheet);

  // ✅ preload services
  private readonly clientService = inject(ClientService);
  private readonly projectService = inject(ProjectsService);

  @Input({ required: true }) artists: UiArtist[] = [];
  @Input({ required: true }) events: UiCalendarEvent[] = [];
  @Input() loading = false;

  @Output() createRequested = new EventEmitter<CreateDraft>();
  @Output() updateRequested = new EventEmitter<UpdatePatch>();

  // ---------------------------------------------
  // ✅ Liste pre-caricate per gli autocomplete del drawer
  // ---------------------------------------------
  clientsLite: ClientLite[] = [];
  projectsLite: ProjectLite[] = [];
  createdProject: ProjectLite | null = null;
  bookingsLite: BookingLite[] = [];

  // opzionale: per evitare doppi load
  private preloadDone = false;

  // ---------------------------------------------
  // Input signals (per reattività)
  // ---------------------------------------------
  private readonly artistsSig = signal<UiArtist[]>([]);
  private readonly eventsSig = signal<UiCalendarEvent[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['artists']) {
      this.artistsSig.set(changes['artists'].currentValue ?? []);
    }
    if (changes['events']) {
      const list = changes['events'].currentValue ?? [];
      this.eventsSig.set(list);
      this.rebuildBookingsLite(list);
    }
  }

  // ---------------------------------------------
  // View state
  // ---------------------------------------------
  readonly view = signal<CalendarViewMode>('week');
  readonly anchorDate = signal<Date>(new Date());

  // default selected artists = all active
  readonly selectedArtistIds = signal<string[]>([]);

  readonly weekRange = computed(() => {
    const d = this.anchorDate();
    const start = new Date(d);
    const day = start.getDay(); // 0 Sun
    const diffToMon = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMon);
    const end = addDays(start, 6);
    return { start, end };
  });

  readonly selectedArtists = computed(() => {
    const sel = this.selectedArtistIds();
    const list = this.artistsSig();
    if (!sel.length) return list.filter(a => a.isActive !== false);
    return list.filter(a => sel.includes(a.id));
  });

  readonly eventsForSelectedArtists = computed(() => {
    const sel = new Set(this.selectedArtists().map(a => a.id));
    return this.eventsSig().filter(e => sel.has(e.artistId));
  });

  // ---------------------------------------------
  // Drawer state
  // ---------------------------------------------
  drawerOpen = false;
  drawerMode: 'create' | 'edit' = 'create';

  /** ✅ seed per create (start/end precompilati) */
  drawerSeed: Partial<CreateDraft> | null = null;

  /** ✅ evento in edit */
  drawerEditingEvent: UiCalendarEvent | null = null;

  ngOnInit() {
    // init selection = all active
    queueMicrotask(() => {
      const all = this.artistsSig().filter(a => a.isActive !== false).map(a => a.id);
      this.selectedArtistIds.set(all);
    });

    // preload lite lists
    this.preloadDrawerLists();
  }

  // ---------------------------------------------
  // ✅ PRELOAD per drawer autocomplete
  // ---------------------------------------------
  private preloadDrawerLists(): void {
    if (this.preloadDone) return;
    this.preloadDone = true;

    // ⚠️ Adatta ai metodi reali del tuo progetto
    this.clientService.getClientsLiteOnce().subscribe({
      next: (list) => (this.clientsLite = list ?? []),
      error: (err) => console.error('[CAL-SHELL] preload clientsLite error', err),
    });

    this.projectService.getProjectsLiteOnce().subscribe({
      next: (list) => (this.projectsLite = list ?? []),
      error: (err) => console.error('[CAL-SHELL] preload projectsLite error', err),
    });
  }

  // ---------------------------------------------
  // Navigation / view
  // ---------------------------------------------
  setView(v: CalendarViewMode) {
    this.view.set(v);
  }

  goPrev() {
    const d = new Date(this.anchorDate());
    if (this.view() === 'day') d.setDate(d.getDate() - 1);
    else if (this.view() === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    this.anchorDate.set(d);
  }

  goNext() {
    const d = new Date(this.anchorDate());
    if (this.view() === 'day') d.setDate(d.getDate() + 1);
    else if (this.view() === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    this.anchorDate.set(d);
  }

  goToday() {
    this.anchorDate.set(new Date());
  }

  onArtistsChipChange(ev: MatChipListboxChange) {
    const ids = (ev.value ?? []) as string[];
    this.selectedArtistIds.set(ids);
  }

  // ---------------------------------------------
  // Toolbar: nuovo evento
  // ---------------------------------------------
  async onToolbarNew() {
    const dialogRef = this.dialog.open<NewEventDialogComponent, any, NewEventDialogResult>(
      NewEventDialogComponent,
      {
        width: '520px',
        maxWidth: '92vw',
        data: {
          artists: this.artists.filter(a => a.isActive !== false),
        },
      }
    );

    const res = await dialogRef.afterClosed().toPromise();
    if (!res?.seed) return;

    const sheetRef = this.sheet.open<AvailabilitySheetComponent, any, AvailabilitySheetResult>(
      AvailabilitySheetComponent,
      {
        data: {
          seed: res.seed,
          artists: this.artists,
          events: this.events,
        },
      }
    );

    const slot = await sheetRef.afterDismissed().toPromise();
    if (!slot?.startISO || !slot?.endISO) return;

    this.drawerMode = 'create';
    this.drawerSeed = {
      type: res.seed.type,
      artistId: res.seed.artistId,
      durationMinutes: res.seed.durationMinutes,
      start: slot.startISO,
      end: slot.endISO,
    };
    this.drawerEditingEvent = null;
    this.drawerOpen = true;
  }

  // ---------------------------------------------
  // called from views
  // ---------------------------------------------
  openDayFromWeekCell(payload: { artistId: string; dateKey: string }) {
    this.view.set('day');
    this.anchorDate.set(new Date(`${payload.dateKey}T00:00:00`));
    this.selectedArtistIds.set([payload.artistId]);
  }

  openDayFromMonth(payload: { dateKey: string }) {
    this.view.set('day');
    this.anchorDate.set(new Date(`${payload.dateKey}T00:00:00`));
  }

openCreateFromDay(payload: { artistId: string; startISO: string; endISO: string; durationMinutes: number }) {
  this.drawerMode = 'create';
  this.drawerSeed = {
    type: 'booking',
    artistId: payload.artistId,
    start: payload.startISO,
    end: payload.endISO,
    durationMinutes: payload.durationMinutes,
  };
  this.drawerEditingEvent = null;
  this.drawerOpen = true;
}


  openEditEvent(ev: UiCalendarEvent) {
    this.drawerMode = 'edit';
    this.drawerEditingEvent = ev;
    this.drawerSeed = this.toSeedFromEvent(ev);
    this.drawerOpen = true;
  }

  private openCreateSessionFromBooking(ev: UiCalendarEvent): void {
    const durationMinutes = this.diffMinutes(ev.start, ev.end) || 60;
    const next = this.computeNextSessionSeed(ev.projectId, ev.end, durationMinutes);
    this.drawerMode = 'create';
    this.drawerSeed = {
      type: 'session',
      artistId: ev.artistId,
      start: next.start,
      end: next.end,
      durationMinutes,
      clientId: ev.clientId,
      projectId: ev.projectId,
      bookingId: ev.id,
      status: 'planned',
      sessionNumber: next.sessionNumber
    } as any;
    this.drawerEditingEvent = null;
    this.drawerOpen = true;
  }

  private openCreateSessionFromProject(payload: { projectId: string; artistId: string; clientId?: string }): void {
    const durationMinutes = 60;
    const next = this.computeNextSessionSeed(payload.projectId, undefined, durationMinutes);
    this.drawerMode = 'create';
    this.drawerSeed = {
      type: 'session',
      artistId: payload.artistId,
      start: next.start,
      end: next.end,
      durationMinutes,
      clientId: payload.clientId,
      projectId: payload.projectId,
      status: 'planned',
      sessionNumber: next.sessionNumber
    } as any;
    this.drawerEditingEvent = null;
    this.drawerOpen = true;
  }

  private computeNextSessionSeed(projectId?: string, fallbackStart?: string, durationMinutes: number = 60) {
    const sessions = (this.eventsSig() ?? [])
      .filter(e => e.type === 'session')
      .filter(e => projectId && e.projectId === projectId);

    const lastEnd = sessions
      .map(s => new Date(s.end))
      .filter(d => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
      .pop();

    const startDate =
      lastEnd ??
      (fallbackStart ? new Date(fallbackStart) : null) ??
      new Date();

    const start = this.toLocalDateTime(startDate);
    const end = this.toLocalDateTime(new Date(startDate.getTime() + durationMinutes * 60000));
    const sessionNumber = (sessions.length || 0) + 1;

    return { start, end, sessionNumber };
  }

  onDrawerClosed() {
    this.drawerOpen = false;
    this.drawerSeed = null;
    this.drawerEditingEvent = null;
  }

  // ---------------------------------------------
  // ✅ submit dal drawer (EventDrawerResult)
  // ---------------------------------------------
  async onDrawerSubmit(result: EventDrawerResult) {
    if (result.mode === 'create') {
      if (result.draft.type === 'booking' && result.draft.projectId) {
        const ok = await this.confirmProjectOverride(result.draft.projectId);
        if (!ok) return;
      }
      if (result.draft.type === 'session' && result.draft.status === 'completed') {
        const decision = await this.askCompleteSessionDecision({
          ...(result.draft as any),
          id: 'draft',
          type: 'session'
        } as UiCalendarEvent);
        if (decision === 'cancel') return;
        this.applyCompleteSessionDecision(decision, {
          ...(result.draft as any),
          id: 'draft',
          type: 'session'
        } as UiCalendarEvent);
      }
      this.createRequested.emit(result.draft);
      this.onDrawerClosed();
      return;
    }

    if (result.mode === 'edit') {
      if (result.update?.type === 'booking' && result.update.patch?.projectId) {
        const ok = await this.confirmProjectOverride(result.update.patch.projectId, result.update.id);
        if (!ok) return;
      }
      if (result.update?.type === 'session' && result.update.patch?.status === 'completed') {
        const decision = await this.askCompleteSessionDecision({
          ...(this.drawerEditingEvent as any),
          ...(result.update.patch as any),
          id: result.update.id,
          type: 'session'
        } as UiCalendarEvent);
        if (decision === 'cancel') return;
        this.applyCompleteSessionDecision(decision, {
          ...(this.drawerEditingEvent as any),
          ...(result.update.patch as any),
          id: result.update.id,
          type: 'session'
        } as UiCalendarEvent);
      }
      if (result.update) this.updateRequested.emit(result.update);
      this.onDrawerClosed();
      return;
    }
  }

  // ---------------------------------------------
  // Header label
  // ---------------------------------------------
  get headerLabel(): string {
    const d = this.anchorDate();
    if (this.view() === 'day') {
      return d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
    if (this.view() === 'month') {
      return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }
    const r = this.weekRange();
    const s = r.start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    const e = r.end.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  // ---------------------------------------------
  // DayView actions (status / quick ops)
  // ---------------------------------------------
  async onDayAction(payload: AdminActionPayload) {
    const ev = payload?.event;
    if (!ev?.id) return;

    if (payload.type === 'create_session') {
      this.openCreateSessionFromBooking(ev);
      return;
    }

    if (payload.type === 'assign_project') {
      await this.createProjectAndAssign(ev);
      return;
    }

    if (payload.type === 'cancel') {
      const confirmed = await this.confirmCancel(ev);
      if (!confirmed) return;
    }

    // Quick actions mapping
    const nextStatus = this.mapActionToStatus(payload.type, ev.type);
    if (!nextStatus) {
      if (payload.type === 'reschedule' || payload.type === 'edit' || payload.type === 'open') {
        this.openEditEvent(ev);
      }
      return;
    }

    if (payload.type === 'complete' && ev.type === 'session') {
      const decision = await this.askCompleteSessionDecision(ev);
      if (decision === 'cancel') return;
      this.applyCompleteSessionDecision(decision, ev);
    }

    if (payload.type === 'confirm' && ev.type === 'booking' && !ev.projectId) {
      const created = await this.createProjectAndAssign(ev, nextStatus);
      if (!created) return;
      return;
    }

    const update: UpdatePatch = {
      id: ev.id,
      type: ev.type,
      patch: {
        status: nextStatus,
        ...(ev.projectId ? { projectId: ev.projectId } : {}),
        ...(ev.clientId ? { clientId: ev.clientId } : {})
      } as any,
    };

    this.updateRequested.emit(update);

    if (payload.type === 'complete' && ev.type === 'booking' && ev.projectId) {
      const go = await this.confirmOpenProject(ev.projectId);
      if (go) this.router.navigate(['/admin/portfolio', ev.projectId]);
    }
  }

  private async askCompleteSessionDecision(ev: UiCalendarEvent): Promise<CompleteSessionDecision> {
    const projectTitle = ev.projectId
      ? this.projectsLite.find(p => p.id === ev.projectId)?.title
      : undefined;
    const ref = this.dialog.open(CompleteSessionDialogComponent, {
      width: '520px',
      maxWidth: '92vw',
      data: { projectTitle }
    });
    const res = await firstValueFrom(ref.afterClosed());
    return (res ?? 'cancel') as CompleteSessionDecision;
  }

  private applyCompleteSessionDecision(decision: CompleteSessionDecision, ev: UiCalendarEvent): void {
    const projectId = String(ev.projectId ?? '').trim();
    if (!projectId) {
      this.snackBar.open('Collega un progetto prima di chiudere o creare nuove sessioni.', 'OK', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });
      this.openEditEvent(ev);
      return;
    }

    if (decision === 'healing') {
      this.projectService.updateProject(projectId, { status: 'healing' });
      return;
    }

    if (decision === 'close_project') {
      this.projectService.updateProject(projectId, { status: 'completed' });
      return;
    }

    if (decision === 'new_session') {
      this.openCreateSessionFromProject({
        projectId,
        artistId: ev.artistId,
        clientId: ev.clientId
      });
    }
  }

  private toSeedFromEvent(ev: UiCalendarEvent): Partial<CreateDraft> {
    const start = new Date(ev.start);
    const end = new Date(ev.end);

    const durationMinutes = this.diffMinutes(ev.start, ev.end);
    const safeStart = this.toLocalDateTime(start);
    const safeEnd = this.toLocalDateTime(end);

    return {
      type: ev.type,
      artistId: ev.artistId,
      start: safeStart,
      end: safeEnd,
      durationMinutes,
      clientId: ev.clientId,
      projectId: ev.projectId,
      bookingId: (ev as any).bookingId,
      notes: ev.notes,
      status: (ev as any).status ?? undefined,
    } as any;
  }

  private rebuildBookingsLite(events: UiCalendarEvent[]): void {
    const list = (events ?? [])
      .filter(e => e?.type === 'booking')
      .map(e => ({
        id: e.id,
        title: (e as any).notes || (e as any).title || 'Booking',
        start: e.start,
        end: e.end,
        artistId: e.artistId,
        clientId: e.clientId,
        projectId: e.projectId
      } as BookingLite))
      .sort((a, b) => String(a.start ?? '').localeCompare(String(b.start ?? '')));

    this.bookingsLite = list;
  }

  private mapActionToStatus(action: AdminActionPayload['type'], eventType: UiCalendarEvent['type']): string | null {
    if (eventType === 'session') {
      if (action === 'complete') return 'completed';
      if (action === 'cancel') return 'cancelled';
      if (action === 'confirm' || action === 'start') return 'planned';
      return null;
    }

    // booking
    switch (action) {
      case 'confirm': return 'confirmed';
      case 'pay': return 'paid';
      case 'start': return 'in_progress';
      case 'complete': return 'completed';
      case 'cancel': return 'cancelled';
      default: return null;
    }
  }

  private async confirmCancel(ev: UiCalendarEvent): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Annullare appuntamento?',
        message: `Vuoi annullare questo evento${ev.title ? `: ${ev.title}` : ''}?`,
        confirmText: 'Annulla',
        cancelText: 'Torna indietro'
      }
    });
    return await firstValueFrom(ref.afterClosed());
  }

  private async confirmOpenProject(projectId: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Aprire progetto?',
        message: 'Vuoi aprire il progetto collegato a questa prenotazione?',
        confirmText: 'Apri progetto',
        cancelText: 'Resta qui'
      }
    });
    return await firstValueFrom(ref.afterClosed());
  }

  private async openCreateProjectDialog(data: {
    clientId: string;
    artistId: string;
    suggestedTitle?: string;
  }): Promise<CreateProjectDialogResult | null> {
    const ref = this.dialog.open<CreateProjectDialogComponent, any, CreateProjectDialogResult>(
      CreateProjectDialogComponent,
      {
        width: '520px',
        maxWidth: '92vw',
        data
      }
    );
    const res = await firstValueFrom(ref.afterClosed());
    return res ?? null;
  }

  async onCreateProjectRequested(payload: CreateProjectTriggerPayload) {
    if (!payload.clientId || !payload.artistId) {
      this.snackBar.open('Per creare un progetto servono cliente e artista.', 'OK', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });
      return;
    }

    const res = await this.openCreateProjectDialog({
      clientId: payload.clientId,
      artistId: payload.artistId,
      suggestedTitle: payload.titleHint
    });
    if (!res?.title) return;

    const projectId = await this.projectService.createProject({
      title: res.title,
      clientId: payload.clientId,
      artistId: payload.artistId,
      zone: res.zone ?? undefined,
      notes: res.notes ?? undefined,
      status: 'scheduled'
    } as any);

    const lite: ProjectLite = {
      id: projectId,
      title: res.title,
      clientId: payload.clientId,
      artistId: payload.artistId,
      sessionIds: []
    };

    this.projectsLite = [lite, ...(this.projectsLite ?? []).filter(p => p.id !== projectId)];
    this.createdProject = lite;

    if (this.drawerEditingEvent) {
      this.drawerEditingEvent = { ...this.drawerEditingEvent, projectId };
    }

    if (this.drawerSeed) {
      this.drawerSeed = { ...this.drawerSeed, projectId } as any;
    }
  }

  private async confirmProjectOverride(projectId: string, bookingId?: string): Promise<boolean> {
    try {
      const project = await this.projectService.getProjectById(projectId);
      const existing = project?.bookingId;
      if (existing && existing !== bookingId) {
        const ref = this.dialog.open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Progetto già associato',
            message: 'Questo progetto è già collegato a un’altra prenotazione. Vuoi riassegnarlo a questa?',
            confirmText: 'Riassegna',
            cancelText: 'Annulla'
          }
        });
        const ok = await firstValueFrom(ref.afterClosed());
        if (!ok) return false;

        if (bookingId) {
          await this.projectService.updateProject(projectId, { bookingId });
        }
      }
      return true;
    } catch (e) {
      this.snackBar.open('Impossibile verificare il progetto. Riprova.', 'OK', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });
      return false;
    }
  }

  private async createProjectAndAssign(ev: UiCalendarEvent, statusToSet?: string): Promise<boolean> {
    if (!ev.clientId || !ev.artistId) {
      this.snackBar.open('Per creare un progetto servono cliente e artista.', 'OK', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'bottom'
      });
      this.openEditEvent(ev);
      return false;
    }

    const res = await this.openCreateProjectDialog({
      clientId: ev.clientId,
      artistId: ev.artistId,
      suggestedTitle: ev.title || 'Progetto',
    });
    if (!res?.title) return false;

    const projectId = await this.projectService.createProject({
      title: res.title,
      clientId: ev.clientId,
      artistId: ev.artistId,
      zone: res.zone ?? undefined,
      notes: res.notes ?? undefined,
      status: 'scheduled'
    } as any);

    const patch: any = {
      projectId,
      ...(statusToSet ? { status: statusToSet } : {})
    };

    this.updateRequested.emit({
      id: ev.id,
      type: ev.type,
      patch
    });

    // Apri drawer con progetto già impostato
    this.openEditEvent({ ...ev, projectId });
    return true;
  }

  private diffMinutes(startISO: string, endISO: string): number {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  private toLocalDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}
