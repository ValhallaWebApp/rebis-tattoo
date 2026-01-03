import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FastBookingStore } from '../../state/fast-booking-store.service';

@Component({
  selector: 'app-step-artist',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './step-artist.component.html',
  styleUrl: './step-artist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepArtistComponent {
  private readonly store = inject(FastBookingStore);

  readonly artists = this.store.artists;
  readonly loading = this.store.loadingArtists;

  readonly selectedId = computed(() => this.store.draft().artistId);

  select(a: any) {
    this.store.setArtist(a);
  }
}
