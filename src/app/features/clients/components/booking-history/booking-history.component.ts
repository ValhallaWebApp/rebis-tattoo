import { Component, OnInit, inject, effect, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trigger, transition, style, animate } from '@angular/animations';
import { ReviewCreateDialogComponent } from '../../../../shared/components/dialogs/review-create-dialog/review-create-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';

@Component({
  selector: 'app-booking-history',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  styleUrls: ['./booking-history.component.scss'],
  templateUrl: './booking-history.component.html',
  animations: [
    trigger('slideFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(8px)' }))
      ])
    ])
  ]
})
export class BookingHistoryComponent implements OnInit {
  // services
  private readonly auth = inject(AuthService);
  private readonly bookingService = inject(BookingService);
  private readonly staffService = inject(StaffService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly reviewsService = inject(ReviewsService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector); // ✅ injection context per effect()

  // view switcher
  selectedView: 'active' | 'late' | 'completed' | 'cancelled' = 'completed';
  readonly WHATSAPP_NUMBER = '393333333333';

  // state
  user: any;
  reviewMap: { [bookingId: string]: any } = {};

  bookings: Booking[] = [];
  nextBooking: Booking | null = null;
  pastUncompleted: Booking[] = [];
  completedBookings: Booking[] = [];
  cancelledBookings: Booking[] = [];
  otherUpcomingBookings: Booking[] = [];

  artistMap: Record<string, string> = {};
  artistPhotoMap: Record<string, string> = {};

  // ✅ effect in field initializer (niente NG0203) + cleanup delle subscribe
  private readonly loadEffect = effect((onCleanup) => {
    const currentUser = this.auth.userSig(); // signal → trigger dell’effetto
    if (!currentUser?.uid) return;

    this.user = currentUser;
    const nowISO = new Date().toISOString();

    const sub = combineLatest([
      this.reviewsService.getReviewsByUser(currentUser.uid),
      this.staffService.getAllStaff(),
      this.bookingService.getBookingsByClient(currentUser.uid)
    ]).subscribe(([reviews, staff, bookings]) => {
      // reviews → mappa by bookingId
      const map: { [id: string]: any } = {};
      for (const r of reviews ?? []) if (r.bookingId) map[r.bookingId] = r;
      this.reviewMap = map;

      // staff → mappe utili
      this.artistMap = (staff ?? []).reduce((acc: any, a: any) => ({ ...acc, [a.id!]: a.name }), {});
      this.artistPhotoMap = (staff ?? []).reduce((acc: any, a: any) => ({ ...acc, [a.id!]: a.photoUrl || '' }), {});

      // bookings ordinati
      const all = (bookings ?? []).slice().sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
      this.bookings = all;

      // categorie
      this.pastUncompleted = all.filter(b =>
        ['draft', 'paid', 'on-going'].includes(b.status) && b.start < nowISO
      );

      this.completedBookings = all.filter(b => b.status === 'completed');
      this.cancelledBookings = all.filter(b => b.status === 'cancelled');

      const futureActive = all
        .filter(b => ['draft', 'paid', 'on-going'].includes(b.status) && b.start >= nowISO)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      this.nextBooking = futureActive[0] ?? null;
      this.otherUpcomingBookings = futureActive.slice(1);
    });

    // ✅ cleanup quando l’effetto si ri-esegue o quando il componente viene distrutto
    onCleanup(() => sub.unsubscribe());
  }, { injector: this.injector });

  ngOnInit(): void {
    // niente effect() qui → evita NG0203
  }

  downloadInvoice(booking: Booking): void {
    this.snackbar.open(`Fattura per "${booking.title}" scaricata. (Simulazione)`, 'Chiudi', { duration: 3000 });
  }

  openWhatsApp(booking: Booking): void {
    const msg = encodeURIComponent(
      `Ciao! Ti scrivo per la prenotazione "${booking.title}" prevista per il ${new Date(booking.start).toLocaleDateString()} alle ${new Date(booking.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    );
    window.open(`https://wa.me/${this.WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  }

  openReviewDialog(b: Booking) {
    const uid = this.user?.uid || this.user?.user?.uid || null;
    if (!uid) {
      this.snackbar.open('Errore: utente non autenticato.', 'Chiudi', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ReviewCreateDialogComponent, {
      data: { bookingId: b.id, tattooTitle: b.title, artistId: b.idArtist, userId: uid }
    });

    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this.snackbar.open('Grazie per la tua recensione!', 'Chiudi', { duration: 3000 });
        // aggiornamento ottimistico
        this.reviewMap[b.id] = { id: 'temp', comment: 'placeholder', rating: 5, bookingId: b.id };
      }
    });
  }

  viewReview(_: any) {
    this.router.navigateByUrl('/dashboard/reviews');
  }
}
