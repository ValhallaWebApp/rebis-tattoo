import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment-confirmation-dialog',
  standalone: true,
  imports: [CommonModule,MaterialModule,ReactiveFormsModule],
  templateUrl: './payment-confirmation-dialog.component.html',
  styleUrl: './payment-confirmation-dialog.component.scss'
})
export class PaymentConfirmationDialogComponent {
  step = 1;
  constructor(
    public dialogRef: MatDialogRef<PaymentConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { date: string; time: string; artist: string; email: string }
  ) {}

  next() { this.step = 2; }
  back() { this.step = 1; }
  confirm() { this.dialogRef.close('confirmed'); }
  cancel() { this.dialogRef.close(null); }
}
