import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

import { MaterialModule } from '../../../../core/modules/material.module';
import { Service, ServicesService } from '../../../../core/services/services/services.service';
import { ConfirmDialogComponent } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ServiceEditorDialogComponent, ServiceEditorDialogData } from './service-editor-dialog/service-editor-dialog.component';


@Component({
  selector: 'app-services-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule,MatTooltipModule],
  templateUrl: './services-admin.component.html',
  styleUrl: './services-admin.component.scss',
})
export class ServicesAdminComponent implements OnInit {
  services: Service[] = [];
  filteredServices: Service[] = [];

  filterForm!: FormGroup;

  editingId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private serviceService: ServicesService,
    private dialog: MatDialog,
    private snackBar: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.initFilterForm();
    this.loadServices();
  }

  private initFilterForm(): void {
    this.filterForm = this.fb.group({
      name: [''],
      categoria: [''],
      visibile: [''],
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  /* ==============
     DATA
     ============== */

  private loadServices(): void {
    this.serviceService.getServices().subscribe({
      next: (services: Service[]) => {
        this.services = services;
        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.showSnack('Errore nel caricamento dei servizi');
      },
    });
  }

  applyFilters(): void {
    const { name, categoria, visibile } = this.filterForm.value;

    this.filteredServices = this.services.filter((s) => {
      const matchesName =
        !name || s.name.toLowerCase().includes(name.toLowerCase());

      const matchesCategoria =
        !categoria || s.categoria === categoria;

      const matchesVisibile =
        visibile === '' ||
        (visibile === 'true' && s.visibile) ||
        (visibile === 'false' && !s.visibile);

      return matchesName && matchesCategoria && matchesVisibile;
    });
  }

  /* ==============
     UI / DRAWER
     ============== */

  openCreate(): void {
    const data: ServiceEditorDialogData = { mode: 'create' };
    const ref = this.dialog.open(ServiceEditorDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'service-editor-dialog',
      data
    });
    ref.afterClosed().subscribe((result: Partial<Service> | null) => {
      if (!result) return;
      this.serviceService.addService(result as any)
        .then(() => this.showSnack('Nuovo servizio creato'))
        .catch(() => this.showSnack('Errore durante la creazione'));
    });
  }

  openEdit(service: Service): void {
    const data: ServiceEditorDialogData = { mode: 'edit', service };
    const ref = this.dialog.open(ServiceEditorDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'service-editor-dialog',
      data
    });
    ref.afterClosed().subscribe((result: Partial<Service> | null) => {
      if (!result) return;
      this.serviceService.updateService(service.id, result)
        .then(() => this.showSnack('Servizio aggiornato correttamente'))
        .catch(() => this.showSnack('Errore durante l\'aggiornamento'));
    });
  }

  /* ==============
     CRUD + SNACKBAR
     ============== */

  deleteService(serviceId: string): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Conferma eliminazione',
        message: 'Sei sicuro di voler eliminare questo servizio?',
      },
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.serviceService
          .deleteService(serviceId)
          .then(() => this.showSnack('Servizio eliminato'))
          .catch((err) => {
            console.error(err);
            this.showSnack('Errore durante l\'eliminazione');
          });
      }
    });
  }

  /* ==============
     SNACKBAR
     ============== */
  private showSnack(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
