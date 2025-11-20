import { Component, OnInit, ViewChild, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { AuthService } from '../../../../core/services/auth/authservice';
import { Review, ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { MatDrawer } from '@angular/material/sidenav';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackbar = inject(MatSnackBar);
  private readonly reviewsService = inject(ReviewsService);
  private readonly staffService = inject(StaffService);

  @ViewChild('reviewDrawer') reviewDrawer!: MatDrawer;

  user: any;
  reviews: Review[] = [];
  artists: any[] = [];
  filteredArtists: Observable<any[]> = new Observable();
  filterStatusCtrl = this.fb.control('all');

  reviewForm!: FormGroup;
  artistCtrl = this.fb.control('');
  selectedArtistId = '';
  selectedReview: Review | null = null;
  submitting = false;
  readonly _loadUserEffect = effect(() => {
    const user = this.auth.userSig();
    if (user) {
      this.user = user;
      this.loadData();
    }
  });
  ngOnInit() {


    this.reviewForm = this.fb.group({
      author: [{ value: '', disabled: true }, Validators.required],
      comment: ['', [Validators.required, Validators.minLength(10)]],
      rating: [5, Validators.required],
      artistId: ['', Validators.required]
    });
  }

  loadData(): void {
    if (!this.user?.uid) return;

    this.reviewsService.getReviewsByUser(this.user.uid).subscribe((list) => {
      this.reviews = list.sort((a, b) => b.date - a.date);
    });

    this.staffService.getAllStaff().subscribe((staff) => {
      this.artists = staff;
      this.filteredArtists = this.artistCtrl.valueChanges.pipe(
        startWith(''),
        map(value => this._filterArtists(value || ''))
      );
    });

    this.reviewForm.get('author')?.setValue(this.user.name || this.user.email);
  }

  private _filterArtists(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.artists.filter(a => a.name.toLowerCase().includes(filterValue));
  }

  openEmptyDrawer(): void {
    this.selectedReview = null;
    this.reviewForm.enable();
    this.reviewForm.reset({
      author: this.user.name,
      comment: '',
      rating: 5,
      artistId: ''
    });
    this.artistCtrl.setValue('');
    this.selectedArtistId = '';
    this.reviewDrawer.open();
  }

  editReview(review: Review): void {
    this.selectedReview = review;
    this.reviewForm.patchValue({
      author: this.user.name,
      comment: review.comment,
      rating: review.rating,
      artistId: review.artistId
    });
    this.artistCtrl.setValue(this.getArtistNameById(review.artistId));
    this.selectedArtistId = review.artistId || '';
    this.reviewDrawer.open();
  }

  canEditReview(review: Review): boolean {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - review.date <= fiveMinutes;
  }

  viewReview(review: Review): void {
    this.selectedReview = review;
    this.reviewForm.reset({
      author: this.user.name,
      comment: review.comment,
      rating: review.rating,
      artistId: review.artistId
    });

    const artist = this.artists.find(a => a.id === review.artistId);
    if (artist) {
      this.artistCtrl.setValue(artist.name);
      this.selectedArtistId = artist.id;
    }

    this.reviewForm.disable();
    this.artistCtrl.disable();
    this.reviewDrawer.open();
  }

  selectArtist(artist: any): void {
    this.artistCtrl.setValue(artist.name);
    this.selectedArtistId = artist.id;
    this.reviewForm.get('artistId')?.setValue(artist.id);
  }

  submitReview(): void {
    if (this.reviewForm.invalid) return;
    this.submitting = true;

    if (this.selectedReview) {
      if (!this.canEditReview(this.selectedReview)) {
        this.snackbar.open('Modifica non consentita: tempo scaduto.', 'Chiudi', { duration: 3000 });
        this.submitting = false;
        return;
      }

      const updatedData: Partial<Review> = {
        comment: this.reviewForm.value.comment,
        rating: this.reviewForm.value.rating,
        artistId: this.selectedArtistId
      };

      this.reviewsService.updateReview(this.selectedReview.id, updatedData).then(() => {
        this.snackbar.open('Recensione aggiornata.', 'Chiudi', { duration: 3000 });
        this.closeDrawerAndReset();
      }).finally(() => this.submitting = false);

    } else {
      const newReview: Review = {
        id: '',
        userId: this.user.uid,
        tattooTitle: 'Altro',
        comment: this.reviewForm.value.comment,
        rating: this.reviewForm.value.rating,
        status: 'pending',
        date: Date.now(),
        artistId: this.selectedArtistId
      };

      this.reviewsService.addReview(newReview).then(() => {
        this.snackbar.open('Recensione inviata! In attesa di approvazione.', 'Chiudi', { duration: 3000 });
        this.closeDrawerAndReset();
      }).finally(() => this.submitting = false);
    }
  }

  deleteReview(id: string): void {
    if (confirm('Confermi di voler eliminare la recensione?')) {
      this.reviewsService.deleteReview(id).then(() => {
        this.snackbar.open('Recensione eliminata.', 'Chiudi', { duration: 3000 });
        this.loadData();
      });
    }
  }

  filteredReviews(): Review[] {
    const status = this.filterStatusCtrl.value;
    return status === 'all'
      ? this.reviews
      : this.reviews.filter(r => r.status === status);
  }

  getArtistNameById(id: string | undefined): string {
    if (!id) return 'Artista';
    const artist = this.artists.find(a => a.id === id);
    return artist?.name || 'Artista';
  }

  getArtistPhotoById(id: string | undefined): string | null {
    if (!id) return null;
    const artist = this.artists.find(a => a.id === id);
    return artist?.photoUrl || null;
  }

  toggleDrawer(): void {
    if (this.reviewDrawer?.opened) {
      this.reviewDrawer.close();
      this.selectedReview = null;
    } else {
      this.openEmptyDrawer();
    }
  }

  private closeDrawerAndReset(): void {
    this.reviewForm.reset({
      author: this.user.name,
      comment: '',
      rating: 5,
      artistId: ''
    });
    this.artistCtrl.setValue('');
    this.selectedArtistId = '';
    this.selectedReview = null;
    this.reviewDrawer.close();
    this.loadData();
  }
}
