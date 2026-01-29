import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, inject, effect, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDrawer } from '@angular/material/sidenav';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MaterialModule } from '../../../../core/modules/material.module';
import { AuthService } from '../../../../core/services/auth/authservice';
import { Review, ReviewsService } from '../../../../core/services/reviews/rewies.service';
import { StaffService } from '../../../../core/services/staff/staff.service';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | string;

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
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('reviewDrawer') reviewDrawer!: MatDrawer;

  user: any;

  reviews: Review[] = [];
  artists: any[] = [];

  // filtro status (usato nel template)
  filterStatusCtrl = this.fb.control<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // drawer/form
  reviewForm!: FormGroup;
  artistCtrl = this.fb.control<any>(''); // qui ci passa anche oggetto artista quando selezionato
  filteredArtists$: Observable<any[]> = new Observable<any[]>();

  selectedArtistId = '';
  selectedReview: Review | null = null;

  submitting = false;
  isReadOnly = false;

  // auto-load su user
  readonly _loadUserEffect = effect(() => {
    const u = this.auth.userSig();
    if (u?.uid) {
      this.user = u;
      this.loadData();
    }
  });

  ngOnInit(): void {
    this.reviewForm = this.fb.group({
      author: [{ value: '', disabled: true }, Validators.required],
      comment: ['', [Validators.required, Validators.minLength(10)]],
      rating: [5, Validators.required],
      artistId: ['', Validators.required]
    });
  }

  // -------------------------
  // LOAD
  // -------------------------
  private loadData(): void {
    if (!this.user?.uid) return;

    this.reviewForm.get('author')?.setValue(this.user?.name || this.user?.email || '');

    // reviews
    this.reviewsService.getReviewsByUser(this.user.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.reviews = (list ?? []).slice().sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
      });

    // staff
    this.staffService.getAllStaff()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((staff) => {
        this.artists = staff ?? [];

        // autocomplete
        this.filteredArtists$ = this.artistCtrl.valueChanges.pipe(
          startWith(''),
          map((value) => {
            const text =
              typeof value === 'string'
                ? value
                : (value?.name ?? '');

            return this._filterArtists(text);
          })
        );
      });
  }

  private _filterArtists(value: string): any[] {
    const v = (value ?? '').toLowerCase();
    return (this.artists ?? []).filter(a => (a?.name ?? '').toLowerCase().includes(v));
  }

  // -------------------------
  // TEMPLATE HELPERS
  // -------------------------
  filteredReviews(): Review[] {
    const status = this.filterStatusCtrl.value;
    if (!status || status === 'all') return this.reviews;
    return this.reviews.filter(r => r.status === status);
  }

  getArtistNameById(id: string | undefined): string {
    if (!id) return 'Artista';
    const a = this.artists.find(x => x.id === id);
    return a?.name || 'Artista';
  }

  getArtistPhotoById(id: string | undefined): string {
    if (!id) return 'https://i.pravatar.cc/300?img=1';
    const a = this.artists.find(x => x.id === id);
    return a?.photoUrl || 'https://i.pravatar.cc/300?img=1';
  }

  getStatusLabel(status: ReviewStatus): string {
    switch (status) {
      case 'pending': return 'In attesa';
      case 'approved': return 'Pubblicata';
      case 'rejected': return 'Rifiutata';
      default: return status || 'Stato';
    }
  }

  getStatusIcon(status: ReviewStatus): string {
    switch (status) {
      case 'pending': return 'schedule';
      case 'approved': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'info';
    }
  }

  canEditReview(review: Review): boolean {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - (review.date ?? 0) <= fiveMinutes;
  }

  // -------------------------
  // HEADER BUTTON
  // -------------------------
openCreate(): void {
  console.log('[Reviews] openCreate() click');

  if (!this.reviewDrawer) {
    console.error('[Reviews] reviewDrawer is undefined. @ViewChild non agganciato.');
    return;
  }

  this.selectedReview = null;
  this.isReadOnly = false;
  this.submitting = false;

  this.reviewForm.enable();
  this.artistCtrl.enable();

  this.reviewForm.reset({
    author: this.user?.name || this.user?.email || '',
    comment: '',
    rating: 5,
    artistId: ''
  });

  this.artistCtrl.setValue('');
  this.selectedArtistId = '';

  // ✅ forza apertura
  this.reviewDrawer.open();
  console.log('[Reviews] drawer opened?', this.reviewDrawer.opened);
}


  closeDrawer(): void {
    this.reviewDrawer.close();
    this.isReadOnly = false;

    // ripristino controlli
    this.reviewForm.enable();
    this.artistCtrl.enable();

    this.selectedReview = null;
    this.selectedArtistId = '';
    this.submitting = false;
  }

  // -------------------------
  // CARD ACTIONS
  // -------------------------
  viewReview(review: Review): void {
    this.selectedReview = review;
    this.isReadOnly = true;

    this.reviewForm.reset({
      author: this.user?.name || this.user?.email || '',
      comment: review.comment ?? '',
      rating: review.rating ?? 5,
      artistId: review.artistId ?? ''
    });

    const a = this.artists.find(x => x.id === review.artistId);
    this.artistCtrl.setValue(a?.name ?? '');

    // readonly
    this.reviewForm.disable();
    this.artistCtrl.disable();

    this.reviewDrawer.open();
  }

  editReview(review: Review): void {
    this.selectedReview = review;
    this.isReadOnly = false;

    this.reviewForm.enable();
    this.artistCtrl.enable();

    this.reviewForm.patchValue({
      author: this.user?.name || this.user?.email || '',
      comment: review.comment ?? '',
      rating: review.rating ?? 5,
      artistId: review.artistId ?? ''
    });

    const a = this.artists.find(x => x.id === review.artistId);
    this.artistCtrl.setValue(a?.name ?? '');

    this.selectedArtistId = review.artistId || '';

    this.reviewDrawer.open();
  }

  selectArtist(artist: any): void {
    if (!artist?.id) return;

    this.artistCtrl.setValue(artist.name);
    this.selectedArtistId = artist.id;

    this.reviewForm.get('artistId')?.setValue(artist.id);
  }

  // -------------------------
  // SUBMIT / DELETE
  // -------------------------
  submitReview(): void {
    if (this.isReadOnly) return;
    if (this.reviewForm.invalid) return;

    this.submitting = true;

    if (!this.selectedArtistId) {
      this.snackbar.open('Seleziona un artista.', 'Chiudi', { duration: 2500 });
      this.submitting = false;
      return;
    }

    if (this.selectedReview) {
      // update
      if (!this.canEditReview(this.selectedReview)) {
        this.snackbar.open('Modifica non consentita: tempo scaduto.', 'Chiudi', { duration: 3000 });
        this.submitting = false;
        return;
      }

      const updatedData: Partial<Review> = {
        comment: this.reviewForm.getRawValue().comment,
        rating: this.reviewForm.getRawValue().rating,
        artistId: this.selectedArtistId
      };

      this.reviewsService.updateReview(this.selectedReview.id, updatedData)
        .then(() => {
          this.snackbar.open('Recensione aggiornata.', 'Chiudi', { duration: 2500 });
          this.closeDrawer();
          this.loadData();
        })
        .finally(() => (this.submitting = false));
    } else {
      // create
      const newReview: Review = {
        id: '',
        userId: this.user.uid,
        tattooTitle: 'Altro',
        comment: this.reviewForm.getRawValue().comment,
        rating: this.reviewForm.getRawValue().rating,
        status: 'pending',
        date: Date.now(),
        artistId: this.selectedArtistId
      };

      this.reviewsService.addReview(newReview)
        .then(() => {
          this.snackbar.open('Recensione inviata! In attesa di approvazione.', 'Chiudi', { duration: 3000 });
          this.closeDrawer();
          this.loadData();
        })
        .finally(() => (this.submitting = false));
    }
  }

  deleteReview(id: string): void {
    if (!id) return;
    if (!confirm('Confermi di voler eliminare la recensione?')) return;

    this.reviewsService.deleteReview(id)
      .then(() => {
        this.snackbar.open('Recensione eliminata.', 'Chiudi', { duration: 2500 });
        this.loadData();
        // se stavi guardando quella recensione nel drawer, chiudi
        if (this.selectedReview?.id === id) this.closeDrawer();
      });
  }
}
