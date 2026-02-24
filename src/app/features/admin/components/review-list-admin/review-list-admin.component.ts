import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, map, startWith } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { Review, ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';

type SortOrder = 'date_desc' | 'date_asc' | 'rating_desc' | 'rating_asc';

@Component({
  selector: 'app-review-list-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './review-list-admin.component.html',
  styleUrls: ['./review-list-admin.component.scss']
})
export class ReviewListAdminComponent implements OnInit {
  private readonly ui = inject(UiFeedbackService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly staffService = inject(StaffService);
  private readonly destroyRef = inject(DestroyRef);

  reviews: Review[] = [];
  artists: StaffMember[] = [];
  showFilters = true;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly artistControl = new FormControl<string>('', { nonNullable: true });
  readonly ratingControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<string>('', { nonNullable: true });
  readonly orderByControl = new FormControl<SortOrder>('date_desc', { nonNullable: true });

  readonly filterForm = new FormGroup({
    searchControl: this.searchControl,
    artistControl: this.artistControl,
    ratingControl: this.ratingControl,
    statusControl: this.statusControl,
    orderByControl: this.orderByControl
  });

  filteredReviews$: Observable<Review[]> = new Observable<Review[]>();

  ngOnInit(): void {
    this.reviewsService.getAllReviews()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(reviews => {
        this.reviews = reviews ?? [];
        this.setupFilterStream();
      });

    this.staffService.getAllStaff()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(artists => {
        this.artists = artists ?? [];
      });
  }

  private setupFilterStream(): void {
    const search$ = this.searchControl.valueChanges.pipe(startWith(this.searchControl.value));
    const artist$ = this.artistControl.valueChanges.pipe(startWith(this.artistControl.value));
    const rating$ = this.ratingControl.valueChanges.pipe(startWith(this.ratingControl.value));
    const status$ = this.statusControl.valueChanges.pipe(startWith(this.statusControl.value));
    const order$ = this.orderByControl.valueChanges.pipe(startWith(this.orderByControl.value));

    this.filteredReviews$ = combineLatest([search$, artist$, rating$, status$, order$]).pipe(
      map(([searchTerm, artistId, minRating, status, order]) => {
        const search = String(searchTerm ?? '').trim().toLowerCase();
        const min = Number(minRating ?? 0);

        const filtered = this.reviews.filter((review) => {
          const artistName = this.getArtistNameById(review.artistId ?? '').toLowerCase();
          const comment = String(review.comment ?? '').toLowerCase();
          const tattooTitle = String(review.tattooTitle ?? '').toLowerCase();

          const matchesSearch =
            !search ||
            comment.includes(search) ||
            tattooTitle.includes(search) ||
            artistName.includes(search);

          const matchesArtist = !artistId || review.artistId === artistId;
          const matchesRating = !minRating || review.rating >= min;
          const matchesStatus = !status || review.status === status;

          return matchesSearch && matchesArtist && matchesRating && matchesStatus;
        });

        return this.sortReviews(filtered, order);
      })
    );
  }

  private sortReviews(reviews: Review[], order: SortOrder): Review[] {
    const sorted = [...reviews];
    switch (order) {
      case 'rating_desc':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'rating_asc':
        return sorted.sort((a, b) => a.rating - b.rating);
      case 'date_asc':
        return sorted.sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
      default:
        return sorted.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    }
  }

  getArtistNameById(id: string): string {
    if (!id) return 'Artista';
    return this.artists.find(a => a.id === id)?.name ?? 'Artista';
  }

  getArtistPhotoById(id: string): string {
    if (!id) return 'https://i.pravatar.cc/300?img=1';
    return this.artists.find(a => a.id === id)?.photoUrl || 'https://i.pravatar.cc/300?img=1';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'approved': return 'Approvata';
      case 'pending': return 'In attesa';
      case 'rejected': return 'Rifiutata';
      default: return status;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'approved': return 'check_circle';
      case 'pending': return 'schedule';
      case 'rejected': return 'cancel';
      default: return 'info';
    }
  }

  updateStatus(review: Review, status: 'approved' | 'rejected'): void {
    if (!review?.id) return;
    if (review.status === status) return;

    this.reviewsService.updateReview(review.id, { status })
      .then(() => {
        review.status = status;
        this.ui.success(`Recensione ${this.getStatusLabel(status).toLowerCase()}.`);
      })
      .catch(() => this.ui.error('Errore aggiornamento stato recensione.'));
  }

  resetFilters(): void {
    this.filterForm.reset({
      searchControl: '',
      artistControl: '',
      ratingControl: '',
      statusControl: '',
      orderByControl: 'date_desc'
    });
  }
}
