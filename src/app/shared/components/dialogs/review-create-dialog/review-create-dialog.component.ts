import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { ReviewsService } from '../../../../core/services/reviews/rewies.service';

@Component({
  selector: 'app-review-create-dialog',
  standalone: true,
  templateUrl: './review-create-dialog.component.html',
  styleUrls: ['./review-create-dialog.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule]
})
export class ReviewCreateDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ReviewCreateDialogComponent>,
    private reviewService: ReviewsService,
    @Inject(MAT_DIALOG_DATA) public data: { userId:string,bookingId: string; tattooTitle: string; artistId: string }
  ) {
    this.form = this.fb.group({
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

submit(): void {
  if (this.form.invalid) return;

  const review = {
    ...this.form.value,
    userId: this.data?.userId,            // ✅ QUESTO è FONDAMENTALE
    tattooTitle: this.data.tattooTitle,
    bookingId: this.data.bookingId,
    artistId: this.data.artistId,
    status: 'pending',
    date: Date.now()
  };

  this.reviewService.addReview(review).then(() => {
    this.dialogRef.close(true);
  });
}


  close(): void {
    this.dialogRef.close(false);
  }
}
