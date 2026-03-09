import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember } from '../../../../core/services/staff/staff.service';

export interface ArtistDetailsDialogData {
  artistId: string;
  artist?: StaffMember | null;
}

@Component({
  selector: 'app-artist-details-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './artist-details-dialog.component.html',
  styleUrl: './artist-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArtistDetailsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ArtistDetailsDialogData) {}

  get artistName(): string {
    const value = String(this.data?.artist?.name ?? '').trim();
    return value || 'Artista';
  }

  get roleLabel(): string {
    const raw = String(this.data?.artist?.role ?? '').trim().toLowerCase();
    if (raw === 'tatuatore') return 'Tatuatore';
    if (raw === 'piercer') return 'Piercer';
    if (raw === 'guest') return 'Guest';
    if (raw === 'altro') return 'Altro';
    return '-';
  }

  get emailLabel(): string {
    return this.safeText(this.data?.artist?.email);
  }

  get phoneLabel(): string {
    return this.safeText(this.data?.artist?.phone);
  }

  get bioLabel(): string {
    return this.safeText(this.data?.artist?.bio);
  }

  get specialtyLabel(): string {
    const artist = (this.data?.artist ?? {}) as Record<string, unknown>;
    const candidates = [
      artist['specialty'],
      artist['specialties'],
      artist['style'],
      artist['styles'],
      artist['stile'],
      artist['genere'],
      artist['subject'],
      artist['skills'],
      artist['tags']
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeTagValue(candidate);
      if (normalized) return normalized;
    }
    return '-';
  }

  get photoUrl(): string {
    return String(this.data?.artist?.photoUrl ?? '').trim();
  }

  get isActiveLabel(): string {
    return this.data?.artist?.isActive === false ? 'Non attivo' : 'Attivo';
  }

  private safeText(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || '-';
  }

  private normalizeTagValue(value: unknown): string {
    if (Array.isArray(value)) {
      const parts = value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      return parts.length ? parts.join(', ') : '';
    }

    const raw = String(value ?? '').trim();
    if (!raw) return '';

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const parts = parsed
            .map((item) => String(item ?? '').trim())
            .filter(Boolean);
          return parts.join(', ');
        }
      } catch {
        // fallback raw string below
      }
    }

    return raw;
  }
}
