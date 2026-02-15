import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, map } from 'rxjs';
import { LanguageService } from '../../../../../core/services/language/language.service';
import { ProjectsService, TattooProject } from '../../../../../core/services/projects/projects.service';

type HomeProjectCard = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};

@Component({
  selector: 'app-home-projects',
  standalone: false,
  templateUrl: './home-projects.component.html',
  styleUrl: './home-projects.component.scss'
})
export class HomeProjectsComponent implements OnInit, OnDestroy {
  private readonly projectsService = inject(ProjectsService);
  private sub?: Subscription;

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

  loading = true;
  projects: HomeProjectCard[] = [];

  constructor(public lang: LanguageService) {}

  ngOnInit(): void {
    this.sub = this.projectsService.getProjects().pipe(
      map(list =>
        (list ?? [])
          .filter(p =>
            (p as any).isPublic !== false &&
            String((p as any).status ?? '').trim() === 'completed'
          )
          .sort((a, b) => this.createdAtOf(b).localeCompare(this.createdAtOf(a)))
          .slice(0, 6)
          .map(p => ({
            id: String(p.id ?? '').trim(),
            title: this.titleOf(p),
            description: this.descriptionOf(p),
            imageUrl: this.coverOf(p)
          }))
      )
    ).subscribe({
      next: rows => {
        this.projects = rows;
        this.loading = false;
      },
      error: () => {
        this.projects = [];
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private titleOf(p: TattooProject): string {
    return String((p as any).title ?? (p as any).name ?? '').trim() || 'Progetto';
  }

  private descriptionOf(p: TattooProject): string {
    const style = String((p as any).style ?? (p as any).genere ?? '').trim();
    const subject = String((p as any).subject ?? '').trim();
    const notes = String((p as any).notes ?? '').trim();
    const line = [style, subject].filter(Boolean).join(' - ');
    return line || notes || 'Progetto realizzato in studio.';
  }

  private createdAtOf(p: TattooProject): string {
    return String((p as any).createdAt ?? (p as any).createAt ?? (p as any).dataProgetto ?? '').trim();
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

  private coverOf(p: TattooProject): string {
    const imgs = Array.isArray((p as any).finalImages) ? (p as any).finalImages : [];
    const cover = imgs.find((i: any) => i?.isCover)?.url?.trim?.();
    if (cover) return cover;

    const urls = this.imageUrlsOf(p);
    return urls[0] || this.fallbackCover;
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== this.fallbackCover) {
      img.src = this.fallbackCover;
    }
  }
}
