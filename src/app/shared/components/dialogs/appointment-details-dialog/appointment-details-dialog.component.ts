import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NativeDateModule } from '@angular/material/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Booking } from '../../../../core/services/bookings/booking.service';

@Component({
  selector: 'app-appointment-details-dialog',
  standalone:true,
  imports:[CommonModule,ReactiveFormsModule, MaterialModule,MatDatepickerModule,NativeDateModule,FullCalendarModule],
  templateUrl: './appointment-details-dialog.component.html',
  styleUrl: './appointment-details-dialog.component.scss'
})
export class AppointmentDetailsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Booking) {}

}
