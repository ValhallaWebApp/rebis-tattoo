import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, combineLatest, switchMap, map } from 'rxjs';

import { MaterialModule } from '../../../../../core/modules/material.module';
import { LanguageService } from '../../../../../core/services/language/language.service';

import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { TattooProject, ProjectsService } from '../../../../../core/services/projects/projects.service';

type ShowFilter = 'all' | 'visible' | 'hidden';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly staffService = inject(StaffService);
  private readonly projectsService = inject(ProjectsService);
  public readonly lang = inject(LanguageService);

  private sub?: Subscription;

  // DATA
  projects: TattooProject[] = [];
  filteredProjects: TattooProject[] = [];
  artists: StaffMember[] = [];

  // FILTERS
  selectedArtistId: string | 'all' = 'all';
  selectedStyle: string | 'all' = 'all';
  selectedSubject: string | 'all' = 'all';
  selectedShow: ShowFilter = 'all';

  // OPTIONS
  styles: string[] = [];
  subjects: string[] = [];

  // UI
  readonly fallbackCover = 'assets/portfolio/fallback.webp';

  ngOnInit(): void {
    const staff$ = this.staffService.getAllStaff().pipe(
      map(staff => (staff ?? []).filter(s => s?.isActive !== false))
    );

    const projects$ = this.route.paramMap.pipe(
      switchMap(pm => {
        const artistId = pm.get('artistId');
        this.selectedArtistId = artistId ?? 'all';

        // ✅ nel tuo ProjectsService NON c’è findProjectsByArtist: filtro lato client
        return this.projectsService.getProjects().pipe(
          map(list => {
            const all = list ?? [];
            return artistId ? all.filter(p => p.artistId === artistId) : all;
          })
        );
      })
    );

    this.sub = combineLatest([projects$, staff$]).subscribe(([projects, staff]) => {
      this.projects = projects ?? [];
      this.artists = staff ?? [];

      // build options
      this.styles = Array.from(
        new Set(this.projects.map(p => (p as any).style?.trim?.() ?? '').filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      this.subjects = Array.from(
        new Set(this.projects.map(p => (p as any).subject?.trim?.() ?? '').filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  applyFilters(): void {
    const artistId = this.selectedArtistId;
    const style = this.selectedStyle;
    const subject = this.selectedSubject;
    const show = this.selectedShow;

    this.filteredProjects = (this.projects ?? []).filter(p => {
      const matchArtist = artistId === 'all' || p.artistId === artistId;

      const pStyle = String((p as any).style ?? '').trim();
      const matchStyle = style === 'all' || pStyle.toLowerCase() === style.toLowerCase();

      const pSubject = String((p as any).subject ?? '').trim();
      const matchSubject = subject === 'all' || pSubject.toLowerCase() === subject.toLowerCase();

      // ✅ show richiede isPublic?: boolean (se non esiste, la logica "hidden" non matcha mai)
      const isPublic = (p as any).isPublic as boolean | undefined;
      const matchShow =
        show === 'all' ||
        (show === 'visible' ? isPublic === true : isPublic === false);

      return matchArtist && matchStyle && matchSubject && matchShow;
    });

    // ordinamento: più recenti prima
    this.filteredProjects.sort((a, b) =>
      String((b as any).createdAt ?? '').localeCompare(String((a as any).createdAt ?? ''))
    );
  }

  resetFilters(): void {
    const artistFromRoute = this.route.snapshot.paramMap.get('artistId');
    this.selectedArtistId = artistFromRoute ?? 'all';
    this.selectedStyle = 'all';
    this.selectedSubject = 'all';
    this.selectedShow = 'all';
    this.applyFilters();
  }

  artistNameById(id: string): string {
    return this.artists.find(a => String(a.id ?? '') === id)?.name ?? '—';
  }

  /** cover: prova finalImages[{isCover,url}], poi prima immagine, poi fallback */
  coverOf(p: TattooProject): string {
    const imgs = Array.isArray((p as any).finalImages) ? (p as any).finalImages : [];
    const cover = imgs.find((i: any) => i?.isCover)?.url?.trim?.();
    if (cover) return cover;

    const first = imgs[0]?.url?.trim?.();
    return first || this.fallbackCover;
  }

  imagesCount(p: TattooProject): number {
    const imgs = Array.isArray((p as any).finalImages) ? (p as any).finalImages : [];
    return imgs.length;
  }

  trackById = (_: number, p: TattooProject) => p.id ?? `${p.artistId}-${p.clientId}-${p.title}`;
}
