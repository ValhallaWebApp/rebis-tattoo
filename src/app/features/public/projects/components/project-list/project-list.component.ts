import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, combineLatest, map } from 'rxjs';

import { MaterialModule } from '../../../../../core/modules/material.module';
import { LanguageService } from '../../../../../core/services/language/language.service';

import { StaffMember, StaffService } from '../../../../../core/services/staff/staff.service';
import { TattooProject, ProjectsService } from '../../../../../core/services/projects/projects.service';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly staffService = inject(StaffService);
  private readonly projectsService = inject(ProjectsService);
  public readonly lang = inject(LanguageService);

  private sub?: Subscription;
  private lastRouteArtistId: string | null = null;

  // DATA
  projects: TattooProject[] = [];
  filteredProjects: TattooProject[] = [];
  artists: StaffMember[] = [];

  // FILTERS
  selectedArtistId: string | 'all' = 'all';
  selectedStyle: string | 'all' = 'all';
  selectedSubject: string | 'all' = 'all';
  selectedZone: string | 'all' = 'all';
  onlyWithImages = false;

  // OPTIONS
  styles: string[] = [];
  subjects: string[] = [];
  zones: string[] = [];

  // UI
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
    const staff$ = this.staffService.getAllStaff().pipe(
      map(staff => (staff ?? []).filter(s => s?.isActive !== false))
    );

    const projects$ = this.projectsService.getProjects().pipe(
      map(list => (list ?? []).filter(p => (p as any).isPublic !== false && String((p as any).status ?? '').trim() === 'completed'))
    );
    const routeArtistId$ = this.route.paramMap.pipe(map(pm => pm.get('artistId')));
    const queryParams$ = this.route.queryParamMap;

    this.sub = combineLatest([projects$, staff$, routeArtistId$, queryParams$]).subscribe(([projects, staff, routeArtistId, qpm]) => {
      this.projects = projects ?? [];
      this.artists = staff ?? [];

      const currentRouteId = routeArtistId ?? null;
      if (currentRouteId !== this.lastRouteArtistId) {
        this.lastRouteArtistId = currentRouteId;
        this.selectedArtistId = currentRouteId ?? 'all';
      }

      const qArtist = qpm.get('artistId');
      const qStyle = qpm.get('style');
      const qSubject = qpm.get('subject');
      const qZone = qpm.get('zone');
      const qImages = qpm.get('images');

      if (qArtist && qArtist !== this.selectedArtistId) this.selectedArtistId = qArtist;
      if (qStyle && qStyle !== this.selectedStyle) this.selectedStyle = qStyle;
      if (qSubject && qSubject !== this.selectedSubject) this.selectedSubject = qSubject;
      if (qZone && qZone !== this.selectedZone) this.selectedZone = qZone;
      if (qImages && qImages !== (this.onlyWithImages ? '1' : '0')) this.onlyWithImages = qImages === '1';

      // build options
      this.styles = Array.from(
        new Set(this.projects.flatMap(p => this.stylesOf(p)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      this.subjects = Array.from(
        new Set(this.projects.flatMap(p => this.subjectsOf(p)).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      this.zones = Array.from(
        new Set(this.projects.flatMap(p => this.zonesOf(p)).filter(Boolean))
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
    const zone = this.selectedZone;
    const onlyImages = this.onlyWithImages;
    this.filteredProjects = (this.projects ?? []).filter(p => {
      const artistIds = this.artistIdsOf(p);
      const matchArtist = artistId === 'all' || artistIds.includes(String(artistId));

      const matchStyle = style === 'all' || this.matchTag(style, this.stylesOf(p));
      const matchSubject = subject === 'all' || this.matchTag(subject, this.subjectsOf(p));
      const matchZone = zone === 'all' || this.matchTag(zone, this.zonesOf(p));

      // se isPublic e' undefined, trattiamolo come "visibile"
      const isPublic = (p as any).isPublic as boolean | undefined;
      const matchVisibility = isPublic !== false;

      const hasImages = this.imageUrlsOf(p).length > 0;
      const matchImages = !onlyImages || hasImages;

      return matchArtist && matchStyle && matchSubject && matchZone && matchVisibility && matchImages;
    });

    // ordinamento: più recenti prima
    this.filteredProjects.sort((a, b) =>
      this.createdAtOf(b).localeCompare(this.createdAtOf(a))
    );
  }

  resetFilters(): void {
    this.selectedArtistId = 'all';
    this.selectedStyle = 'all';
    this.selectedSubject = 'all';
    this.selectedZone = 'all';
    this.onlyWithImages = false;
    this.applyFilters();
    void this.router.navigate(['/progetti'], { queryParams: {} });
  }

  onArtistChange(): void {
    this.applyFilters();
    this.syncToQueryParams();
  }

  setStyle(value: string | 'all'): void {
    this.selectedStyle = value;
    this.applyFilters();
    this.syncToQueryParams();
  }

  setSubject(value: string | 'all'): void {
    this.selectedSubject = value;
    this.applyFilters();
    this.syncToQueryParams();
  }

  setZone(value: string | 'all'): void {
    this.selectedZone = value;
    this.applyFilters();
    this.syncToQueryParams();
  }

  toggleOnlyImages(): void {
    this.onlyWithImages = !this.onlyWithImages;
    this.applyFilters();
    this.syncToQueryParams();
  }

  isStyleActive(value: string | 'all'): boolean {
    return this.selectedStyle === value;
  }

  isSubjectActive(value: string | 'all'): boolean {
    return this.selectedSubject === value;
  }

  isZoneActive(value: string | 'all'): boolean {
    return this.selectedZone === value;
  }

  artistNameById(id: string): string {
    return this.artists.find(a => String(a.id ?? '') === id)?.name ?? '—';
  }

  titleOf(p: TattooProject): string {
    return String((p as any).title ?? (p as any).name ?? '').trim() || 'Progetto';
  }

  createdAtOf(p: TattooProject): string {
    return String((p as any).createdAt ?? (p as any).createAt ?? (p as any).dataProgetto ?? '').trim();
  }

  styleOf(p: TattooProject): string {
    return String((p as any).style ?? (p as any).genere ?? '').trim();
  }

  subjectOf(p: TattooProject): string {
    return String((p as any).subject ?? '').trim();
  }

  zoneOf(p: TattooProject): string {
    return String((p as any).zone ?? (p as any).bodyPart ?? '').trim();
  }

  private artistIdsOf(p: TattooProject): string[] {
    const single = String((p as any).artistId ?? '').trim();
    const arr = Array.isArray((p as any).artistIds) ? (p as any).artistIds : [];
    const extra = arr.map((x: any) => String(x ?? '').trim()).filter(Boolean);
    const all = [single, ...extra].filter(Boolean);
    return all.length ? Array.from(new Set(all)) : [];
  }

  private stylesOf(p: TattooProject): string[] {
    return this.splitTags(this.styleOf(p));
  }

  private subjectsOf(p: TattooProject): string[] {
    return this.splitTags(this.subjectOf(p));
  }

  private zonesOf(p: TattooProject): string[] {
    const z = this.zoneOf(p);
    const placement = String((p as any).placement ?? '').trim();
    return this.splitTags([z, placement].filter(Boolean).join(', '));
  }

  private splitTags(input: string): string[] {
    if (!input) return [];
    const raw = input
      .split(/[\/|,;]/g)
      .map(s => s.trim())
      .filter(Boolean);
    return raw.length ? Array.from(new Set(raw)) : [];
  }

  private matchTag(selected: string, values: string[]): boolean {
    const s = String(selected ?? '').trim().toLowerCase();
    if (!s) return true;
    return values.some(v => String(v ?? '').trim().toLowerCase() === s);
  }

  private syncToQueryParams(): void {
    const params: Record<string, any> = {
      artistId: this.selectedArtistId !== 'all' ? this.selectedArtistId : null,
      style: this.selectedStyle !== 'all' ? this.selectedStyle : null,
      subject: this.selectedSubject !== 'all' ? this.selectedSubject : null,
      zone: this.selectedZone !== 'all' ? this.selectedZone : null,
      images: this.onlyWithImages ? '1' : null
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  private imageUrlsOf(p: TattooProject): string[] {
    const finalImgs = Array.isArray((p as any).finalImages)
      ? (p as any).finalImages.map((i: any) => String(i?.url ?? '').trim()).filter(Boolean)
      : [];
    const listA = Array.isArray((p as any).imageUrls) ? (p as any).imageUrls : [];
    const listB = Array.isArray((p as any).copertine) ? (p as any).copertine : [];
    const extra = [...listA, ...listB].map(x => String(x ?? '').trim()).filter(Boolean);
    const all = [...finalImgs, ...extra];
    return all.length ? Array.from(new Set(all)) : [];
  }

  /** cover: prova finalImages[{isCover,url}], poi prima immagine, poi fallback */
  coverOf(p: TattooProject): string {
    const imgs = Array.isArray((p as any).finalImages) ? (p as any).finalImages : [];
    const cover = imgs.find((i: any) => i?.isCover)?.url?.trim?.();
    if (cover) return cover;

    const urls = this.imageUrlsOf(p);
    return urls[0] || this.fallbackCover;
  }

  imagesCount(p: TattooProject): number {
    return this.imageUrlsOf(p).length;
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.fallbackCover) {
      img.src = this.fallbackCover;
    }
  }

  trackById = (_: number, p: TattooProject) => p.id ?? `${p.artistId}-${p.clientId}-${p.title}`;
}
