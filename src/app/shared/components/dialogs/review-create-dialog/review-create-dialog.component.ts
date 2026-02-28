import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';
import { ReviewsService } from '../../../../core/services/reviews/reviews.service';
import { DynamicField, DynamicFormComponent } from '../../form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-review-create-dialog',
  standalone: true,
  templateUrl: './review-create-dialog.component.html',
  styleUrls: ['./review-create-dialog.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent]
})
export class ReviewCreateDialogComponent {
  form: FormGroup;
  readonly fields: DynamicField[] = [
    { type: 'textarea', name: 'comment', label: 'Commento', rows: 4, required: true, minLength: 10, className: 'full-width' },
    {
      type: 'button-toggle',
      name: 'rating',
      label: 'Valutazione',
      required: true,
      className: 'full-width',
      options: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
        { label: '5', value: 5 }
      ]
    }
  ];

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

