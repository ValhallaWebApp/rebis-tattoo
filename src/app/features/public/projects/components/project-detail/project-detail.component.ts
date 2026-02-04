import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, from, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';

import { MaterialModule } from '../../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { ProjectsService, TattooProject, ProjectStatus } from '../../../../../core/services/projects/projects.service';

type ProjectStatusUI = ProjectStatus | 'approved' | 'in_progress' | 'paused' | string;

interface ProjectImage {
  url: string;
  isCover?: boolean;
}

type PublicTattooProject = TattooProject & {
  // campi "public" che il template usa (opzionali per non rompere)
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
  readonly fallbackCover = 'assets/portfolio/fallback.webp';

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

          const id = pm.get('id') ?? pm.get('projectId'); // supporto se cambi param
          if (!id) return from(Promise.resolve(null));

          return from(this.projectsService.getProjectById(id));
        })
      )
      .subscribe(p => {
        this.project = (p as any) ?? undefined;
        this.loading = false;
        this.notFound = !this.project;
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.staffSub?.unsubscribe();
  }

  // -------- NAV --------
  goToArtistProjects() {
    const artistId = this.project?.artistId;
    return artistId ? ['/progetti', artistId] : ['/progetti'];
  }

  artistName(): string {
    const id = this.project?.artistId;
    if (!id) return 'Artista';
    return this.artists.find(a => String(a.id ?? '') === id)?.name ?? 'Artista';
  }

  // -------- GALLERY --------
  imageUrls(): string[] {
    const p = this.project;
    const imgs = Array.isArray(p?.finalImages) ? p!.finalImages! : [];
    const urls = imgs.map(i => String(i?.url ?? '').trim()).filter(Boolean);
    return urls.length ? urls : [this.fallbackCover];
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

      // ✅ legacy/vecchi stati che avevi nello switch
      case 'approved': return 'Approvato';
      case 'in_progress': return 'In corso';
      case 'paused': return 'In pausa';

      default: return s || '—';
    }
  }

  colorTypeLabel(): string {
    const c = String((this.project as any)?.colorType ?? '').trim().toLowerCase();

    if (!c) return '—';

    // mappa “umana” (aggiungi i tuoi valori reali qui)
    if (c === 'black' || c === 'blackwork') return 'Nero';
    if (c === 'black_grey' || c === 'black&grey' || c === 'blackgrey') return 'Black & Grey';
    if (c === 'color' || c === 'full_color' || c === 'fullcolor') return 'Colore';
    if (c === 'mixed') return 'Misto';

    return c;
  }
}
