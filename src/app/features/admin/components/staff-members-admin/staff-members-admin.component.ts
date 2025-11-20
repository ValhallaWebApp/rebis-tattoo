import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { StaffDialogAdminComponent } from '../../../../shared/components/dialogs/staff-dialog-admin/staff-dialog-admin.component';
import { MatDrawer } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-staff-members-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule,MatTooltipModule, ReactiveFormsModule,MatSnackBarModule],
  templateUrl: './staff-members-admin.component.html',
  styleUrl: './staff-members-admin.component.scss'
})
export class StaffMembersAdminComponent implements OnInit {
  staff: StaffMember[] = [];
  filteredStaff: StaffMember[] = [];

  staffForm!: FormGroup;
  filterForm!: FormGroup;

  editingId: string | null = null;
  imagePreview: any  = '';

  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(
    private fb: FormBuilder,
    private staffService: StaffService,
    private dialog: MatDialog,
    private snackBar:MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initFilterForm();
    this.loadStaff();
  }

  // ---- UI / DRAWER ----
  toggleDrawer(): void {
    if (this.drawer?.opened) {
      this.drawer.close();
      this.resetForm();
      this.editingId = null;
    } else {
      this.drawer.open();
    }
  }

  edit(member: StaffMember): void {
    this.drawer.open();
    this.editingId = member.id!;
    this.staffForm.patchValue(member);
    this.imagePreview = member.photoUrl;
  }

  // ---- FORM PRINCIPALE ----
  initForm(): void {
    this.staffForm = this.fb.group({
      name: ['', Validators.required],
      role: ['tatuatore', Validators.required],
      bio: [''],
      photoUrl: [''],
      isActive: [true]
    });

    this.staffForm.get('photoUrl')?.valueChanges.subscribe(value => {
      this.imagePreview = value;
    });
  }

  // ---- FORM FILTRI ----
  initFilterForm(): void {
    this.filterForm = this.fb.group({
      name: [''],
      role: [''],
      status: ['']
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  // ---- DATA ----
  loadStaff(): void {
    this.staffService.getAllStaff().subscribe(staff => {
      this.staff = staff;
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const { name, role, status } = this.filterForm.value;

    this.filteredStaff = this.staff.filter(member => {
      const matchesName =
        !name ||
        member.name.toLowerCase().includes(name.toLowerCase());

      const matchesRole =
        !role || member.role === role;

      const matchesStatus =
        !status ||
        (status === 'active' && member.isActive) ||
        (status === 'inactive' && !member.isActive);

      return matchesName && matchesRole && matchesStatus;
    });
  }

  // ---- CRUD ----
  submit(): void {
    const data: StaffMember = this.staffForm.value;

    if (this.editingId) {
      this.staffService.updateStaff(this.editingId, data).then(() => {
        this.cancel();
      });
    } else {
      this.staffService.addStaff(data).then(() => {
        this.resetForm();
      });
    }
  }

  create(): void {
    this.openStaffDialog('create');
  }

  delete(id: string): void {
    if (!id) {
      return;
    }

    const conferma = confirm('Confermi l\'eliminazione di questo membro?');
    if (!conferma) {
      return;
    }

    this.staffService.deleteStaff(id)
      .then(() => {
        this.showSnack('Membro eliminato');
      })
      .catch((err) => {
        console.error(err);
        this.showSnack('Errore durante l\'eliminazione');
      });
  }

  cancel(): void {
    this.editingId = null;
    this.resetForm();
  }

  openStaffDialog(mode: 'create' | 'edit', member?: StaffMember): void {
    const dialogRef = this.dialog.open(StaffDialogAdminComponent, {
      data: {
        mode,
        staff: member
      },
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((result: StaffMember | undefined) => {
      if (result) {
        if (mode === 'create') {
          this.staffService.addStaff(result);
        } else if (mode === 'edit' && member?.id) {
          this.staffService.updateStaff(member.id, result);
        }
      }
    });
  }

  resetForm(): void {
    this.staffForm.reset({
      name: '',
      role: 'tatuatore',
      bio: '',
      photoUrl: '',
      isActive: true
    });
    this.editingId = null;
    this.imagePreview = '';
  }

  // ---- AZIONI MOCK (come in clients-list) ----
  openAgenda(member: StaffMember): void {
    console.log('Apri agenda per', member);
    // TODO: navigazione alla day/week view filtrata su questo artista
  }

  contactStaff(member: StaffMember): void {
    console.log('Apri chat con', member);
    // TODO: apri chat / chatbot con staff pre-selezionato
  }
    private showSnack(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }
}
