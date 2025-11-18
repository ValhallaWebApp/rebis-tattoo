import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Timestamp } from 'firebase/firestore';
import { MaterialModule } from '../../../../core/modules/material.module';
import { ServicesService } from '../../../../core/services/services/services.service';
import { ServicesDialogAdminComponent } from '../../../../shared/components/dialogs/services-dialog-admin/services-dialog-admin.component';
import { ConfirmDialogComponent } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';

export interface Service {
  id: string;
  name: string;
  description: string;
  prezzo: number;
  durata: number; // in minuti
  categoria: string;
  visibile: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Component({
  selector: 'app-services-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './services-admin.component.html',
  styleUrl: './services-admin.component.scss',
})
export class ServicesAdminComponent implements OnInit {
  services: any[] = [];

  constructor(
    private serviceService: ServicesService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.serviceService.getServices().subscribe((services) => {
      this.services = services;
      console.log(services)
    });
  }

  addService(): void {
    const dialogRef = this.dialog.open(ServicesDialogAdminComponent, {
      data: { mode: 'create' },
    });

    dialogRef.afterClosed().subscribe((newService: Service | any) => {
      if (newService) {
        this.serviceService.addService(newService);
      }
    });
  }

  editService(service: Service): void {
    const dialogRef = this.dialog.open(ServicesDialogAdminComponent, {
      data: { mode: 'edit', service },
    });

    dialogRef.afterClosed().subscribe((updatedService: Service | any) => {
      if (updatedService) {
        this.serviceService.updateService(service.id, updatedService);
      }
    });
  }

  deleteService(serviceId: string): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Conferma Eliminazione',
        message: 'Sei sicuro di voler eliminare questo servizio?',
      },
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.serviceService.deleteService(serviceId);
      }
    });
  }
}
