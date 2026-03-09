import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, effect, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AppUser, AuthService } from '../../../../core/services/auth/auth.service';
import { BookingService } from '../../../../core/services/bookings/booking.service';
import { ProjectStatus, ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { StatusHelperService } from '../../../../core/services/helpers/status-helper.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { LanguageService } from '../../../../core/services/language/language.service';

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
export class ProfileComponent implements OnInit, OnDestroy {
  readonly defaultAvatar = '/personale/avatar_01.jpg';
  readonly avatar404Placeholder = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#111"/>
      <circle cx="120" cy="92" r="40" fill="#2b2b2b"/>
      <path d="M48 206c12-34 36-54 72-54s60 20 72 54" fill="#2b2b2b"/>
      <text x="120" y="226" text-anchor="middle" fill="#f1f1f1" font-size="18" font-family="Arial, sans-serif">404</text>
    </svg>`
  )}`;
  readonly presetAvatars: string[] = Array.from({ length: 20 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return `/personale/avatar_${n}.jpg`;
  });

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
      icon: 'auto_awesome_motion',
      title: '',
      description: '',
      route: 'tatuaggi'
    },
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
  private readonly ui = inject(UiFeedbackService);
  private readonly injector = inject(Injector);
  readonly lang = inject(LanguageService);
  private bookingsSub?: Subscription;
  private projectsSub?: Subscription;

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
        if (!user) {
          this.releaseSubscriptions();
          this.user = null;
          this.projects = [];
          this.nextBooking = null;
          this.lastBooking = null;
          this.isUpcomingSoon = false;
          this.unreadMessagesCount = 0;
          return;
        }

        this.user = user;
        this.profileForm.patchValue({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          avatar: this.resolveUserAvatar(user),
          dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth) : null,
          address: user.address || '',
          city: user.city || '',
          postalCode: user.postalCode || '',
          country: user.country || ''
        });

        this.loadBookings(user.uid);
        this.loadProjects(user.uid);
        this.loadNotifications();
        this.hydrateSectionsLabels();
      });
    });
  }

  ngOnDestroy(): void {
    this.releaseSubscriptions();
  }

  private hydrateSectionsLabels(): void {
    this.sections = this.sections.map((section) => {
      if (section.route !== 'tatuaggi') return section;
      return {
        ...section,
        title: this.lang.t('clientDashboard.sections.tattoos.title'),
        description: this.lang.t('clientDashboard.sections.tattoos.description')
      };
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
    this.projectsSub?.unsubscribe();
    this.projectsSub = this.projectsService.getProjectsByClient(clientId).pipe(
      catchError((err) => {
        console.warn('[ProfileComponent] loadProjects permission/fetch error', err);
        return of([] as TattooProject[]);
      })
    ).subscribe(projects => {
      this.projects = (projects ?? [])
        .slice()
        .sort((a, b) => this.toTimestamp(b?.updatedAt) - this.toTimestamp(a?.updatedAt));
      this.rebuildChecklist();
    });
  }

  loadBookings(clientId: string): void {
    this.bookingsSub?.unsubscribe();
    this.bookingsSub = this.bookingService.getBookingsByClient(clientId).pipe(
      catchError((err) => {
        console.warn('[ProfileComponent] loadBookings permission/fetch error', err);
        return of([]);
      })
    ).subscribe(bookings => {
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
        avatar: this.resolveUserAvatar(this.user),
        dateOfBirth: this.user.dateOfBirth ? new Date(this.user.dateOfBirth) : null
      });
    }
  }

  async saveProfile(): Promise<void> {
    if (!this.user) {
      this.ui.error('Utente non disponibile. Ricarica la pagina.');
      return;
    }
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.ui.warn('Compila correttamente i campi obbligatori.');
      return;
    }

    const updated = this.profileForm.getRawValue();
    const avatarCandidate = this.normalizeAvatarUrl(updated.avatar);
    const isDataUrlAvatar = avatarCandidate.startsWith('data:image/');
    const normalizedAvatar = isDataUrlAvatar
      ? (this.user?.avatar || this.defaultAvatar)
      : (avatarCandidate || this.defaultAvatar);
    this.profileForm.patchValue({ avatar: normalizedAvatar });
    if (isDataUrlAvatar) {
      this.ui.warn('Avatar locale non persistito. Usa un avatar preset o URL pubblico.');
    }

    try {
      await this.authService.updateCurrentUserProfile({
        name: updated.name,
        avatar: normalizedAvatar,
        phone: updated.phone,
        dateOfBirth: this.toDateOnlyString(updated.dateOfBirth),
        address: updated.address,
        city: updated.city,
        postalCode: updated.postalCode,
        country: updated.country
      });

      this.user = { ...this.user, ...updated, avatar: normalizedAvatar, urlAvatar: normalizedAvatar };
      this.toggleEdit();
      this.ui.success('Profilo aggiornato con successo.');
    } catch (err) {
      console.error('Errore aggiornamento profilo:', err);
      this.ui.error('Salvataggio non riuscito. Verifica i permessi e riprova.');
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.profileForm.patchValue({ avatar: base64 });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  selectPresetAvatar(avatarUrl: string): void {
    this.profileForm.patchValue({ avatar: avatarUrl });
  }

  resetAvatar(): void {
    this.profileForm.patchValue({ avatar: this.defaultAvatar });
  }

  avatarPreview(): string {
    return this.normalizeAvatarUrl(this.profileForm.get('avatar')?.value) || this.defaultAvatar;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img) return;

    const current = String(img.getAttribute('src') ?? '').trim();
    if (current && current !== this.defaultAvatar && current !== this.avatar404Placeholder) {
      img.setAttribute('src', this.defaultAvatar);
      return;
    }

    if (current !== this.avatar404Placeholder) {
      img.setAttribute('src', this.avatar404Placeholder);
    }
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

  private toDateOnlyString(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private releaseSubscriptions(): void {
    this.bookingsSub?.unsubscribe();
    this.bookingsSub = undefined;
    this.projectsSub?.unsubscribe();
    this.projectsSub = undefined;
  }

  private resolveUserAvatar(user: AppUser): string {
    return this.normalizeAvatarUrl(user.avatar) || this.normalizeAvatarUrl(user.urlAvatar) || this.defaultAvatar;
  }

  private normalizeAvatarUrl(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    if (normalized === '-' || normalized === 'null' || normalized === 'undefined') return '';
    return raw;
  }
}
