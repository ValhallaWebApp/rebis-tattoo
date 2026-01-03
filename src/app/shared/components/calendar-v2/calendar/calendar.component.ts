import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { DayViewComponent } from './views/day-view/day-view.component';
import { WeekViewComponent } from './views/week-view/week-view.component';
import { MonthViewComponent } from './views/month-view/month-view.component';
import { BookingDraftPayload, CalendarDragUpdate, CalendarEvent, CalendarEventType, CalendarView } from '../models/calendar';
import { CalendarStateService } from '../state/calendar-state/calendar-state.service';


@Component({
  selector: 'app-calendar-v2',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    ReactiveFormsModule,
    DayViewComponent,
    WeekViewComponent,
    MonthViewComponent,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponentV2 implements OnInit, OnChanges {
  // ========= INPUT DAL CONTAINER (Admin / Client) =========

  /** Ruolo: decide cosa può fare (drag&drop, azioni, ecc.) */
  @Input() role: 'admin' | 'client' | 'staff' = 'client';

  /** Tipi di evento abilitati nel toggle (booking / session) */
  @Input() bookingTypes: CalendarEventType[] = ['booking'];

  /** Eventi normalizzati da visualizzare nel calendario */
  @Input() events: CalendarEvent[] = [];

  /** Mappe per nome / avatar artista (risorsa) */
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};

  /** Utente loggato (utile per precompilare idClient nel drawer) */
  @Input() user: { uid: string; role?: string } | null = null;

  /** Tipo selezionato nel toggle (two-way binding) */
  @Input() selectedType: CalendarEventType = 'booking';
  @Output() selectedTypeChange = new EventEmitter<CalendarEventType>();

  /** Form creato dal container e passato al drawer */
  @Input() bookingForm!: FormGroup;
/** Tema attuale del calendario (light / dark) */
@Input() initialTheme: 'light' | 'dark' = 'dark';
theme: 'light' | 'dark' = 'dark';

  // ========= OUTPUT VERSO IL CONTAINER =========

  /** Quando l'utente conferma il form nel drawer */
  @Output() bookingSubmitted = new EventEmitter<BookingDraftPayload>();

  /** Quando un evento viene spostato con drag&drop */
  @Output() eventDropped = new EventEmitter<CalendarDragUpdate>();

  // ========= STATO OSSERVABILE DALLO STATE SERVICE =========

view$!: Observable<CalendarView>;
date$!: Observable<Date>;
title$!: Observable<string>;
events$!: Observable<CalendarEvent[]>;

  /** Controlla apertura/chiusura del drawer */
  drawerOpen = false;

  constructor(private calendarState: CalendarStateService) {}

  // ---------------------------------------------------------
  //                   LIFECYCLE
  // ---------------------------------------------------------

  ngOnInit(): void {
  this.view$ = this.calendarState.view$;
  this.date$ = this.calendarState.date$;
  this.title$ = this.calendarState.title$;
  this.events$ = this.calendarState.events$;
this.theme = this.initialTheme;

  // Se il container ha già passato eventi, li imposto nello state
  if (this.events && this.events.length > 0) {
    this.calendarState.setEvents(this.events);
  }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Quando cambia la lista eventi dall'esterno, aggiorno lo stato
    if (changes['events'] && !changes['events'].firstChange) {
      this.calendarState.setEvents(this.events || []);
    }
  }

  // ---------------------------------------------------------
  //                   TOOLBAR ACTIONS
  // ---------------------------------------------------------

  setView(view: CalendarView): void {
    this.calendarState.setView(view);
  }

  prev(): void {
    this.calendarState.prev();
  }

  next(): void {
    this.calendarState.next();
  }

  today(): void {
    this.calendarState.setToday();
  }

  // ---------------------------------------------------------
  //                   DRAWER / FORM
  // ---------------------------------------------------------

  /**
   * Apertura drawer per nuova prenotazione/sessione.
   * Lo slot viene dalla view (day/week/month) con data/orario/artista.
   */
  openCreate(slot?: { date: string; time: string; artistId?: string }): void {
    if (!this.bookingForm) return;

    this.drawerOpen = true;

    this.bookingForm.reset({
      type: this.selectedType,
      artistId: slot?.artistId || '',
      date: slot?.date || '',
      time: slot?.time || '',
      duration: 60,
      description: '',
      idClient: this.user?.uid ?? '',
      idProject: '',
      price: 0,
      paidAmount: 0,
      metadata: null,
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  /**
   * Submit del form nel drawer: normalizza i dati e
   * manda un BookingDraftPayload al container.
   */
  onSubmitDrawer(): void {
    if (!this.bookingForm || this.bookingForm.invalid) return;

    const value = this.bookingForm.value;

    const payload: BookingDraftPayload = {
      type: (value.type as CalendarEventType) ?? this.selectedType,
      artistId: value.artistId ?? value.artist,
      date: value.date,
      time: value.time,
      duration: value.duration ?? 60,
      description: value.description ?? '',
      idClient: value.idClient,
      idProject: value.idProject,
      price: value.price,
      paidAmount: value.paidAmount,
      metadata: value.metadata,
    };

    this.bookingSubmitted.emit(payload);
    this.closeDrawer();
  }

  /**
   * Cambio tipo (booking / session) dal toggle.
   */
  onTypeChanged(type: CalendarEventType): void {
    this.selectedType = type;
    this.selectedTypeChange.emit(type);
  }
setTheme(theme: 'light' | 'dark'): void {
  this.theme = theme;
}

  // ---------------------------------------------------------
  //             DRAG & DROP / EVENTI DALLE VIEWS
  // ---------------------------------------------------------

  /**
   * Handler centrale per lo spostamento eventi.
   * Le view emettono CalendarDragUpdate, il container
   * farà l'update su DB.
   */
  handleEventDropped(update: CalendarDragUpdate): void {
    this.eventDropped.emit(update);
  }
}
