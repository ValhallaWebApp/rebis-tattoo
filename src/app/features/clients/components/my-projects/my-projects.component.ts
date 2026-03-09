import { CommonModule } from '@angular/common';
import { Component, Injector, OnDestroy, OnInit, effect, inject, runInInjectionContext } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';
import { StatusHelperService } from '../../../../core/services/helpers/status-helper.service';
import { LanguageService } from '../../../../core/services/language/language.service';
import { ProjectStatus, ProjectsService, TattooProject } from '../../../../core/services/projects/projects.service';
import { Session, SessionService } from '../../../../core/services/session/session.service';

type ProjectTimelineVm = {
  id: string;
  title: string;
  thumbnailUrl: string;
  hasCustomThumbnail: boolean;
  statusLabel: string;
  statusClass: string;
  updatedAt: string;
  zone: string;
  style: string;
  projectNotes: string;
  consultation: {
    when: string;
    status: string;
    statusKey: string;
    notes: string;
  } | null;
  upcomingSessions: Array<{
    id: string;
    start: string;
    end: string;
    status: string;
    statusKey: string;
    notes: string;
  }>;
  completedSessionsCount: number;
};

@Component({
  selector: 'app-my-projects',
  standalone: true,
  imports: [CommonModule, RouterLink, MaterialModule],
  templateUrl: './my-projects.component.html',
  styleUrl: './my-projects.component.scss'
})
export class MyProjectsComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly projects = inject(ProjectsService);
  private readonly bookings = inject(BookingService);
  private readonly sessions = inject(SessionService);
  private readonly status = inject(StatusHelperService);
  readonly lang = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly thumbnailFallback = '/bg/texture-1.jpg';

  private dataSub?: Subscription;

  loading = true;
  loadError = '';
  items: ProjectTimelineVm[] = [];
  backgroundImageUrl = '/home/rebis-bg.jpg';
  private backgroundFallbackTried = false;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const user = this.auth.userSig();
        const uid = String(user?.uid ?? '').trim();
        if (!uid) {
          this.items = [];
          this.loading = false;
          this.stopStream();
          return;
        }
        this.bindClient(uid);
      });
    });
  }

  ngOnDestroy(): void {
    this.stopStream();
  }

  private bindClient(clientId: string): void {
    this.stopStream();
    this.loading = true;
    this.loadError = '';

    this.dataSub = combineLatest([
      this.projects.getProjectsByClient(clientId).pipe(catchError(() => of([] as TattooProject[]))),
      this.bookings.getBookingsByClient(clientId).pipe(catchError(() => of([] as Booking[]))),
      this.sessions.getSessionsByClient(clientId).pipe(catchError(() => of([] as Session[])))
    ]).subscribe({
      next: ([projects, bookings, sessions]) => {
        this.items = this.buildViewModel(projects ?? [], bookings ?? [], sessions ?? []);
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.loading = false;
        this.loadError = this.t('clientTattoos.states.error');
      }
    });
  }

  private buildViewModel(projects: TattooProject[], bookings: Booking[], sessions: Session[]): ProjectTimelineVm[] {
    const byBookingId = new Map<string, Booking>();
    const byProjectId = new Map<string, Booking[]>();

    for (const booking of bookings) {
      const bookingId = String((booking as any)?.id ?? '').trim();
      if (bookingId) byBookingId.set(bookingId, booking);

      const projectId = String((booking as any)?.projectId ?? '').trim();
      if (projectId) {
        const list = byProjectId.get(projectId) ?? [];
        list.push(booking);
        byProjectId.set(projectId, list);
      }
    }

    const now = Date.now();
    const cards: ProjectTimelineVm[] = [];

    for (const project of projects ?? []) {
      const projectId = String((project as any)?.id ?? '').trim();
      if (!projectId) continue;

      const linkedBookingId = String((project as any)?.bookingId ?? '').trim();
      const candidates = byProjectId.get(projectId) ?? [];
      const consultation =
        (linkedBookingId ? byBookingId.get(linkedBookingId) : undefined) ??
        candidates
          .slice()
          .sort((a, b) => this.toTimestamp((a as any)?.start) - this.toTimestamp((b as any)?.start))[0] ??
        null;

      const sessionIds = new Set(
        (Array.isArray((project as any)?.sessionIds) ? (project as any).sessionIds : [])
          .map((id: unknown) => String(id ?? '').trim())
          .filter(Boolean)
      );
      const projectSessions = (sessions ?? [])
        .filter((session) => {
          const sid = String((session as any)?.id ?? '').trim();
          const sProject = String((session as any)?.projectId ?? '').trim();
          const sBooking = String((session as any)?.bookingId ?? '').trim();
          return (
            (sid && sessionIds.has(sid)) ||
            (sProject && sProject === projectId) ||
            (!!consultation && sBooking === String((consultation as any)?.id ?? '').trim())
          );
        })
        .sort((a, b) => this.toTimestamp((a as any)?.start) - this.toTimestamp((b as any)?.start));

      const upcomingSessions = projectSessions
        .filter((session) => this.toTimestamp((session as any)?.start) >= now && String((session as any)?.status ?? '') !== 'cancelled')
        .map((session) => {
          const rawStatus = String((session as any)?.status ?? this.t('clientTattoos.fallback.sessionStatus'));
          const statusKey = this.mapStatusKey(rawStatus);
          return {
            id: String((session as any)?.id ?? ''),
            start: String((session as any)?.start ?? ''),
            end: String((session as any)?.end ?? ''),
            status: this.statusToLabel(statusKey, rawStatus),
            statusKey,
            notes: this.pickNotes((session as any)?.notesByAdmin)
          };
        });

      const completedSessionsCount = projectSessions.filter((session) => String((session as any)?.status ?? '') === 'completed').length;

      const thumb = this.projectThumbnailOf(project);

      cards.push({
        id: projectId,
        title: String((project as any)?.title ?? this.t('clientTattoos.fallback.projectTitle')),
        thumbnailUrl: thumb.url,
        hasCustomThumbnail: thumb.hasCustom,
        statusLabel: this.status.projectLabel((project as any)?.status as ProjectStatus, 'client'),
        statusClass: this.status.projectStatusKey((project as any)?.status as ProjectStatus),
        updatedAt: String((project as any)?.updatedAt ?? ''),
        zone: String((project as any)?.zone ?? (project as any)?.placement ?? '').trim() || '-',
        style: String((project as any)?.style ?? '').trim() || '-',
        projectNotes: this.pickNotes((project as any)?.notes ?? (project as any)?.note),
        consultation: consultation
          ? (() => {
              const rawStatus = String((consultation as any)?.status ?? this.t('clientTattoos.fallback.consultationStatus'));
              const statusKey = this.mapStatusKey(rawStatus);
              return {
                when: String((consultation as any)?.start ?? ''),
                status: this.statusToLabel(statusKey, rawStatus),
                statusKey,
                notes: this.pickNotes((consultation as any)?.notes)
              };
            })()
          : null,
        upcomingSessions,
        completedSessionsCount
      });
    }

    return cards.sort((a, b) => this.toTimestamp(b.updatedAt) - this.toTimestamp(a.updatedAt));
  }

  private pickNotes(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || this.t('clientTattoos.fallback.noNotes');
  }

  private toTimestamp(value: unknown): number {
    const ts = new Date(String(value ?? '')).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  private mapStatusKey(rawStatus: string): string {
    const normalized = String(rawStatus ?? '').trim().toLowerCase();
    switch (normalized) {
      case 'planned':
      case 'plan':
        return 'planned';
      case 'pending':
      case 'in-attesa':
      case 'in_attesa':
        return 'pending';
      case 'confirmed':
      case 'confermata':
      case 'confermato':
        return 'confirmed';
      case 'in progress':
      case 'in-progress':
      case 'in_progress':
      case 'working':
      case 'in lavorazione':
        return 'inProgress';
      case 'completed':
      case 'done':
      case 'completata':
      case 'completato':
        return 'completed';
      case 'cancelled':
      case 'canceled':
      case 'annullata':
      case 'annullato':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  private statusToLabel(statusKey: string, fallbackRaw: string): string {
    const translated = this.t(`clientTattoos.status.${statusKey}`);
    if (translated && translated !== `clientTattoos.status.${statusKey}`) return translated;
    return String(fallbackRaw ?? '').trim() || this.t('clientTattoos.status.unknown');
  }

  private projectThumbnailOf(project: TattooProject): { url: string; hasCustom: boolean } {
    const coverAsset = (project as any)?.coverImage;
    const coverAssetUrl = String((coverAsset as any)?.downloadUrl ?? '').trim();
    if (coverAssetUrl) return { url: coverAssetUrl, hasCustom: true };

    const galleryAssets = Array.isArray((project as any)?.gallery) ? (project as any).gallery : [];
    const galleryUrl = galleryAssets
      .map((asset: any) => String(asset?.downloadUrl ?? '').trim())
      .find(Boolean);
    if (galleryUrl) return { url: galleryUrl, hasCustom: true };

    const finalImages = Array.isArray((project as any)?.finalImages) ? (project as any).finalImages : [];
    const cover = finalImages.find((img: any) => img?.isCover)?.url;
    const coverUrl = String(cover ?? '').trim();
    if (coverUrl) return { url: coverUrl, hasCustom: true };

    const imageUrls = Array.isArray((project as any)?.imageUrls) ? (project as any).imageUrls : [];
    const firstImage = imageUrls.map((x: unknown) => String(x ?? '').trim()).find(Boolean);
    if (firstImage) return { url: firstImage, hasCustom: true };

    const legacyCovers = Array.isArray((project as any)?.copertine) ? (project as any).copertine : [];
    const legacyImage = legacyCovers.map((x: unknown) => String(x ?? '').trim()).find(Boolean);
    if (legacyImage) return { url: legacyImage, hasCustom: true };

    return { url: this.thumbnailFallback, hasCustom: false };
  }

  onProjectThumbError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.thumbnailFallback)) return;
    img.src = this.thumbnailFallback;
  }

  onBackgroundImageError(): void {
    if (!this.backgroundFallbackTried) {
      this.backgroundFallbackTried = true;
      this.backgroundImageUrl = '/bg/rebis-bg.jpg';
      return;
    }
    this.backgroundImageUrl = '';
  }

  private stopStream(): void {
    if (this.dataSub) {
      this.dataSub.unsubscribe();
      this.dataSub = undefined;
    }
  }

  t(path: string): string {
    return this.lang.t(path);
  }
}
