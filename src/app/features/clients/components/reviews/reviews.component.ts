import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDrawer } from '@angular/material/sidenav';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MaterialModule } from '../../../../core/modules/material.module';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { Review, ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { StaffService } from '../../../../core/services/staff/staff.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | string;

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackbar = inject(UiFeedbackService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly staffService = inject(StaffService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('reviewDrawer') reviewDrawer!: MatDrawer;

  user: any;
  reviews: Review[] = [];
  artists: any[] = [];

  filterStatusCtrl = this.fb.control<'all' | 'pending' | 'approved' | 'rejected'>('all');
  readonly statusFilterForm = this.fb.group({
    filterStatusCtrl: this.filterStatusCtrl
  });
  readonly statusFilterFields: DynamicField[] = [
    {
      type: 'select',
      name: 'filterStatusCtrl',
      label: 'Stato',
      options: [
        { label: 'Tutti', value: 'all' },
        { label: 'In attesa', value: 'pending' },
        { label: 'Pubblicate', value: 'approved' },
        { label: 'Rifiutate', value: 'rejected' }
      ]
    }
  ];

  reviewForm!: FormGroup;
  reviewFields: DynamicField[] = [];

  selectedReview: Review | null = null;
  submitting = false;
  isReadOnly = false;

  readonly _loadUserEffect = effect(() => {
    const u = this.auth.userSig();
    if (!u?.uid) return;
    this.user = u;
    this.loadData();
  });

  ngOnInit(): void {
    this.reviewForm = this.fb.group({
      author: [{ value: '', disabled: true }, Validators.required],
      comment: ['', [Validators.required, Validators.minLength(10)]],
      rating: [5, Validators.required],
      artistId: ['', Validators.required]
    });

    this.updateReviewFields();
  }

  private loadData(): void {
    if (!this.user?.uid) return;

    this.reviewForm.get('author')?.setValue(this.user?.name || this.user?.email || '');

    this.reviewsService.getReviewsByUser(this.user.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.reviews = (list ?? []).slice().sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
      });

    this.staffService.getAllStaff()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((staff) => {
        this.artists = staff ?? [];
        this.updateReviewFields();
      });
  }

  filteredReviews(): Review[] {
    const status = this.filterStatusCtrl.value;
    if (!status || status === 'all') return this.reviews;
    return this.reviews.filter((r) => r.status === status);
  }

  getArtistNameById(id: string | undefined): string {
    if (!id) return 'Artista';
    const artist = this.artists.find((x) => x.id === id);
    return artist?.name || 'Artista';
  }

  getArtistPhotoById(id: string | undefined): string {
    if (!id) return 'https://i.pravatar.cc/300?img=1';
    const artist = this.artists.find((x) => x.id === id);
    return artist?.photoUrl || 'https://i.pravatar.cc/300?img=1';
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

  openCreate(): void {
    if (!this.reviewDrawer) return;

    this.selectedReview = null;
    this.isReadOnly = false;
    this.submitting = false;

    this.reviewForm.enable();
    this.reviewForm.reset({
      author: this.user?.name || this.user?.email || '',
      comment: '',
      rating: 5,
      artistId: ''
    });

    this.reviewDrawer.open();
  }

  closeDrawer(): void {
    this.reviewDrawer.close();
    this.isReadOnly = false;
    this.reviewForm.enable();
    this.selectedReview = null;
    this.submitting = false;
  }

  viewReview(review: Review): void {
    this.selectedReview = review;
    this.isReadOnly = true;

    this.reviewForm.reset({
      author: this.user?.name || this.user?.email || '',
      comment: review.comment ?? '',
      rating: review.rating ?? 5,
      artistId: review.artistId ?? ''
    });

    this.reviewForm.disable();
    this.reviewDrawer.open();
  }

  editReview(review: Review): void {
    this.selectedReview = review;
    this.isReadOnly = false;

    this.reviewForm.enable();
    this.reviewForm.patchValue({
      author: this.user?.name || this.user?.email || '',
      comment: review.comment ?? '',
      rating: review.rating ?? 5,
      artistId: review.artistId ?? ''
    });

    this.reviewDrawer.open();
  }

  submitReview(): void {
    if (this.isReadOnly) return;
    if (this.reviewForm.invalid) return;

    const artistId = String(this.reviewForm.getRawValue().artistId ?? '').trim();
    if (!artistId) {
      this.snackbar.open('Seleziona un artista.', 'Chiudi', { duration: 2500 });
      return;
    }

    this.submitting = true;

    if (this.selectedReview) {
      if (!this.canEditReview(this.selectedReview)) {
        this.snackbar.open('Modifica non consentita: tempo scaduto.', 'Chiudi', { duration: 3000 });
        this.submitting = false;
        return;
      }

      const updatedData: Partial<Review> = {
        comment: this.reviewForm.getRawValue().comment,
        rating: this.reviewForm.getRawValue().rating,
        artistId
      };

      this.reviewsService.updateReview(this.selectedReview.id, updatedData)
        .then(() => {
          this.snackbar.open('Recensione aggiornata.', 'Chiudi', { duration: 2500 });
          this.closeDrawer();
          this.loadData();
        })
        .finally(() => (this.submitting = false));

      return;
    }

    const newReview: Review = {
      id: '',
      userId: this.user.uid,
      tattooTitle: 'Altro',
      comment: this.reviewForm.getRawValue().comment,
      rating: this.reviewForm.getRawValue().rating,
      status: 'pending',
      date: Date.now(),
      artistId
    };

    this.reviewsService.addReview(newReview)
      .then(() => {
        this.snackbar.open('Recensione inviata! In attesa di approvazione.', 'Chiudi', { duration: 3000 });
        this.closeDrawer();
        this.loadData();
      })
      .finally(() => (this.submitting = false));
  }

  deleteReview(id: string): void {
    if (!id) return;
    if (!confirm('Confermi di voler eliminare la recensione?')) return;

    this.reviewsService.deleteReview(id)
      .then(() => {
        this.snackbar.open('Recensione eliminata.', 'Chiudi', { duration: 2500 });
        this.loadData();
        if (this.selectedReview?.id === id) this.closeDrawer();
      });
  }

  private updateReviewFields(): void {
    this.reviewFields = [
      {
        type: 'autocomplete',
        name: 'artistId',
        label: 'Artista',
        required: true,
        options: this.artists.map((artist) => ({
          label: String(artist?.name ?? 'Artista'),
          value: String(artist?.id ?? '')
        }))
      },
      {
        type: 'textarea',
        name: 'comment',
        label: 'Commento',
        rows: 4,
        className: 'full',
        minLength: 10,
        required: true
      },
      {
        type: 'select',
        name: 'rating',
        label: 'Valutazione',
        required: true,
        options: [
          { label: '1 stella', value: 1 },
          { label: '2 stelle', value: 2 },
          { label: '3 stelle', value: 3 },
          { label: '4 stelle', value: 4 },
          { label: '5 stelle', value: 5 }
        ]
      }
    ];
  }
}
