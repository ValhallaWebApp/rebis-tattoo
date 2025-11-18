import { Component, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { CalendarComponent } from '../../../calendar/calendar.component';
import { CalendarEvent, CalendarView } from '../../../calendar/calendar.service';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PaymentConfirmationDialogComponent } from '../../../../shared/components/dialogs/payment-confirmation-dialog/payment-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { combineLatest, firstValueFrom } from 'rxjs';
import { SessionService } from '../../../../core/services/session/session.service';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, CalendarComponent],
  templateUrl: './booking-list.component.html',
  styleUrls: ['./booking-list.component.scss']
})
export class BookingListComponent implements OnInit {
  events: CalendarEvent[] = [];
  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};
  user: any;
  formGroup!: FormGroup;

  view: CalendarView = 'week';
  title = '';
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
    // ✅ usa idArtist nel form
    this.formGroup = this.fb.group({
      type: ['booking', Validators.required],
      artist: ['', Validators.required],
      description: ['', Validators.required],
      start: [''],
      duration: [60],
      price: [0],
      paidAmount: [0],
        time: ['', Validators.required],   // 👈 aggiungi questo

      projectId: ['']
    });
  }
 private userEffect = effect(() => {
    const user = this.authService.userSig();
    console.log(user);
    if (user) {
       this.user = user
    }
  });
 ngOnInit(): void {
  this.loading = true;

  this.staffService.getAllStaff().subscribe(staff => {
    this.artistMap = staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.name }), {});
    this.artistPhotoMap = staff.reduce((acc: any, s: any) => ({ ...acc, [s.id]: (s.photoUrl || '') }), {});
  });

  // ⬇️ unisci prenotazioni + sessioni
  combineLatest([
    this.bookingService.getAllBookings(),
    this.sessionService.getAll()            // o getPublic() se ce l’hai
  ]).subscribe({
    next: ([bookings, sessions]) => {
      const bookingEvents: CalendarEvent[] = (bookings ?? []).map((b: any) => {
        const start = new Date(b.start);
        const duration = b.duration ?? 30;
        const end = new Date(start.getTime() + duration * 60000);
        return {
          id: b.id ?? '',
          date: b.start.split('T')[0],
          start: b.start,
          end: end.toISOString(),
          artistId: b.idArtist ?? '',
          artistName: this.artistMap[b.idArtist] || '',
          isMine: !!(b.idClient && this.user && b.idClient === this.user.uid),
          description: b.description ?? '',
          type: 'booking',
          duration,
          slotCount: Math.ceil(duration / 30),
          count: 1
        };
      });

      const sessionEvents: CalendarEvent[] = (sessions ?? []).map((s: any) => ({
        id: s.id ?? '',
        date: s.start.split('T')[0],
        start: s.start,
        end: s.end,
        artistId: s.idArtist ?? '',
        // puoi mascherare:
        artistName: this.artistMap[s.idArtist] || '',
        description: 'Seduta',
        type: 'session',
        duration: Math.max(1, Math.round((+new Date(s.end) - +new Date(s.start)) / 60000)),
        slotCount: Math.ceil(Math.max(1, Math.round((+new Date(s.end) - +new Date(s.start)) / 60000)) / 30),
        count: 1
      }));

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

  // ✅ forza idClient, calcola end e pulisce il payload
// async onBookingSubmitted(draft: Omit<Booking, 'id' | 'status'> & { duration?: number }) {
//   try {
//     if (!this.user?.uid) {
//       this.snackbar.open('Utente non autenticato.', 'Chiudi', { duration: 2500 });
//       return;
//     }
//     // if (!draft?.start) {
//     //   this.snackbar.open('Seleziona data/ora della prenotazione.', 'Chiudi', { duration: 2500 });
//     //   return;
//     // }
//     if (!draft?.idArtist) {
//       this.snackbar.open('Seleziona un artista.', 'Chiudi', { duration: 2500 });
//       return;
//     }

//     // Normalizza campi e imposta default
//     const startISO = new Date(draft.start).toISOString();
//     const duration = Number.isFinite(draft.duration as number) ? (draft.duration as number) : 30;
//     const endISO = new Date(new Date(startISO).getTime() + duration * 60000).toISOString();
//     const datePart = startISO.split('T')[0];

//     const toSave: Omit<Booking, 'id' | 'status'> = {
//       start: startISO,
//       end: endISO,
//       idClient: this.user.uid||'',                            // ✅ mai undefined
//       idArtist: draft.idArtist,                           // ✅ coerente con il modello
//       title: draft.title ?? `${this.user.name ?? 'Cliente'} - Tattoo`,
//       description: draft.description ?? '',
//       eta: draft.eta ?? null as any,                      // opzionale: mantieni null se non lo usi
//       createAt: draft.createAt ?? new Date().toISOString(),
//       updateAt: new Date().toISOString(),
//       price: Number.isFinite(draft.price as number) ? (draft.price as number) : 0,
//       paidAmount: Number.isFinite(draft.paidAmount as number) ? (draft.paidAmount as number) : 0,
//       // campi opzionali che non vuoi scrivere? lasciali fuori
//     };

//     // Conferma pagamento
//     const parsed = new Date(startISO);
//     const confirmed = await this.dialog.open(PaymentConfirmationDialogComponent, {
//       width: '420px',
//       data: {
//         date: parsed.toLocaleDateString('it-IT'),
//         time: parsed.toTimeString().slice(0, 5),
//         artist: this.artistMap[toSave.idArtist] ?? '',
//         email: this.user.email
//       }
//     }).afterClosed().toPromise();

//     if (confirmed !== 'confirmed') {
//       this.snackbar.open('Prenotazione annullata.', 'Chiudi', { duration: 2000 });
//       return;
//     }

//     // Salva sul DB (status sarà impostato dal service a 'draft')
//     const id = await this.bookingService.addDraft(toSave);

//     // Aggiorna la vista locale
//     this.events.push({
//       id,
//       date: datePart,
//       start: startISO,
//       end: endISO,
//       artistId: toSave.idArtist,
//       artistName: this.artistMap[toSave.idArtist] ?? '',
//       description: toSave.description,
//       isMine: toSave.idClient === this.user.uid,
//       type: 'booking',
//       duration,
//       slotCount: Math.ceil(duration / 30),
//       count: 1
//     });

//     this.snackbar.open('Prenotazione salvata con successo!', 'OK', { duration: 3000 });
//     this.router.navigateByUrl('/dashboard/booking-history');

//   } catch (err) {
//     console.error('❌ Errore salvataggio:', err);
//     this.snackbar.open('Errore durante il salvataggio della prenotazione.', 'Chiudi', { duration: 4000 });
//   }
// }

// ✅ forza idClient, calcola end e pulisce il payload
async onBookingSubmitted(draft: Omit<Booking, 'id' | 'status'> & { duration?: number }) {
  try {
    if (!this.user?.uid) {
      this.snackbar.open('Utente non autenticato.', 'Chiudi', { duration: 2500 });
      return;
    }

    if (!draft?.idArtist) {
      this.snackbar.open('Seleziona un artista.', 'Chiudi', { duration: 2500 });
      return;
    }

    // Normalizza campi e imposta default
    const startISO = new Date(draft.start).toISOString();
    const duration = Number.isFinite(draft.duration as number) ? (draft.duration as number) : 30;
    const endISO = new Date(new Date(startISO).getTime() + duration * 60000).toISOString();
    const datePart = startISO.split('T')[0];

    const toSave: Omit<Booking, 'id' | 'status'> = {
      start: startISO,
      end: endISO,
      idClient: this.user.uid || '',
      idArtist: draft.idArtist,
      title: draft.title ?? `${this.user.name ?? 'Cliente'} - Tattoo`,
      description: draft.description ?? '',
      eta: draft.eta ?? null as any,
      createAt: draft.createAt ?? new Date().toISOString(),
      updateAt: new Date().toISOString(),
      price: Number.isFinite(draft.price as number) ? (draft.price as number) : 0,
      paidAmount: Number.isFinite(draft.paidAmount as number) ? (draft.paidAmount as number) : 0
    };

    // Dialog di conferma riepilogo
    const parsed = new Date(startISO);
    const confirmed = await this.dialog.open(PaymentConfirmationDialogComponent, {
      width: '420px',
      data: {
        date: parsed.toLocaleDateString('it-IT'),
        time: parsed.toTimeString().slice(0, 5),
        artist: this.artistMap[toSave.idArtist] ?? '',
        email: this.user.email
      }
    }).afterClosed().toPromise();

    if (confirmed !== 'confirmed') {
      this.snackbar.open('Prenotazione annullata.', 'Chiudi', { duration: 2000 });
      return;
    }

    // Salva sul DB (status sarà impostato dal service, es. 'draft'/'pending-payment')
    const id = await this.bookingService.addDraft(toSave);

    // Aggiorna la vista locale (per il calendario)
    this.events.push({
      id,
      date: datePart,
      start: startISO,
      end: endISO,
      artistId: toSave.idArtist,
      artistName: this.artistMap[toSave.idArtist] ?? '',
      description: toSave.description,
      isMine: toSave.idClient === this.user.uid,
      type: 'booking',
      duration,
      slotCount: Math.ceil(duration / 30),
      count: 1
    });

    this.snackbar.open('Prenotazione salvata con successo!', 'OK', { duration: 3000 });

    // ⬇️ QUI LA VERA MODIFICA: vai al DETAIL invece che alla history
    this.router.navigate(['/bookings', id]);
    // oppure, se la tua route è diversa, qualcosa tipo:
    // this.router.navigate(['/public/bookings', id]);
  } catch (err) {
    console.error('❌ Errore salvataggio:', err);
    this.snackbar.open('Errore durante il salvataggio della prenotazione.', 'Chiudi', { duration: 4000 });
  }
}


}
