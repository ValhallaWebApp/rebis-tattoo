import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FastBookingStore } from '../../state/fast-booking-store.service';
import { MaterialModule } from '../../../../../core/modules/material.module';

@Component({
  selector: 'app-step-artist',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MaterialModule],
  templateUrl: './step-artist.component.html',
  styleUrl: './step-artist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepArtistComponent {
  private readonly store = inject(FastBookingStore);
  readonly activeArtistFilter = signal<string | null>(null);

  readonly artists = this.store.artists;
  readonly artistQuickFilters = computed(() => (this.artists() ?? []).slice(0, 10));
  readonly filteredArtists = computed(() => {
    const list = this.artists() ?? [];
    const filterId = this.activeArtistFilter();
    if (!filterId) return list;
    return list.filter((a) => String(a.id ?? '') === filterId);
  });
  readonly loading = this.store.loadingArtists;
  readonly error = this.store.error;
  readonly depositEuro = this.store.depositEuro;
  readonly durationMin = this.store.durationMin;
  readonly fallbackAvatar = this.buildAvatarPlaceholder();

  readonly selectedId = computed(() => this.store.draft().artistId);

  select(a: any) {
    this.store.setArtist(a);
  }

  setArtistFilter(artistId: string | null): void {
    this.activeArtistFilter.set(artistId);
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.fallbackAvatar) return;
    img.src = this.fallbackAvatar;
  }

  private buildAvatarPlaceholder(): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
        '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
        '<stop offset="0" stop-color="#3a3227"/><stop offset="1" stop-color="#201b15"/>' +
        '</linearGradient></defs>' +
        '<rect width="128" height="128" rx="64" fill="url(#g)"/>' +
        '<circle cx="64" cy="48" r="22" fill="#b79b55"/>' +
        '<path d="M24 112c4-22 21-34 40-34s36 12 40 34" fill="#b79b55"/>' +
      '</svg>'
    )}`;
  }
}
