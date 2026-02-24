import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { MaterialModule } from '../../../../core/modules/material.module';
import { Service, ServicesService } from '../../../../core/services/services/services.service';
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
    private dialog: MatDialog
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
        .catch((err) => console.error(err));
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
        .catch((err) => console.error(err));
    });
  }

  /* ==============
     CRUD + SNACKBAR
     ============== */

  deleteService(serviceId: string): void {
    this.serviceService
      .deleteService(serviceId)
      .catch((err) => console.error(err));
  }
}
