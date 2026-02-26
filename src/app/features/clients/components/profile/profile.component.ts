import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, effect, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AppUser, AuthService } from '../../../../core/services/auth/auth.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { ProjectStatus, ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { StatusHelperService } from '../../../../core/services/helpers/status-helper.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

type DashboardLink = {
  icon: string;
  title: string;
  description: string;
  route: string;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  user: AppUser | null = null;
  profileForm!: FormGroup;
  isEditing = false;
  unreadMessagesCount = 0;

  nextBooking: any = null;
  lastBooking: any = null;
  isUpcomingSoon = false;
  notifications: any[] = [];
  checklist: Array<{ text: string }> = [];

  projects: TattooProject[] = [];

  sections: DashboardLink[] = [
    {
      icon: 'event',
      title: 'Le tue prenotazioni',
      description: 'Controlla prossime sedute, storico e modifiche.',
      route: 'booking-history'
    },
    {
      icon: 'confirmation_number',
      title: 'Assistenza',
      description: 'Apri ticket o chat con lo studio.',
      route: 'ticket'
    },
    {
      icon: 'redeem',
      title: 'Codici promo e buoni',
      description: 'Gestisci wallet, sconti e codici regalo.',
      route: 'buoni'
    },
    {
      icon: 'reviews',
      title: 'Recensioni',
      description: 'Visualizza e aggiorna le tue recensioni.',
      route: 'reviews'
    }
  ];

  private readonly fb = inject(FormBuilder);
  private readonly bookingService = inject(BookingService);
  private readonly authService = inject(AuthService);
  private readonly projectsService = inject(ProjectsService);
  private readonly status = inject(StatusHelperService);
  private readonly injector = inject(Injector);

  get profileFields(): DynamicField[] {
    return [
      { type: 'text', name: 'name', label: 'Nome', readonly: !this.isEditing, required: true },
      { type: 'text', name: 'phone', label: 'Telefono', readonly: !this.isEditing },
      { type: 'date', name: 'dateOfBirth', label: 'Data di nascita', readonly: !this.isEditing }
    ];
  }

  ngOnInit(): void {
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

    runInInjectionContext(this.injector, () => {
      effect(() => {
        const user = this.authService.userSig();
        if (!user) return;

        this.user = user;
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

        this.loadBookings(user.uid);
        this.loadProjects(user.uid);
        this.loadNotifications();
      });
    });
  }

  get visibleProjects(): TattooProject[] {
    return this.projects.slice(0, 3);
  }

  get activeProjectsCount(): number {
    return this.projects.filter(p => this.status.projectStatusKey(p.status) === 'active').length;
  }

  get healingProjectsCount(): number {
    return this.projects.filter(p => this.status.projectStatusKey(p.status) === 'healing').length;
  }

  get completedProjectsCount(): number {
    return this.projects.filter(p => this.status.projectStatusKey(p.status) === 'completed').length;
  }

  private loadNotifications(): void {
    this.notifications = [
      { icon: 'event_available', message: 'Hai una seduta prevista per il 10 luglio alle 15:00.', date: '2025-07-08T10:00:00', type: 'appointment' },
      { icon: 'star_rate', message: 'La tua ultima recensione e stata approvata.', date: '2025-07-07T09:00:00', type: 'review' },
      { icon: 'chat', message: 'Hai ricevuto una risposta nel messaggio con lo studio.', date: '2025-07-06T17:30:00', type: 'message' }
    ];
  }

  private loadProjects(clientId: string): void {
    this.projectsService.getProjectsByClient(clientId).subscribe(projects => {
      this.projects = (projects ?? [])
        .slice()
        .sort((a, b) => this.toTimestamp(b?.updatedAt) - this.toTimestamp(a?.updatedAt));
      this.rebuildChecklist();
    });
  }

  loadBookings(clientId: string): void {
    this.bookingService.getBookingsByClient(clientId).subscribe(bookings => {
      const list = (bookings ?? []).slice();
      if (!list.length) {
        this.lastBooking = null;
        this.nextBooking = null;
        this.isUpcomingSoon = false;
        this.unreadMessagesCount = 0;
        this.rebuildChecklist();
        return;
      }

      const sorted = list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      this.lastBooking = sorted[sorted.length - 1];
      this.nextBooking = sorted.find(b => new Date(b.start).getTime() > Date.now()) ?? null;
      this.checkIfBookingIsSoon();
      this.unreadMessagesCount = 3;
      this.rebuildChecklist();
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
    if (!this.nextBooking?.start) {
      this.isUpcomingSoon = false;
      return;
    }
    const today = new Date();
    const bookingDate = new Date(this.nextBooking.start);
    const diff = (bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    this.isUpcomingSoon = diff >= 0 && diff <= 3;
  }

  projectStatusLabel(status: ProjectStatus | string | undefined): string {
    return this.status.projectLabel(status, 'client');
  }

  projectStatusClass(status: ProjectStatus | string | undefined): string {
    return this.status.projectStatusKey(status);
  }

  private rebuildChecklist(): void {
    const items: Array<{ text: string }> = [];

    if (!this.nextBooking) {
      items.push({ text: 'Prenota la prossima seduta dal calendario o dalla chat.' });
    } else {
      items.push({ text: 'Controlla data e ora della prossima seduta.' });
      items.push({ text: 'Apri ticket se devi spostare o annullare l appuntamento.' });
      if (this.isUpcomingSoon) {
        items.push({ text: 'Seduta vicina: prepara riferimenti e aftercare richiesto.' });
      }
    }

    if (this.projects.some(p => ['active', 'healing', 'scheduled'].includes(this.status.projectStatusKey(p.status)))) {
      items.push({ text: 'Monitora lo stato progetto e i prossimi step con lo studio.' });
    }

    this.checklist = items;
  }

  private toTimestamp(value: unknown): number {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
