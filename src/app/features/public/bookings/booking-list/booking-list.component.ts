import { Component, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

import { CalendarComponentV2 } from '../../../../shared/components/calendar-v2/calendar/calendar.component';

import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaymentConfirmationDialogComponent } from '../../../../shared/components/dialogs/payment-confirmation-dialog/payment-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { SessionService } from '../../../../core/services/session/session.service';
import { CalendarEvent } from '../../../../shared/components/calendar-v2/models/calendar';
import { BookingDraftPayload } from '../../../../shared/components/calendar-v2/models/calendar';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, CalendarComponentV2],
  templateUrl: './booking-list.component.html',
  styleUrls: ['./booking-list.component.scss']
})
export class BookingListComponent implements OnInit {
  events: CalendarEvent[] = [];
  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};
  user: any;
  formGroup!: FormGroup;

  loading = true;

  constructor(
    private readonly bookingService: BookingService,
    private readonly staffService: StaffService,
    private readonly authService: AuthService,
    private readonly snackbar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly sessionService: SessionService,
  ) {
    // ✅ form allineato a Calendar v2 (artistId, date, time, ecc.)
      console.log('[BookingList] constructor, formGroup creato');

    this.formGroup = this.fb.group({
      type: ['booking', Validators.required],
      artistId: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      duration: [60, Validators.required],
      description: ['', Validators.required],
      idClient: [''],
      idProject: [''],
      price: [0],
      paidAmount: [0],
      metadata: [null],
    });
  }

  private userEffect = effect(() => {
    const user = this.authService.userSig();
    if (user) {
      this.user = user;
    }
  });

  ngOnInit(): void {
      console.log('[BookingList] ngOnInit, component inizializzato');

    this.loading = true;

    // Staff → mappe artista
    this.staffService.getAllStaff().subscribe(staff => {
      this.artistMap = staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.name }), {});
      this.artistPhotoMap = staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: (s.photoUrl || '') }), {});
    });

    // ⬇️ Unisci prenotazioni + sessioni in CalendarEvent (v2)
    combineLatest([
      this.bookingService.getAllBookings(),
      this.sessionService.getAll()
    ]).subscribe({
      next: ([bookings, sessions]) => {
        const bookingEvents: CalendarEvent[] = (bookings ?? []).map((b: any) => {
          const start = new Date(b.start);
          const duration = b.duration ?? 30;
          const end = new Date(start.getTime() + duration * 60000);
          const datePart = b.start.split('T')[0];

          const title =
            b.title ??
            `${this.artistMap[b.idArtist] ?? 'Tattoo'} - consulenza`;

          return {
            id: b.id ?? '',
            type: 'booking',
            title,
            date: datePart,
            start: b.start,
            end: end.toISOString(),
            artistId: b.idArtist ?? '',
            artistName: this.artistMap[b.idArtist] || '',
            metadata: {
              description: b.description ?? '',
              isMine: !!(b.idClient && this.user && b.idClient === this.user.uid),
              duration,
              slotCount: Math.ceil(duration / 30),
              count: 1
            }
          };
        });

        const sessionEvents: CalendarEvent[] = (sessions ?? []).map((s: any) => {
          const start = new Date(s.start);
          const end = new Date(s.end);
          const duration = Math.max(
            1,
            Math.round((+end - +start) / 60000)
          );
          const datePart = s.start.split('T')[0];

          return {
            id: s.id ?? '',
            type: 'session',
            title: s.title ?? 'Sessione',
            date: datePart,
            start: s.start,
            end: s.end,
            artistId: s.idArtist ?? '',
            artistName: this.artistMap[s.idArtist] || '',
            metadata: {
              description: 'Seduta',
              duration,
              slotCount: Math.ceil(duration / 30),
              count: 1
            }
          };
        });

        this.events = [...bookingEvents, ...sessionEvents]
          .sort((a, b) => +new Date(a.start) - +new Date(b.start));

        this.loading = false;
      },
      error: () => {
        this.snackbar.open('Errore nel caricamento degli eventi', 'Chiudi', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  // ✅ Handler compatibile con Calendar v2 (BookingDraftPayload)
  async onBookingSubmitted(draft: BookingDraftPayload) {
    try {
      if (!this.user?.uid) {
        this.snackbar.open('Utente non autenticato.', 'Chiudi', { duration: 2500 });
        return;
      }

      if (!draft?.artistId) {
        this.snackbar.open('Seleziona un artista.', 'Chiudi', { duration: 2500 });
        return;
      }

      // Costruisci start ISO da date + time
      const startLocal = new Date(`${draft.date}T${draft.time}`);
      const startISO = startLocal.toISOString();

      const duration = Number.isFinite(draft.duration as number)
        ? (draft.duration as number)
        : 30;

      const endISO = new Date(startLocal.getTime() + duration * 60000).toISOString();
      const datePart = draft.date;

      const toSave: Omit<Booking, 'id' | 'status'> = {
        start: startISO,
        end: endISO,
        idClient: this.user.uid || '',
        idArtist: draft.artistId,
        title: `${this.user.name ?? 'Cliente'} - Tattoo`,
        description: draft.description ?? '',
        eta: null as any,
        createAt: new Date().toISOString(),
        updateAt: new Date().toISOString(),
        price: Number.isFinite(draft.price as number) ? (draft.price as number) : 0,
        paidAmount: Number.isFinite(draft.paidAmount as number) ? (draft.paidAmount as number) : 0,
      };

      // Dialog di conferma riepilogo
      const confirmed = await this.dialog.open(PaymentConfirmationDialogComponent, {
        width: '420px',
        data: {
          date: startLocal.toLocaleDateString('it-IT'),
          time: draft.time,
          artist: this.artistMap[toSave.idArtist] ?? '',
          email: this.user.email
        }
      }).afterClosed().toPromise();

      if (confirmed !== 'confirmed') {
        this.snackbar.open('Prenotazione annullata.', 'Chiudi', { duration: 2000 });
        return;
      }

      // Salva sul DB
      const id = await this.bookingService.addDraft(toSave);

      // Aggiorna la vista del calendario
      const newEvent: CalendarEvent = {
        id,
        type: 'booking',
        title: toSave.title,
        date: datePart,
        start: startISO,
        end: endISO,
        artistId: toSave.idArtist,
        artistName: this.artistMap[toSave.idArtist] ?? '',
        metadata: {
          description: toSave.description,
          isMine: toSave.idClient === this.user.uid,
          duration,
          slotCount: Math.ceil(duration / 30),
          count: 1
        }
      };

      this.events = [...this.events, newEvent];

      this.snackbar.open('Prenotazione salvata con successo!', 'OK', { duration: 3000 });

      // Redirect alla prenotazione
      this.router.navigate(['/bookings', id]);
    } catch (err) {
      console.error('❌ Errore salvataggio:', err);
      this.snackbar.open('Errore durante il salvataggio della prenotazione.', 'Chiudi', { duration: 4000 });
    }
  }
}
