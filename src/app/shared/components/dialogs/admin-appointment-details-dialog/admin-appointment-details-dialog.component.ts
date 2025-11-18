// appointment-details-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { BookingDialogComponent } from '../booking-dialog/booking-dialog.component';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Booking, BookingService } from '../../../../core/services/bookings/booking.service';

@Component({
  selector: 'app-admin-appointment-details-dialog',
  standalone:true,
  imports:[CommonModule,MaterialModule,ReactiveFormsModule],
  templateUrl: './admin-appointment-details-dialog.component.html',
  styleUrls: ['./admin-appointment-details-dialog.component.scss']
})
export class AdminAppointmentDetailsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Booking,
    private dialogRef: MatDialogRef<AdminAppointmentDetailsDialogComponent>,
    private bookingService: BookingService,
    private dialog: MatDialog
  ) {}
  // | 'draft'            // anagrafica compilata, nessun pagamento creato
  // | 'awaiting_payment' // Payment Intent creato, in attesa
  // | 'paid'             // acconto versato
  // | 'completed'        // sessione terminata
  // | 'cancelled';

  confirmBooking(): void {
    if (this.data.id) {
      this.bookingService.updateBooking(this.data.id, { status: 'completed' }).then(() => {
        this.dialogRef.close(true);
      });
    }
  }

  cancelBooking(): void {
    if (this.data.id) {
      this.bookingService.updateBooking(this.data.id, { status: 'cancelled' }).then(() => {
        this.dialogRef.close(true);
      });
    }
  }

  editBooking(): void {
    this.dialogRef.close();
    this.dialog.open(BookingDialogComponent, {
      width: '400px',
      data: { booking: this.data }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
