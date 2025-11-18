import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

@Component({
  selector: 'app-documents',
  standalone: true,
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
  imports: [CommonModule,MaterialModule,ReactiveFormsModule]
})
export class DocumentsComponent {
  documents = [
    {
      title: 'Informativa Privacy',
      description: 'Dettagli sul trattamento dei dati personali.',
      fileUrl: '/assets/documents/privacy-policy.pdf'
    },
    {
      title: 'Termini di Servizio',
      description: 'Condizioni di utilizzo del servizio Rebis.',
      fileUrl: '/assets/documents/termini-servizio.pdf'
    },
    {
      title: 'Modulo Consenso Tatuaggio',
      description: 'Consenso informato da compilare prima della seduta.',
      fileUrl: '/assets/documents/consenso-tatuaggio.pdf'
    }
  ];
}
