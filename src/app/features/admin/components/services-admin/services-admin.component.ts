import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDrawer } from '@angular/material/sidenav';
import { Timestamp } from 'firebase/firestore';

import { MaterialModule } from '../../../../core/modules/material.module';
import { Service, ServicesService } from '../../../../core/services/services/services.service';
import { ConfirmDialogComponent } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';


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

  serviceForm!: FormGroup;
  filterForm!: FormGroup;

  editingId: string | null = null;

  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(
    private fb: FormBuilder,
    private serviceService: ServicesService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initFilterForm();
    this.loadServices();
  }

  /* ==============
     INIT FORM
     ============== */

  private initForm(): void {
    this.serviceForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      prezzo: [0, [Validators.required, Validators.min(0)]],
      durata: [0, [Validators.required, Validators.min(0)]],
      categoria: ['tatuaggio', Validators.required],
      visibile: [true],
    });
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

  toggleDrawer(): void {
    if (this.drawer?.opened) {
      this.cancel();
    } else {
      this.drawer.open();
    }
  }

  edit(service: Service): void {
    this.editingId = service.id;
    this.serviceForm.patchValue(service);
    this.drawer.open();
  }

  cancel(): void {
    this.editingId = null;
    this.resetForm();
    if (this.drawer?.opened) {
      this.drawer.close();
    }
  }

  resetForm(): void {
    this.serviceForm.reset({
      name: '',
      description: '',
      prezzo: 0,
      durata: 0,
      categoria: 'tatuaggio',
      visibile: true,
    });
  }

  /* ==============
     CRUD + SNACKBAR
     ============== */

  submit(): void {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      this.showSnack('Compila correttamente i campi obbligatori');
      return;
    }

    const data: Service = this.serviceForm.value;

    if (this.editingId) {
      // UPDATE
      this.serviceService.updateService(this.editingId, data)
        .then(() => {
          this.showSnack('Servizio aggiornato correttamente');
          this.cancel();
        })
        .catch((err) => {
          console.error(err);
          this.showSnack('Errore durante l\'aggiornamento');
        });
    } else {
      // CREATE
      this.serviceService.addService(data)
        .then(() => {
          this.showSnack('Nuovo servizio creato');
          this.resetForm();
        })
        .catch((err) => {
          console.error(err);
          this.showSnack('Errore durante la creazione');
        });
    }
  }

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
