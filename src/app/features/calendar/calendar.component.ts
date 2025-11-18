import { StaffMember } from './../../core/services/staff/staff.service';
import {
  Component,
  ViewChild,
  OnInit,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatDrawer } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MaterialModule } from '../../core/modules/material.module';
import { DynamicField } from '../../shared/components/form/dynamic-form/dynamic-form.component';
import { DayViewComponent } from './views/day-view/day-view.component';
import { WeekViewComponent } from './views/week-view/week-view.component';
import { MonthViewComponent } from './views/month-view/month-view.component';

import { AppointmentDetailsDialogComponent } from '../../shared/components/dialogs/appointment-details-dialog/appointment-details-dialog.component';
import { CalendarEvent, CalendarService } from './calendar.service';
import { Booking } from '../../core/services/bookings/booking.service';
import { RouterLink } from '@angular/router';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule } from '@angular/material/datepicker';

@Component({
  selector: 'app-calendar',
  standalone: true,
  // Il componente è "standalone" e importa tutto ciò che usa nel template.
  imports: [
    CommonModule,
    MaterialModule,        // Material personalizzato del progetto
    MatMenuModule,         // Menù contestuali
    ReactiveFormsModule,   // Per [formGroup] e formControlName
    MatTooltipModule,      // Tooltip negli slot/eventi
    DayViewComponent,      // Vista Giorno
    WeekViewComponent,     // Vista Settimana
    MonthViewComponent,    // Vista Mese
    RouterLink,            // [routerLink] nel menù contestuale
    MatDatepickerModule    // Se usi il datepicker nel toolbar/drawer
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit, OnChanges {

  // =========================
  // ⏱  STATO DI ALTO LIVELLO
  // =========================

  title: any;                        // Titolo mostrato nella toolbar (deriva dal CalendarService)
  today = new Date();                // Data odierna (per "vai a oggi")
  selectedDate: Date = new Date();   // Data attualmente selezionata (ancora "Date", non ISO)
  view: 'day' | 'week' | 'month' = 'week'; // Vista attiva
  editMode = false;                  // true quando stai "modificando" un evento esistente (blocco toggle tipo)
  @Input() role: 'admin' | 'user' = 'user'; // Ruolo corrente (filtra le azioni del menù contestuale)

  // =====================================
  // 📋  SUPPORTO FORM / OPZIONI ORARIE UI
  // =====================================

  // Se in futuro vorrai usare DynamicFormComponent, puoi popolarlo;
  // al momento il template usa direttamente Material FormField.
  fields: DynamicField[] = [];

  // Opzioni per il select dell'orario (rigenerate ad ogni cambio artista/durata)
  // Struttura: { label: string, value: "HH:mm", disabled: boolean }
  timeOptions: Array<{ label: string; value: string; disabled: boolean }> = [];

  // Getter comodo per accedere al controllo "type" del form
  get typeControl(): FormControl {
    return this.bookingForm?.get('type') as FormControl;
  }

  // =========================
  // 📦  INPUT DAL CONTENITORE
  // =========================

  // Tipi consentiti nel toggle del drawer. Es.: ['session','booking']
  @Input() bookingTypes: any[] = ['booking'];

  // Il form viene creato dal contenitore (BookingList o CalendarAdmin) e passato qui
  // Deve contenere almeno: type, artist, description, date, time, duration, price, paidAmount, projectId
  @Input() bookingForm!: FormGroup;

  // Tutti gli eventi mostrati nel calendario (booking + session)
  // UI si aspetta artistId, start, end in ISO, type ('booking'|'session')
  @Input() events: CalendarEvent[] = [];

  // Mappe degli artisti (id -> nome/foto) per etichette/avatar
  @Input() artistMap: Record<string, string> = {};
  @Input() artistPhotoMap: Record<string, string> = {};

  // Utente corrente (serve per isMine, idClient, ecc.)
  @Input() user: any;

  // Tipo selezionato (toggle nel drawer)
  @Input() selectedType: string = 'booking';

  // ==========================
  // 📤  OUTPUT VERSO IL PADRE
  // ==========================

  // Quando il drawer viene salvato, emettiamo un "draft" normalizzato
  @Output() bookingSubmitted = new EventEmitter<Omit<Booking, 'id' | 'status'>>();

  // Sincronizza il tipo con il contenitore
  @Output() selectedTypeChange = new EventEmitter<string>();

  // Drag&Drop da Week/Day view → update verso il padre (che salva su DB)
  @Output() eventDropped = new EventEmitter<{
    event: CalendarEvent;
    newDate: string;
    newHour: string;
    newArtistId: string;
  }>();

  // ============================
  // 📌  DRAWER E MENÙ CONTESTUALE
  // ============================

  @ViewChild('drawer') drawer!: MatDrawer;                         // Drawer del form
  @ViewChild('eventContextMenu', { static: true }) contextMenu!: MatMenu; // Menù contestuale
  contextMenuData: CalendarEvent | null = null;                    // Evento corrente per il menù

  // ==================
  // 👥  LISTE ARTISTI
  // ==================

  // Lista completa per i filtri della vista (multi-selezione in Day/Week)
  filterArtists: { label: string; value: string }[] = [];

  // Artisti correntemente "selezionati" nella vista (colonne visualizzate)
  selectedArtists: { label: string; value: string }[] = [];

  // Lista per la <mat-select> nel drawer (viene filtrata per slot)
  filteredArtists: { label: string; value: string }[] = [];

  // Ricerca rapida degli artisti (toolbar)
  artistSearchControl = new FormControl('');

  // Id artisti visibili nella vista (comodo per passarlo alle subview)
  get selectedArtistIds(): string[] {
    return this.selectedArtists.map(a => a.value);
  }

  // ================================
  // 📅  DATI AUSILIARI PER DAY VIEW
  // ================================
  dayData: any;

  // Orari mostrati come righe (slot base di 60 min per la griglia giorno;
  // l'overlap/occupazione usa comunque start/end reali degli eventi)
  hours = Array.from({ length: 12 }, (_, i) => `${(9 + i).toString().padStart(2, '0')}:00`);

  // ===================
  // 🧪  STATO VALIDAZIONI
  // ===================

  // True se la durata selezionata NON entra a partire dall'orario scelto per l'artista
  durationConflict = false;

  constructor(
    private readonly dialog: MatDialog,
    private readonly snackbar: MatSnackBar,
    private readonly fb: FormBuilder,
    private calendarService: CalendarService
  ) {}

  // ======================================================
  // ♻️  REAZIONE AI CAMBI DI INPUT (artistMap / bookingTypes)
  // ======================================================
  ngOnChanges(changes: SimpleChanges): void {
    // Quando arriva/varia la mappa artisti, ricostruisci le liste per filtri e drawer
    if (changes['artistMap'] && this.artistMap) {
      this.rebuildArtists();
      this.updateArtistLists();
    }

    // Imposta default type se non presente nel form
    if (changes['bookingTypes']?.currentValue) {
      const defaultType = this.bookingTypes?.[0] ?? 'booking';
      const currentType = this.bookingForm?.get('type')?.value;
      if (!currentType) {
        this.bookingForm.get('type')?.setValue(defaultType);
      }
    }

    // (Sicurezza) Se il form cambia sotto, ricollega le subscriptions per rigenerare gli orari
    this.bookingForm.get('artist')?.valueChanges.subscribe(() => {
      if (this.selectedDate) this.generateTimeOptions(this.selectedDate);
      this.validateDurationFit(); // valida anche la continuità a partire dall'orario scelto
    });

    this.bookingForm.get('duration')?.valueChanges.subscribe(() => {
      if (this.selectedDate) this.generateTimeOptions(this.selectedDate);
      this.validateDurationFit();
    });

    this.bookingForm.get('time')?.valueChanges.subscribe(() => {
      this.validateDurationFit();
    });

    this.bookingForm.get('type')?.valueChanges.subscribe(() => {
      this.validateDurationFit();
    });
  }

  // =================
  // 🚀  INIZIALIZZAZIONE
  // =================
  ngOnInit(): void {
    // Imposta il tipo iniziale tra form e fallback
    const initialType = this.bookingForm.get('type')?.value ?? this.bookingTypes[0] ?? 'booking';
    this.selectedType = initialType;
    this.bookingForm.get('type')?.setValue(initialType);

    // Aggiorna il titolo (CalendarService calcola Day/Week/Month title)
    this.calendarService.title$.subscribe(title => (this.title = title));

    // Inizializza liste artisti
    this.updateArtistLists();

    // Se sei già in vista giorno, costruisci la griglia
    if (this.view === 'day') this.generateDayData(this.selectedDate);

    // Filtro veloce artisti (toolbar)
    this.artistSearchControl.valueChanges.subscribe(value => {
      const filter = (value || '').toLowerCase();
      this.filteredArtists = Object.entries(this.artistMap)
        .filter(([, name]) => name.toLowerCase().includes(filter))
        .map(([id, name]) => ({ label: name, value: id }));
    });

    // Subscriptions “di servizio” (se non già agganciate in ngOnChanges)
    this.bookingForm.get('artist')?.valueChanges.subscribe(() => {
      if (this.selectedDate) this.generateTimeOptions(this.selectedDate);
      this.validateDurationFit();
    });

    this.bookingForm.get('duration')?.valueChanges.subscribe(() => {
      if (this.selectedDate) this.generateTimeOptions(this.selectedDate);
      this.validateDurationFit();
    });

    this.bookingForm.get('time')?.valueChanges.subscribe(() => {
      this.validateDurationFit();
    });

    this.bookingForm.get('type')?.valueChanges.subscribe(() => {
      this.validateDurationFit();
    });
  }

  // =====================================
  // 🔄  CAMBIO TIPO BOOKING/SESSION (TOGGLE)
  // =====================================
  onTypeChanged(type: string): void {
    this.selectedType = type;
    this.selectedTypeChange.emit(type);
    this.bookingForm.get('type')?.setValue(type);
    // Quando cambi tipo, ricalcola gli orari (session usa durata variabile)
    if (this.selectedDate) this.generateTimeOptions(this.selectedDate);
    this.validateDurationFit();
  }

  // ==========================================
  // 📌  GESTIONE DROP (TRASCINAMENTO) DEGLI EVENTI
  // ==========================================
  onEventDropped({ event, newDate, newHour, newArtistId }: any) {
    // Calcola i nuovi start/end mantenendo la durata originale
    const newStart = `${newDate}T${newHour}`;
    const durationMinutes =
      (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000;
    const newEnd = new Date(new Date(newStart).getTime() + durationMinutes * 60000).toISOString();

    // Aggiorna l'evento in memoria (UI)
    event.start = newStart;
    event.end = newEnd;
    event.artistId = newArtistId;
    this.events = this.events.map(e => (e.id === event.id ? event : e));

    // Rigenera la vista giorno se necessario
    if (this.view === 'day') this.generateDayData(this.selectedDate);

    // Notifica il padre (CalendarAdmin) che salverà su DB con idArtist/new start/end
    this.eventDropped.emit({ event, newDate, newHour, newArtistId });
  }

  // ==========================================
  // 📌  MENÙ CONTESTUALE: AZIONI PER USER / ADMIN
  // ==========================================
  handleEventAction({ action, event }: { action: string; event: CalendarEvent }) {
    if (this.role === 'user') {
      switch (action) {
        case 'view':   this.openEventDetails(event); break;
        case 'cancel': this.cancelBookingAsUser(event); break;
      }
    }

    if (this.role === 'admin') {
      switch (action) {
        case 'view':     this.openEventDetails(event); break;
        case 'edit':     this.editExistingEvent(event); break;
        case 'complete': this.markEventComplete(event); break;
        case 'cancel':   this.cancelBookingAsAdmin(event); break;
      }
    }
  }

  private cancelBookingAsUser(event: CalendarEvent): void {
    // Qui potresti emettere un Output al BookingList per far partire un flow specifico
    this.snackbar.open('Richiesta annullamento inviata.', 'OK', { duration: 2500 });
  }

  private markEventComplete(event: CalendarEvent): void {
    // Solo Admin: emetti Output oppure chiama un service admin
    this.snackbar.open('Evento marcato come completato (admin).', 'OK', { duration: 2500 });
  }

  private cancelBookingAsAdmin(event: CalendarEvent): void {
    // Solo Admin: emetti Output oppure chiama un service admin
    this.snackbar.open('Prenotazione annullata (admin).', 'OK', { duration: 2500 });
  }

  // ====================================================
  // 🟢/🔴  COSTRUISCE LE OPZIONI ORARIE IN FUNZIONE DELLA DURATA
  // ====================================================
  generateTimeOptions(date: Date): void {
    const dateStr = date.toISOString().split('T')[0];
    const selectedArtist = this.bookingForm.get('artist')?.value || null;
    const duration = this.bookingForm.get('duration')?.value ?? 30; // Durata attuale nel form

    // Funzione che valuta se un orario è occupato in base all'overlap con QUALSIASI evento
    const isTaken = (time: string): boolean => {
      const slotStart = new Date(`${dateStr}T${time}`);
      const slotEnd   = new Date(slotStart.getTime() + duration * 60000);

      return this.events.some(e => {
        if (e.date !== dateStr) return false;
        if (selectedArtist && e.artistId !== selectedArtist) return false; // Se ho già scelto l'artista, filtro su quello
        const evStart = new Date(e.start);
        const evEnd   = new Date(e.end);
        // Overlap vero: [slotStart,slotEnd) ∩ [evStart,evEnd) ≠ ∅
        return slotStart < evEnd && slotEnd > evStart;
      });
    };

    // Costruzione lista orari ogni 30 minuti dalle 09:00 alle 19:30
    const options: Array<{ label: string; value: string; disabled: boolean }> = [];
    for (let h = 9; h <= 19; h++) {
      for (const m of [0, 30]) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const taken = isTaken(time);
        options.push({
          label: taken ? `🔴 ${time} (occupato)` : `🟢 ${time}`,
          value: time,
          disabled: taken
        });
      }
    }

    this.timeOptions = options;
  }

  // =========================================================
  // ✅  VALIDAZIONE: LA DURATA ENTRA DAVVERO DAL TIME SELEZIONATO
  // =========================================================
  private hasContinuousAvailability(dateStr: string, startTime: string, artistId: string, durationMin: number): boolean {
    // Verifica se, per quell'artista e a partire dall'orario scelto,
    // non esiste alcun evento che si sovrappone nei successivi "durationMin" minuti.
    const start = new Date(`${dateStr}T${startTime}`);
    const end   = new Date(start.getTime() + durationMin * 60000);

    return !this.events.some(e => {
      if (e.date !== dateStr) return false;
      if (artistId && e.artistId !== artistId) return false;
      const evStart = new Date(e.start);
      const evEnd   = new Date(e.end);
      return start < evEnd && end > evStart; // overlap → NON c’è disponibilità continua
    });
  }

  private validateDurationFit(): void {
    // Solo le "session" hanno durata variabile da convalidare
    const type = this.bookingForm.get('type')?.value;
    if (type !== 'session') {
      this.durationConflict = false;
      // Pulisci eventuali errori sul control "time"
      const timeCtrl = this.bookingForm.get('time');
      if (timeCtrl?.hasError('notFit')) timeCtrl.setErrors(null);
      return;
    }

    const artistId = this.bookingForm.get('artist')?.value;
    const time     = this.bookingForm.get('time')?.value;
    const duration = this.bookingForm.get('duration')?.value ?? 30;
    const dateStr  = this.selectedDate?.toISOString().split('T')[0];

    if (!artistId || !time || !dateStr) { this.durationConflict = false; return; }

    const ok = this.hasContinuousAvailability(dateStr, time, artistId, duration);
    this.durationConflict = !ok;

    // Marca il control "time" con un errore custom ("notFit") per mostrare <mat-error> e bloccare submit
    const timeCtrl = this.bookingForm.get('time');
    if (!ok) {
      timeCtrl?.setErrors({ ...(timeCtrl.errors || {}), notFit: true });
    } else if (timeCtrl?.errors) {
      const { notFit, ...rest } = timeCtrl.errors;
      timeCtrl.setErrors(Object.keys(rest).length ? rest : null);
    }
  }

  // ==========================================
  // 📄  SUBMIT: NORMALIZZA E INVIA AL CONTENITORE
  // ==========================================
  onSubmit(): any {
    // Guardie base: form valido, utente presente, data selezionata
    if (!this.bookingForm.valid || !this.user || !this.selectedDate) return;

    // Se c'è conflitto di durata (sessione non entra) blocca subito
    if (this.durationConflict) {
      this.snackbar.open('La durata selezionata non entra a partire dall’orario scelto.', 'OK', { duration: 2500 });
      return;
    }

    const formData = this.bookingForm.value;
    const isoDate  = this.selectedDate.toISOString().split('T')[0];

    // ATTENZIONE: l'HTML usa formControlName="time" → qui usiamo "time" per comporre lo start
    const start = `${isoDate}T${formData.time || '09:00'}`;
    const duration = formData.duration ?? 30;
    const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();

    // Per ulteriore sicurezza, verifica che l'opzione scelta non sia disabled
    const chosenOpt = this.timeOptions.find(o => o.value === formData.time);
    if (!chosenOpt || chosenOpt.disabled) {
      this.snackbar.open('Orario non valido o già occupato.', 'OK', { duration: 2500 });
      return;
    }

    const type = this.typeControl?.value ?? 'booking';

    // Bozza che verrà gestita dal genitore (BookingList o CalendarAdmin)
    const bookingDraft: any = {
      start,
      end,
      idClient: this.user.uid,
      idArtist: formData.artist,                 // Il DB/Service si aspetta "idArtist"
      title: `${this.user.name ?? 'Cliente'} - Tattoo`,
      description: formData.description,
      type,
      createAt: new Date().toISOString(),
      updateAt: new Date().toISOString(),
      price: 0,
      paidAmount: 0,
      date: isoDate
    };

    if (type === 'session') {
      // Sessione → durata e prezzi dal form
      bookingDraft.price      = formData.price ?? 0;
      bookingDraft.paidAmount = formData.paidAmount ?? 0;
      bookingDraft.idProject  = formData.projectId ?? null;
      bookingDraft.duration   = duration;
    } else {
      // Consulenza → default di progetto
      bookingDraft.price      = 50;
      bookingDraft.paidAmount = 0;
      bookingDraft.duration   = 60;
    }

    // Emetti verso il padre che si occuperà di salvataggio e refresh eventi
    this.bookingSubmitted.emit(bookingDraft);
    this.drawer.close();
  }

  // ======================
  // 🔍  DETTAGLI DI UN EVENTO
  // ======================
  openEventDetails(event: CalendarEvent): void {
    this.dialog.open(AppointmentDetailsDialogComponent, {
      width: '450px',
      data: event
    });
  }

  // =========================================
  // 👥  GESTIONE LISTE ARTISTI (FILTRI / DRAWER)
  // =========================================
  displayArtistName = (id: string): string => this.artistMap?.[id] ?? '';

  updateArtistLists(): void {
    // allArtists alimenta filteredArtists (drawer) e selectedArtists (colonne)
    const allArtists = Object.entries(this.artistMap).map(([id, name]) => ({ label: name, value: id }));
    this.filteredArtists = [...allArtists];   // per il <mat-select> nel drawer
    this.selectedArtists = [...allArtists];   // in vista, mostra tutte le colonne di default
  }

  rebuildArtists(): void {
    // Ricostruisce filterArtists (separata da filteredArtists)
    this.filterArtists = Object.entries(this.artistMap).map(([value, label]) => ({ label, value }));
    this.selectedArtists = [...this.filterArtists];
  }

  onArtistSelected(id: string): void {
    // Aggiunge una colonna artista alla vista giorno/settimana
    const artist = this.filterArtists.find(a => a.value === id);
    if (artist && !this.selectedArtists.find(a => a.value === artist.value)) {
      this.selectedArtists.push(artist);
      this.generateDayData(this.selectedDate);
    }
  }

  resetArtists(): void {
    // Ripristina tutte le colonne
    this.selectedArtists = [...this.filterArtists];
    this.generateDayData(this.selectedDate);
  }

  removeArtist(artist: { label: string; value: string }): void {
    // Rimuove una colonna artista dalla vista
    this.selectedArtists = this.selectedArtists.filter(a => a.value !== artist.value);
    this.generateDayData(this.selectedDate);
  }

  // ====================================
  // 🗓️  COSTRUZIONE DELLA GRIGLIA DAY VIEW
  // ====================================
  generateDayData(date: Date): void {
    const iso = date.toISOString().split('T')[0];
    const selectedIds = this.selectedArtists.map(a => a.value);

    const artists = Object.entries(this.artistMap)
      .filter(([id]) => selectedIds.includes(id))
      .map(([id, name]) => {
        const slots = this.hours.map(hour => {
          const slotTime = new Date(`${iso}T${hour}`);
          const event = this.events.find(e => {
            const start = new Date(e.start);
            const end   = new Date(e.end);
            return e.artistId === id && slotTime >= start && slotTime < end;
          });
          return { hour, event };
        });

        return {
          id,
          name,
          avatar: this.artistPhotoMap?.[id] || '/assets/avatar-default.png',
          slots
        };
      });

    this.dayData = { date, hours: this.hours, artists };
  }

  // =====================================
  // 🔭  CAMBIO VISTA E NAVIGAZIONE NEL TEMPO
  // =====================================
  setView(view: 'day' | 'week' | 'month'): void {
    this.view = view;
    this.calendarService.setView(view);              // Notifica il service (per il titolo)
    this.calendarService.setDate(this.selectedDate); // Aggiorna il titolo coerente con la data
    if (view === 'day') this.generateDayData(this.selectedDate);
  }

  next(): void {
    // Avanza di 1 giorno / 1 settimana / ~1 mese (30d)
    const days = this.view === 'month' ? 30 : this.view === 'week' ? 7 : 1;
    this.shiftDate(days);
  }

  prev(): void {
    // Torna indietro di 1 giorno / 1 settimana / ~1 mese (30d)
    const days = this.view === 'month' ? -30 : this.view === 'week' ? -7 : -1;
    this.shiftDate(days);
  }

  private shiftDate(days: number): void {
    // Sposta la data e aggiorna il titolo/DayData
    const newDate = new Date(this.selectedDate);
    newDate.setDate(newDate.getDate() + days);
    this.selectedDate = newDate;

    this.calendarService.setDate(newDate);
    if (this.view === 'day') this.generateDayData(this.selectedDate);
  }

  // ===========================================================
  // 👇  UTILITY: ARTISTI DISPONIBILI PER UNO SLOT (per <mat-select>)
  // ===========================================================
  getAvailableArtistsForSlot(date: string, time: string): { label: string; value: string }[] {
    // Considera un blocco base di 30' per "occupato libero"
    // (la generazione orari considera già la durata per disabilitare i time)
    const slotStart = new Date(`${date}T${time}`);
    const slotEnd   = new Date(slotStart.getTime() + 30 * 60000);

    // Artisti già occupati in quell'intervallo
    const bookedArtistIds = this.events
      .filter(e => {
        if (e.date !== date) return false;
        const evStart = new Date(e.start);
        const evEnd   = new Date(e.end);
        return slotStart < evEnd && slotEnd > evStart;
      })
      .map(e => e.artistId);

    // Ritorna solo gli artisti liberi
    return this.filterArtists.filter(a => !bookedArtistIds.includes(a.value));
  }

  // ===========================================================
  // ✏️  MODIFICA DI UN EVENTO ESISTENTE (apre drawer precompilato)
  // ===========================================================
  editExistingEvent(event: any): void {
    // Pulisci il form
    this.bookingForm.reset();

    // Imposta tipo (booking/session) → aggiorna toggle
    const type = event.type ?? 'booking';
    this.selectedType = type;
    this.onTypeChanged(type);

    // Filtra artisti per lo slot (date/time dell'evento)
    const options = this.getAvailableArtistsForSlot(event.date, event.time);
    this.filteredArtists = options;

    // Seleziona l'artista corrente (se presente)
    this.bookingForm.get('artist')?.setValue(event.artistId ?? null);

    // Patch finale (usa "artistId" per coerenza UI; il DB usa "idArtist")
    setTimeout(() => {
      this.bookingForm.patchValue({
        type,
        description: event.description ?? '',
        date: event.date ?? '',
        time: event.time ?? '',
        start: event.start ?? '',
        end: event.end ?? '',
        duration: event.duration ?? 30,
        price: event.price ?? 0,
        paidAmount: event.paidAmount ?? 0,
        projectId: event.projectId ?? ''
      });
      this.bookingForm.get('type')?.updateValueAndValidity();
      this.validateDurationFit();
    }, 0);

    this.editMode = true;
    this.drawer.open();
  }

  // ===========================================================
  // ➕  NUOVA PRENOTAZIONE DA UNO SLOT (apre drawer)
  // ===========================================================
  openDrawerWithDate(date: string, hour: string, artistId?: string): void {
    // Salva la data selezionata (Date)
    this.selectedDate = new Date(`${date}T${hour}:00`);

    // Rigenera orari tenendo conto della durata attuale e di un eventuale artista già scelto
    this.generateTimeOptions(this.selectedDate);

    // Filtra artisti realmente disponibili per quello slot
    const options = this.getAvailableArtistsForSlot(date, hour);
    this.filteredArtists = options;

    // Se lo slot è stato cliccato dentro una colonna artista, prova a preselezionarlo
    if (artistId) {
      const isAllowed = options.some(o => o.value === artistId);
      this.bookingForm.get('artist')?.setValue(isAllowed ? artistId : null);
    }

    // Patch base del form (date/time)
    this.bookingForm.patchValue({ date: this.selectedDate, time: hour });
    this.editMode = false;

    // Valida compatibilità durata/orario
    this.validateDurationFit();

    // Apri il drawer
    this.drawer.open();
  }
    getMonthDays(): { date: Date; events: CalendarEvent[] }[] {
    const start = new Date(this.selectedDate);
    start.setDate(1);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diff);

    const days: { date: Date; events: CalendarEvent[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const iso = day.toISOString().split('T')[0];
      const events = this.events.filter(e => e.start.startsWith(iso));
      days.push({ date: new Date(day), events });
    }

    return days;
  }

  goToDayView(date: Date): void {
    this.view = 'day';
    this.selectedDate = date;
    this.calendarService.setDate(date); // 🔥 aggiorna titolo
    this.calendarService.setView('day');
    this.generateDayData(date);
  }

}
