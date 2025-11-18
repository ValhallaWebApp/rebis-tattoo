// profile.component.ts
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, effect, Injector, runInInjectionContext } from '@angular/core'; // ⬅️ aggiunti inject, Injector, runInInjectionContext
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AppUser, AuthService } from '../../../../core/services/auth/authservice';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  // stato
  user: AppUser | null = null;
  profileForm!: FormGroup;
  isEditing = false;
  unreadMessagesCount = 0;

  nextBooking: any = null;
  lastBooking: any = null;
  isUpcomingSoon = false;
  notifications: any[] = [];
  checklist: any[] = [];

  sections = [
    { icon: 'event', title: 'Storico Prenotazioni', description: 'Controlla tutte le tue sedute passate e future.', route: 'booking-history' },
    { icon: 'chat', title: 'Codici Promo & Buoni', description: 'Comunica con il team e ricevi assistenza diretta.', route: 'buoni' },
    { icon: 'reviews', title: 'Le Tue Recensioni', description: 'Gestisci le recensioni lasciate agli artisti.', route: 'reviews' },
    { icon: 'settings', title: 'Impostazioni', description: 'Personalizza le preferenze del tuo account.', route: 'settings' }
  ];

  // servizi
  private fb = inject(FormBuilder);
  private bookingService = inject(BookingService);
  private authService = inject(AuthService);
  private staffService = inject(StaffService);
  private injector = inject(Injector); // ⬅️ per fornire l’injection context all’effetto

  ngOnInit(): void {
    // 1) crea il form PRIMA dell’effetto
    this.profileForm = this.fb.group({
      name: [''],
      email: [''],
      phone: [''],
      avatar: [''],
      dateOfBirth: [null],
      address: [''],
      city: [''],
      postalCode: [''],
      country: ['']
    });

    // 2) esegui l’effetto DENTRO un injection context
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const user = this.authService.userSig(); // signal
        if (!user) return;

        this.user = user;

        // patch del form con i dati utente
        this.profileForm.patchValue({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          avatar: user.avatar || 'https://i.pravatar.cc/150?img=3',
          dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : null,
          address: user.address || '',
          city: user.city || '',
          postalCode: user.postalCode || '',
          country: user.country || ''
        });

        // carica dati aggiuntivi
        this.loadBookings(user.name);   // (lasciato come nel tuo codice)
        this.loadNotifications();
      });
    });
  }

  // --- resto del codice invariato ---
  private loadNotifications(): void {
    this.notifications = [
      { icon: 'event_available', message: 'Hai una seduta prevista per il 10 luglio alle 15:00.', date: '2025-07-08T10:00:00', type: 'appointment' },
      { icon: 'star_rate', message: 'La tua ultima recensione è stata approvata!', date: '2025-07-07T09:00:00', type: 'review' },
      { icon: 'chat', message: 'Hai ricevuto una risposta nel messaggio con lo studio.', date: '2025-07-06T17:30:00', type: 'message' }
    ];
  }

  loadBookings(clientName: string): void {
    this.bookingService.getBookingsByClient(clientName).subscribe(bookings => {
      if (!bookings?.length) return;

      const sorted = bookings.sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      this.lastBooking = sorted[sorted.length - 1];
      this.nextBooking = sorted.find(b => new Date(b.start).getTime() > Date.now());
      this.checkIfBookingIsSoon();
      this.unreadMessagesCount = 3;
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.user) {
      this.profileForm.patchValue({
        ...this.user,
        dateOfBirth: this.user.dateOfBirth ? new Date(this.user.dateOfBirth) : null
      });
    }
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || !this.user) return;
    const updated = this.profileForm.getRawValue();
    this.user = { ...this.user, ...updated };

    this.authService.updateCurrentUserProfile({
      name: updated.name,
      avatar: updated.avatar,
      phone: updated.phone,
      dateOfBirth: updated.dateOfBirth,
      address: updated.address,
      city: updated.city,
      postalCode: updated.postalCode,
      country: updated.country
    }).then(() => {
      console.log('Profilo aggiornato');
      this.toggleEdit();
    }).catch(err => {
      console.error('Errore aggiornamento profilo:', err);
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.profileForm.patchValue({ avatar: base64 });
    };
    reader.readAsDataURL(file);
  }

  checkIfBookingIsSoon(): void {
    if (!this.nextBooking?.start) return;
    const today = new Date();
    const bookingDate = new Date(this.nextBooking.start);
    const diff = (bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    this.isUpcomingSoon = diff >= 0 && diff <= 3;
  }
}
