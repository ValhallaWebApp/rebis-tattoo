import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-waitlist',
  standalone: true,
  templateUrl: './waitlist.component.html',
  styleUrls: ['./waitlist.component.scss'],
  imports: [CommonModule,MaterialModule,ReactiveFormsModule]
})
export class WaitlistComponent {
  waitlist = [
    {
      name: 'Mario Rossi',
      email: 'mario@email.com',
      style: 'Realistico',
      addedOn: new Date('2025-05-01')
    },
    {
      name: 'Laura Bianchi',
      email: 'laura@email.com',
      style: 'Minimal',
      addedOn: new Date('2025-05-03')
    }
  ];

  assignAppointment(index: number): void {
    const client = this.waitlist[index];
    console.log('Assegna appuntamento a:', client);
    // TODO: Apri dialog per creare appuntamento
  }

  removeFromWaitlist(index: number): void {
    this.waitlist.splice(index, 1);
  }
}
