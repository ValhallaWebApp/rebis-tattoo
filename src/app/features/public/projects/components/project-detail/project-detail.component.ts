import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, from, switchMap, map } from 'rxjs';

import { MaterialModule } from '../../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { ProjectsService, TattooProject, ProjectStatus } from '../../../../../core/services/projects/projects.service';

type ProjectStatusUI = ProjectStatus | 'approved' | 'in_progress' | 'paused' | string;

interface ProjectImage {
  url: string;
  isCover?: boolean;
}

type PublicTattooProject = TattooProject & {
  description?: string;

  bodyPart?: string;
  placement?: string;
  size?: string;

  style?: string;
  subject?: string;

  colorType?: string;

  estimatedSessions?: number;
  estimatedPrice?: number;
  deposit?: number;

  clientNotes?: string;

  finalImages?: ProjectImage[];
  isPublic?: boolean;

  status?: ProjectStatusUI;
};

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.scss'],
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly staffService = inject(StaffService);

  private sub?: Subscription;
  private staffSub?: Subscription;

  loading = true;
  notFound = false;

  project?: PublicTattooProject;

  artists: StaffMember[] = [];

  activeIndex = 0;
  readonly fallbackCover = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">' +
      '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
      '<stop offset="0" stop-color="#151515"/><stop offset="1" stop-color="#2a2a2a"/>' +
      '</linearGradient></defs>' +
      '<rect width="1200" height="800" fill="url(#g)"/>' +
      '<rect x="80" y="80" width="1040" height="640" fill="none" stroke="#3a3a3a" stroke-width="6" rx="28"/>' +
      '<path d="M360 520l140-160 120 120 180-220 220 260" fill="none" stroke="#8a8a8a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="460" cy="320" r="46" fill="#8a8a8a"/>' +
      '<text x="600" y="680" fill="#9a9a9a" font-size="32" text-anchor="middle" font-family="Arial, sans-serif">No photo</text>' +
    '</svg>'
  )}`;

  ngOnInit(): void {
    this.staffSub = this.staffService.getAllStaff()
      .pipe(map(list => (list ?? []).filter(s => s?.isActive !== false)))
      .subscribe(staff => (this.artists = staff ?? []));

    this.sub = this.route.paramMap
      .pipe(
        switchMap(pm => {
          this.loading = true;
          this.notFound = false;
          this.activeIndex = 0;

          const id = pm.get('idProgetto') ?? pm.get('projectId') ?? pm.get('id');
          if (!id) return from(Promise.resolve(null));

          return from(this.projectsService.getProjectById(id));
        })
      )
      .subscribe(p => {
        const normalized = p ? this.normalizeProject(p as any) : undefined;
        if (normalized && ((normalized as any).isPublic === false || String((normalized as any).status ?? '').trim() !== 'completed')) {
          this.project = undefined;
          this.notFound = true;
          this.loading = false;
          this.scrollToTop();
          return;
        }
        this.project = normalized;
        this.loading = false;
        this.notFound = !this.project;
        this.activeIndex = this.getCoverIndex();
        this.scrollToTop();
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.staffSub?.unsubscribe();
  }

  // -------- NAV --------
  goBackToProjects() {
    return ['/progetti'];
  }

  goToArtistProjects() {
    const artistId = this.project?.artistId;
    return artistId ? ['/progetti', artistId] : ['/progetti'];
  }

  artistName(): string {
    const id = this.project?.artistId;
    if (!id) return 'Artista';
    return this.artists.find(a => String(a.id ?? '') === id)?.name ?? 'Artista';
  }

  projectId(): string {
    return String((this.project as any)?.id ?? '').trim();
  }

  createdAtOf(): string {
    return String((this.project as any)?.createdAt ?? (this.project as any)?.createAt ?? (this.project as any)?.dataProgetto ?? '').trim();
  }

  zoneLabel(): string {
    const body = String((this.project as any)?.bodyPart ?? '').trim();
    const zone = String((this.project as any)?.zone ?? '').trim();
    const placement = String((this.project as any)?.placement ?? '').trim();
    return [body || zone, placement].filter(Boolean).join(' - ');
  }

  // -------- GALLERY --------
  imageUrls(): string[] {
    const p = this.project;
    const imgs = Array.isArray(p?.finalImages) ? p!.finalImages! : [];
    const finalUrls = imgs.map(i => String(i?.url ?? '').trim()).filter(Boolean);
    const listA = Array.isArray((p as any)?.imageUrls) ? (p as any).imageUrls : [];
    const listB = Array.isArray((p as any)?.copertine) ? (p as any).copertine : [];
    const extra = [...listA, ...listB].map(x => String(x ?? '').trim()).filter(Boolean);
    const urls = [...finalUrls, ...extra];
    const dedup = urls.length ? Array.from(new Set(urls)) : [];
    return dedup.length ? dedup : [this.fallbackCover];
  }

  hasMultipleImages(): boolean {
    return this.imageUrls().length > 1;
  }

  activeCover(): string {
    const urls = this.imageUrls();
    const i = Math.min(Math.max(this.activeIndex, 0), urls.length - 1);
    return urls[i] ?? this.fallbackCover;
  }

  setActive(i: number) {
    const urls = this.imageUrls();
    this.activeIndex = Math.min(Math.max(i, 0), urls.length - 1);
  }

  next() {
    const urls = this.imageUrls();
    this.activeIndex = (this.activeIndex + 1) % urls.length;
  }

  prev() {
    const urls = this.imageUrls();
    this.activeIndex = (this.activeIndex - 1 + urls.length) % urls.length;
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.fallbackCover) {
      img.src = this.fallbackCover;
    }
  }

  // -------- LABELS --------
  statusLabel(): string {
    const s = String((this.project as any)?.status ?? '').trim() as ProjectStatusUI;

    switch (s) {
      case 'draft': return 'Bozza';
      case 'scheduled': return 'Pianificato';
      case 'active': return 'Attivo';
      case 'healing': return 'Guarigione';
      case 'completed': return 'Concluso';
      case 'cancelled': return 'Annullato';

      case 'approved': return 'Approvato';
      case 'in_progress': return 'In corso';
      case 'paused': return 'In pausa';

      default: return s || '-';
    }
  }

  colorTypeLabel(): string {
    const c = String((this.project as any)?.colorType ?? '').trim().toLowerCase();

    if (!c) return '-';

    if (c === 'black' || c === 'blackwork') return 'Nero';
    if (c === 'black_grey' || c === 'black&grey' || c === 'blackgrey') return 'Black & Grey';
    if (c === 'color' || c === 'full_color' || c === 'fullcolor') return 'Colore';
    if (c === 'mixed') return 'Misto';

    return c;
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private getCoverIndex(): number {
    const imgs = Array.isArray(this.project?.finalImages) ? this.project!.finalImages! : [];
    const idx = imgs.findIndex(i => !!i?.isCover);
    return idx >= 0 ? idx : 0;
  }

  private normalizeProject(raw: any): PublicTattooProject {
    const title = String(raw?.title ?? raw?.name ?? '').trim() || 'Progetto';
    const description = String(raw?.description ?? raw?.notes ?? raw?.note ?? '').trim();
    const style = String(raw?.style ?? raw?.genere ?? '').trim();
    const subject = String(raw?.subject ?? '').trim();
    const bodyPart = String(raw?.bodyPart ?? raw?.zone ?? '').trim();
    const placement = String(raw?.placement ?? raw?.posizione ?? '').trim();
    const size = String(raw?.size ?? raw?.dimensione ?? '').trim();

    const estimatedSessions =
      Number.isFinite(Number(raw?.estimatedSessions)) ? Number(raw.estimatedSessions) :
      Number.isFinite(Number(raw?.numeroSedute)) ? Number(raw.numeroSedute) :
      undefined;

    const estimatedPrice =
      Number.isFinite(Number(raw?.estimatedPrice)) ? Number(raw.estimatedPrice) :
      Number.isFinite(Number(raw?.price)) ? Number(raw.price) :
      undefined;

    const deposit =
      Number.isFinite(Number(raw?.deposit)) ? Number(raw.deposit) :
      Number.isFinite(Number(raw?.acconto)) ? Number(raw.acconto) :
      undefined;

    const clientNotes = String(raw?.clientNotes ?? raw?.noteCliente ?? '').trim();

    return {
      ...(raw as any),
      title,
      description,
      style,
      subject,
      bodyPart,
      placement,
      size,
      estimatedSessions,
      estimatedPrice,
      deposit,
      clientNotes,
    } as PublicTattooProject;
  }
}
