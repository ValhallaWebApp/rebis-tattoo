import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MatChipListboxChange } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

import { CalendarViewMode, CreateDraft, UiArtist, UiCalendarEvent, UpdatePatch } from '../models';
import { addDays } from '../utils';

import { DayViewComponent } from '../views/day-view/day-view.component';
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

import { EventDrawerComponent, EventDrawerResult } from '../drawer/event-drawer/event-drawer.component';
import { MaterialModule } from '../../../core/modules/material.module';

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
  ],
  templateUrl: './calendar-shell.component.html',
  styleUrls: ['./calendar-shell.component.scss'],
})
export class CalendarShellComponent {
  private readonly dialog = inject(MatDialog);
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

  // opzionale: per evitare doppi load
  private preloadDone = false;

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
    if (!sel.length) return this.artists.filter(a => a.isActive !== false);
    return this.artists.filter(a => sel.includes(a.id));
  });

  readonly eventsForSelectedArtists = computed(() => {
    const sel = new Set(this.selectedArtists().map(a => a.id));
    return this.events.filter(e => sel.has(e.artistId));
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
      const all = this.artists.filter(a => a.isActive !== false).map(a => a.id);
      this.selectedArtistIds.set(all);
    });
this.clientService.getClientsLiteOnce().subscribe(list => this.clientsLite = list ?? []);
this.projectService.getProjectsLiteOnce().subscribe(list => this.projectsLite = list ?? []);

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
  console.log('[CAL] openCreateFromDay', payload);
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
  console.log('[CAL] drawerOpen =>', this.drawerOpen);
}


  openEditEvent(ev: UiCalendarEvent) {
    this.drawerMode = 'edit';
    this.drawerEditingEvent = ev;
    this.drawerSeed = null;
    this.drawerOpen = true;
  }

  onDrawerClosed() {
    this.drawerOpen = false;
    this.drawerSeed = null;
    this.drawerEditingEvent = null;
  }

  // ---------------------------------------------
  // ✅ submit dal drawer (EventDrawerResult)
  // ---------------------------------------------
  onDrawerSubmit(result: EventDrawerResult) {
    if (result.mode === 'create') {
      this.createRequested.emit(result.draft);
      this.onDrawerClosed();
      return;
    }

    if (result.mode === 'edit') {
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
}
