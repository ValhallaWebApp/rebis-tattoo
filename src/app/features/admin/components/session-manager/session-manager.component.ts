// session-manager.component.ts
import { Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDrawer } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';
import { Session, SessionService } from '../../../../core/services/session/session.service';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';

@Component({
  selector: 'app-session-manager',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './session-manager.component.html',
  styleUrls: ['./session-manager.component.scss']
})
export class SessionManagerComponent implements OnInit {
 @ViewChild('drawer') drawer!: MatDrawer;
  projectId: string ='0';

  private sessionService = inject(SessionService);
  private staffService = inject(StaffService);
  private snackbar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  sessions: Session[] = [];
  staff: StaffMember[] = [];
  form!: FormGroup;
  editingSession: Session | null = null;

  async ngOnInit(): Promise<void> {
    this.staffService.getAllStaff().subscribe(staff => {
       this.staff = staff;
    });
    await this.loadSessions();
    this.initForm();
  }

async loadSessions() {
  if (!this.projectId) return; // evita query con undefined
  this.sessionService.getSessionsByProject(this.projectId).subscribe(session => {
    this.sessions = session;
  });
}


  initForm(session: Session | null = null) {
    this.editingSession = session;

    const startDate = session?.start ? new Date(session.start) : new Date();
    const startTime = startDate.toISOString().substring(11, 16); // HH:mm

    this.form = this.fb.group({
      date: [startDate.toISOString().substring(0, 10), Validators.required], // yyyy-MM-dd
      time: [startTime, Validators.required], // HH:mm
      duration: [session?.end ? (new Date(session.end).getTime() - new Date(session.start).getTime()) / 60000 : 60, Validators.required],
      idArtist: [session?.idArtist || '', Validators.required],
      notesByAdmin: [session?.notesByAdmin || ''],
      price: [session?.price || 0],
      status: [session?.status || 'planned', Validators.required]
    });
  }

  async save() {
  if (this.form.invalid) {
    this.snackbar.open('Compila tutti i campi obbligatori', 'Chiudi');
    return;
  }

  const { date, time, duration, ...rest } = this.form.value;

  if (!date || !time) {
    this.snackbar.open('Data e ora sono obbligatorie', 'Chiudi');
    return;
  }

  const startString = `${date}T${time}:00`;
  const start = new Date(startString);
  const durationMinutes = Number(duration);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Date parsing fallito:', { start, end, startString, date, time });
    this.snackbar.open('Data o ora non valide', 'Chiudi');
    return;
  }

  const data: Session = {
    ...rest,
    start: start.toISOString(),
    end: end.toISOString(),
    projectId: this.projectId
  };

  try {
    if (this.editingSession?.id) {
      await this.sessionService.update(this.editingSession.id, data);
      this.snackbar.open('Seduta aggiornata', 'Chiudi', { duration: 2000 });
    } else {
      await this.sessionService.create(data);
      this.snackbar.open('Seduta aggiunta', 'Chiudi', { duration: 2000 });
    }

    this.form.reset();
    this.editingSession = null;
    await this.loadSessions();
  } catch (err) {
    console.error('Errore nel salvataggio:', err);
    this.snackbar.open('Errore nel salvataggio', 'Chiudi');
  }
}

toggleDrawer() {
  if (this.drawer.opened) {
    this.closeDrawer();
  } else {
    this.drawer.open();
    this.initForm(); // Reset form se drawer aperto da zero
  }
}
closeDrawer() {
  this.drawer.close();
  this.editingSession = null;
  this.form.reset();
}

  edit(session: Session) {
    this.initForm(session);
  }
getArtistName(id: string): string {
  return this.staff.find(a => a.id === id)?.name || 'Artista';
}

  async delete(session: Session) {
    if (confirm('Confermi la cancellazione della seduta?')) {
      await this.sessionService.delete(session.id!);
      this.snackbar.open('Seduta eliminata', 'Chiudi', { duration: 2000 });
      await this.loadSessions();
    }
  }


}
