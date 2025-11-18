// calendar-admin.component.ts (estratto rilevante)
import { Component, OnInit, inject, effect, DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { CalendarComponent } from '../../../calendar/calendar.component';
import { CalendarEvent } from '../../../calendar/calendar.service';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { Session, SessionService } from '../../../../core/services/session/session.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { combineLatest, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-calendar-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, CalendarComponent],
  templateUrl: './calendar-admin.component.html',
  styleUrls: ['./calendar-admin.component.scss'],
  animations: [
    trigger('slideFade', [
      transition(':enter', [ style({ opacity: 0, transform: 'translateY(12px)' }), animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })) ]),
      transition(':leave', [ animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(8px)' })) ])
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
  private readonly injector = inject(Injector); // ⬅️ per l’injection context dell’effetto

  // state
  events: CalendarEvent[] = [];
  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};
  user: { uid: string; role?: string } | null = null;

  selectedType: any = 'booking';
  bookingTypes: any[] = [ 'booking'];
  formGroup!: FormGroup;

  // ✅ EFFECT con injection context, ispirato a BookingHistory
  private loadDataEffect = effect(() => {
    const u = this.auth.userSig();
    if (!u?.uid) return;      // nessun utente → non fare nulla

    this.user = { uid: u.uid, role: u.role };

    // carica staff + prenotazioni + sessioni
    combineLatest([
      this.staffService.getAllStaff(),
      this.bookingService.getAllBookings(),
      this.sessionService.getAll()
    ])
    .pipe(
      map(([staff, bookings, sessions]) => {
        // mappe staff
        this.artistMap = staff.reduce((acc, s) => {
          if (s.id) acc[s.id] = s.name;
          return acc;
        }, {} as Record<string, string>);

        this.artistPhotoMap = staff.reduce((acc, s) => {
          if (s.id) acc[s.id] = s.photoUrl || '';
          return acc;
        }, {} as Record<string, string>);

        // mapping eventi
        const bookingEvents = bookings.map(b => this.mapBookingToEvent(b));
        const sessionEvents = sessions.flatMap(s => this.mapSessionToEvent(s));

        // ordina per start
        return [...bookingEvents, ...sessionEvents]
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      }),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe(all => (this.events = all));
  }, { injector: this.injector }); // ⬅️ fondamentale per evitare NG0203

  ngOnInit(): void {
    // form coerente con il CalendarComponent (control = "artist")
    this.formGroup = this.buildFormForType(this.selectedType);
  }

  // form factory: usa "artist" (UI) e mapperai verso idArtist al salvataggio
  private buildFormForType(type: any): FormGroup {
    return this.fb.group({
      type: new FormControl<any>(type, { nonNullable: true, validators: [Validators.required] }),
      artist: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      start: new FormControl<string>('', { nonNullable: true }),
      end: new FormControl<string>(''),
      duration: new FormControl<number>(type === 'session' ? 60 : 30),
      sessionNumber: new FormControl<number>(1),
      price: new FormControl<number>(0),
      paidAmount: new FormControl<number>(0),
      idClient: new FormControl<string>(''),
      idProject: new FormControl<string>(''),
      title: new FormControl<string>(''), // utile per booking
        time: ['', Validators.required],   // 👈 aggiungi questo

    });
  }

  onSelectedTypeChanged(newType: any): void {
    this.selectedType = newType;
    this.formGroup = this.buildFormForType(newType);
  }

  // mapping utilities (UI usa artistId; DB usa idArtist)
  private mapBookingToEvent(booking: Booking): CalendarEvent {
    const start = new Date(booking.start);
    const end = booking.end ? new Date(booking.end) : new Date(start.getTime() + 30 * 60000);
    const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    const date = booking.start.split('T')[0];

    return {
      id: booking.id,
      date,
      start: booking.start,
      end: end.toISOString(),
      artistId: booking.idArtist, // ⬅️ UI
      artistName: this.artistMap[booking.idArtist] || '',
      description: booking.description || booking.title || 'Prenotazione',
      isMine: false,
      count: 1,
      type: 'booking',
      duration,
      slotCount: Math.ceil(duration / 30)
    };
  }

  private mapSessionToEvent(session: Session): CalendarEvent[] {
    const start = new Date(session.start);
    const end = new Date(session.end);
    const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    const date = session.start.split('T')[0];

    return [{
      id: session.id!,
      date,
      start: session.start,
      end: session.end,
      artistId: session.idArtist, // ⬅️ UI
      artistName: this.artistMap[session.idArtist] || '',
      description: session.notesByAdmin || 'Seduta',
      isMine: false,
      count: 1,
      type: 'session',
      duration,
      slotCount: Math.ceil(duration / 30)
    }];
  }

  // crea bozza booking o sessione
  handleBooking(draft: any): void {
    const isSession = draft.type === 'session';
    const idArtist = draft.idArtist ?? draft.artist;   // normalizza (form "artist" → DB "idArtist")

    if (isSession) {
      const session: Session = {
        idArtist,
        idClient: draft.idClient,
        start: draft.start,
        end: draft.end ?? this.addMinutesISO(draft.start, draft.duration ?? 60),
        projectId: draft.idProject,
        price: draft.price ?? 0,
        paidAmount: draft.paidAmount ?? 0,
        sessionNumber: draft.sessionNumber || 1,
        notesByAdmin: draft.description ?? '',
        painLevel: 1,
        healingNotes: '',
        photoUrlList: [],
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.sessionService.create(session)
        .then(() => {
          const generated = this.mapSessionToEvent(session);
          this.events = [...this.events, ...generated]
            .sort((a, b) => +new Date(a.start) - +new Date(b.start));
        })
        .catch(err => console.error('❌ Errore creazione sessione:', err));
    } else {
      const startISO = draft.start;
      const endISO = draft.end ?? this.addMinutesISO(draft.start, draft.duration ?? 30);
      const duration = Math.max(1, Math.round((+new Date(endISO) - +new Date(startISO)) / 60000));
      const date = startISO.split('T')[0];

      this.bookingService.addDraft({ ...draft, idArtist }) // DB vuole idArtist
        .then((id: string) => {
          const newEvent: CalendarEvent = {
            id,
            date,
            start: startISO,
            end: endISO,
            artistId: idArtist, // UI vuole artistId
            artistName: this.artistMap[idArtist] || '',
            description: draft.description || draft.title || 'Prenotazione',
            isMine: false,
            count: 1,
            type: 'booking',
            duration,
            slotCount: Math.ceil(duration / 30)
          };
          this.events = [...this.events, newEvent]
            .sort((a, b) => +new Date(a.start) - +new Date(b.start));
        })
        .catch(err => console.error('❌ Errore salvataggio prenotazione:', err));
    }
  }

  // update event da drag/drop o form
  handleUpdateEvent({ event, newDate, newHour, newArtistId }: any): void {
    const newStart = `${newDate}T${newHour}`;
    const durationMin = Math.max(1, Math.round((+new Date(event.end) - +new Date(event.start)) / 60000));
    const newEnd = this.addMinutesISO(newStart, durationMin);

    const updatedDataDB = { start: newStart, end: newEnd, idArtist: newArtistId }; // DB
    const updatedEventUI: CalendarEvent = { ...event, start: newStart, end: newEnd, artistId: newArtistId }; // UI

    const isSession = event.type === 'session';
    if (isSession) {
      this.sessionService.update(event.id!, { ...updatedDataDB, updatedAt: new Date().toISOString() })
        .then(() => this.updateEventInList(updatedEventUI))
        .catch(err => console.error('❌ Errore aggiornamento sessione:', err));
    } else {
      this.bookingService.updateBooking(event.id!, { ...updatedDataDB })
        .then(() => this.updateEventInList(updatedEventUI))
        .catch(err => console.error('❌ Errore aggiornamento prenotazione:', err));
    }
  }

  private updateEventInList(updated: CalendarEvent): void {
    this.events = this.events.map(e => e.id === updated.id ? updated : e);
  }

  private addMinutesISO(startISO: string, minutes: number): string {
    const d = new Date(startISO);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }
}
