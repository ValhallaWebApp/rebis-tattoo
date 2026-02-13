// review-list-admin.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { Observable, combineLatest, map, startWith } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { Review, ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { MatTooltip, MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-review-list-admin',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    ReactiveFormsModule,
    MatTooltipModule
  ],
  templateUrl: './review-list-admin.component.html',
  styleUrls: ['./review-list-admin.component.scss']
})
export class ReviewListAdminComponent implements OnInit {
  private readonly snackbar = inject(UiFeedbackService);

  private readonly reviewService = inject(ReviewsService);
  private readonly staffService = inject(StaffService);

  reviews: Review[] = [];
  artists: StaffMember[] = [];
showFilters = false;

  searchControl = new FormControl('');
  artistControl = new FormControl('');
  ratingControl = new FormControl('');
  statusControl = new FormControl(''); // <-- nuovo controllo per stato
orderByControl = new FormControl('date_desc');

filterForm = new FormGroup({
  searchControl: this.searchControl,
  artistControl: this.artistControl,
  ratingControl: this.ratingControl,
  statusControl: this.statusControl,
  orderByControl: this.orderByControl  // 👈 nuovo
});


  filteredReviews$: Observable<Review[]> = new Observable<Review[]>();

  ngOnInit(): void {
    this.reviewService.getAllReviews().subscribe(reviews => {
      this.reviews = reviews;
      this.setupFilterStream();
    });

    this.staffService.getAllStaff().subscribe(artists => {
      this.artists = artists;
    });
  }

  setupFilterStream(): void {
    const search$ = this.searchControl.valueChanges.pipe(startWith(''));
    const artist$ = this.artistControl.valueChanges.pipe(startWith(''));
    const rating$ = this.ratingControl.valueChanges.pipe(startWith(''));
    const status$ = this.statusControl.valueChanges.pipe(startWith(''));

   const order$ = this.orderByControl.valueChanges.pipe(startWith('date_desc'));

this.filteredReviews$ = combineLatest([search$, artist$, rating$, status$, order$]).pipe(
  map(([searchTerm, artistId, minRating, status, order]) => {
    let filtered = this.reviews.filter(r =>
      (!searchTerm || r.comment?.toLowerCase().includes(searchTerm.toLowerCase()) || r.tattooTitle?.toLowerCase().includes(searchTerm.toLowerCase()))
      && (!artistId || r.artistId === artistId)
      && (!minRating || r.rating >= +minRating)
      && (!status || r.status === status)
    );

    switch (order) {
      case 'rating_desc':
        filtered = filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'rating_asc':
        filtered = filtered.sort((a, b) => a.rating - b.rating);
        break;
      case 'date_asc':
        filtered = filtered.sort((a, b) => a.date - b.date);
        break;
      default: // date_desc
        filtered = filtered.sort((a, b) => b.date - a.date);
        break;
    }

    return filtered;
  })
);

  }

  getArtistPhotoById(id: string): string | undefined {
    return this.artists.find(a => a.id === id)?.photoUrl;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'approved': return 'Approvata';
      case 'pending': return 'In attesa';
      case 'rejected': return 'Rifiutata';
      default: return status;
    }
  }

  updateStatus(review: Review, status: 'approved' | 'rejected'): void {
    this.reviewService.updateReview(review.id, { status }).then(() => {
      this.snackbar.open(`Recensione ${this.getStatusLabel(status).toLowerCase()}.`, 'Chiudi', {
        duration: 3000
      });
      review.status = status;
    });
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
