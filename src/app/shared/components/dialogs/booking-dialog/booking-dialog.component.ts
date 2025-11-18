import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BookingService, Booking } from '../../../../core/services/bookings/booking.service';
import { AuthService } from '../../../../core/services/auth/authservice';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { DynamicField, DynamicFormComponent } from '../../form/dynamic-form/dynamic-form.component';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-booking-dialog',
  templateUrl: './booking-dialog.component.html',
  styleUrls: ['./booking-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent]
})
export class BookingDialogComponent implements OnInit {
  bookingForm!: FormGroup;
  stepIndex = 0;
  staff: StaffMember[] = [];
  availableSlots: string[] = [];
  disabledDates = new Set<string>();
  processing = false;

  private readonly paymentLink = 'https://buy.stripe.com/00w28rdJU7PK9C72Pw5ZC00';

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private snackbar: MatSnackBar,
    private authService: AuthService,
    private staffService: StaffService,
    public dialogRef: MatDialogRef<BookingDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.bookingForm = this.fb.group({
      clientName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      eta: ['', Validators.required],
      description: ['', Validators.required],
      artist: [''],
      date: [null, Validators.required],
      slot: [null, Validators.required],
      confirmPayment: [false, Validators.requiredTrue],
      start: [this.data?.start || '', Validators.required],
      end: ['', Validators.required]
    });

    this.staffService.getAllStaff().subscribe(list => {
      this.staff = list.filter(s => s.isActive && s.role === 'tatuatore');
    });

    this.bookingForm.get('date')?.valueChanges.subscribe(date => {
      if (date) {
        this.bookingForm.patchValue({ slot: null }, { emitEvent: false });
        this.loadAvailableSlots(date);
      }
    });

    this.bookingForm.get('slot')?.valueChanges.subscribe(() => {
      this.updateStartEndFromSlot();
    });

    this.prefillFromUserOrLocal();
    this.populateDisabledDates();

    if (this.data?.date) {
      const d = new Date(this.data.date);
      this.bookingForm.patchValue({ date: d }, { emitEvent: false });
      this.loadAvailableSlots(d);
    }

    if (this.data?.slot) {
      this.bookingForm.patchValue({ slot: this.data.slot });
      this.updateStartEndFromSlot();
    }
  }

  get step0Fields(): any[] {
    return [
      { type: 'text', name: 'clientName', label: 'Nome Cliente', required: true },
      { type: 'email', name: 'email', label: 'Email', required: true },
      { type: 'textarea', name: 'description', label: 'Descrizione', required: true },
      {
        type: 'select',
        name: 'artist',
        label: 'Artista',
        options: this.staff.map(s => ({ label: s.name, value: s.id })),
        required: false
      },
      { type: 'date', name: 'eta', label: 'Data di Nascita', required: true }
    ];
  }

  get step1Fields(): any[] {
    return [
      { type: 'date', name: 'date', label: 'Data', required: true },
      {
        type: 'select',
        name: 'slot',
        label: 'Orario Disponibile',
        options: this.availableSlots.map(s => ({ label: s, value: s })),
        required: true
      }
    ];
  }

  get step2Fields(): any[] {
    return [
      {
        type: 'checkbox',
        name: 'confirmPayment',
        label: 'Confermo di aver effettuato il pagamento dell’acconto richiesto',
        required: true
      }
    ];
  }

  isStepValid(): boolean {
    switch (this.stepIndex) {
      case 0:
        return this.bookingForm.get('clientName')!.valid &&
               this.bookingForm.get('email')!.valid &&
               this.bookingForm.get('description')!.valid &&
               this.bookingForm.get('eta')!.valid;
      case 1:
        return this.bookingForm.get('date')!.valid &&
               this.bookingForm.get('slot')!.valid;
      case 2:
        return this.bookingForm.get('confirmPayment')!.value === true;
      default:
        return true;
    }
  }

  submitStep(): void {
    if (!this.isStepValid()) return;

    if (this.stepIndex === 2) {
      this.goToPayment();
    } else {
      this.stepIndex++;
    }
  }

  previousStep(): void {
    if (this.stepIndex > 0) this.stepIndex--;
  }

  goToPayment(): void {
    this.processing = true;
    window.open(this.paymentLink, '_blank');
    this.processing = false;
    this.stepIndex++;
  }

async onSubmit(): Promise<void> {
  if (!this.bookingForm.valid) return;

  const v = this.bookingForm.value;
  const user = this.authService.getUser(); // ✅ sostituito getCurrentUser

  if (!user?.uid) {
    this.snackbar.open('Utente non autenticato. Impossibile completare la prenotazione.', 'OK', { duration: 3000 });
    return;
  }

  const booking: Omit<Booking, 'id' | 'status'> = {
    title: `${v.start.split('T')[1]?.slice(0, 5)} ${v.description} – ${v.clientName}`,
    start: v.start,
    end: v.end,
    idClient: user.uid,
    description: v.description,
    idArtist: v.artist || '',
    price: 5000,
    createAt: new Date().toISOString(),
    updateAt: new Date().toISOString()
  };

  try {
    await this.bookingService.addDraft(booking);

    this.snackbar.open('Prenotazione salvata!', 'OK', { duration: 3000 });
    this.dialogRef.close(true);
  } catch (err) {
    console.error('Errore salvataggio:', err);
    this.snackbar.open('Errore durante il salvataggio.', 'Chiudi', { duration: 3000 });
  }
}


  updateStartEndFromSlot(): void {
    const date = this.bookingForm.get('date')?.value;
    const slot = this.bookingForm.get('slot')?.value;
    if (!date || !slot) return;

    const [h, m] = slot.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    this.bookingForm.patchValue({
      start: start.toISOString(),
      end: end.toISOString()
    });
  }

  loadAvailableSlots(date: Date): void {
    const day = date.toISOString().split('T')[0];
    const isToday = new Date().toDateString() === date.toDateString();
    const now = new Date();

    this.bookingService.getAllBookings().subscribe(list => {
      const taken = list
        .filter(b => b.start.startsWith(day))
        .map(b => b.start.substring(11, 16));

      const out: string[] = [];
      for (let h = 9; h <= 19; h++) {
        for (const m of [0, 30]) {
          const slotDate = new Date(date);
          slotDate.setHours(h, m, 0, 0);
          const slotStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          if (!(isToday && slotDate <= now) && !taken.includes(slotStr)) {
            out.push(slotStr);
          }
        }
      }
      this.availableSlots = out;
    });
  }

  populateDisabledDates(): void {
    this.bookingService.getAllBookings().subscribe(list => {
      const slotsByDay: Record<string, number> = {};
      list.forEach(b => {
        const day = b.start.split('T')[0];
        slotsByDay[day] = (slotsByDay[day] || 0) + 1;
      });
      Object.entries(slotsByDay).forEach(([day, count]) => {
        if (count >= 22) this.disabledDates.add(day);
      });
    });
  }

private prefillFromUserOrLocal(): void {
  const user = this.authService.getUser(); // ✅ sincrono

  const local = localStorage.getItem('pendingBooking');
  const parsed = local ? safeParse(local) : {};

  if (user) {
    this.bookingForm.patchValue({
      email: user.email || '',
      clientName: user.name || '',
      description: parsed.comments || '',
      artist: parsed.artist || ''
    });
  } else if (parsed) {
    this.bookingForm.patchValue({
      email: parsed.email || '',
      clientName: parsed.fullName || '',
      description: parsed.comments || '',
      artist: parsed.artist || ''
    });
  }

  function safeParse(json: string): any {
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}


  onCancel(): void {
    this.dialogRef.close(false);
  }
}
