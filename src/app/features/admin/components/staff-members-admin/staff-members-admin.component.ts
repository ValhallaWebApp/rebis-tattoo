import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { StaffDialogAdminComponent } from '../../../../shared/components/dialogs/staff-dialog-admin/staff-dialog-admin.component';
import { MatDrawer } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-staff-members-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTooltipModule, ReactiveFormsModule],
  templateUrl: './staff-members-admin.component.html',
  styleUrl: './staff-members-admin.component.scss'
})
export class StaffMembersAdminComponent implements OnInit {
  staff: StaffMember[] = [];
  filteredStaff: StaffMember[] = [];
  staffCandidates: Array<{ id: string; name: string; email?: string; phone?: string }> = [];

  staffForm!: FormGroup;
  filterForm!: FormGroup;

  editingId: string | null = null;
  imagePreview: any = '';

  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(
    private fb: FormBuilder,
    private staffService: StaffService,
    private dialog: MatDialog,
    private snackBar: UiFeedbackService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initFilterForm();
    this.loadStaff();
  }

  toggleDrawer(): void {
    if (this.drawer?.opened) {
      this.drawer.close();
      this.resetForm();
      this.editingId = null;
      return;
    }
    this.drawer.open();
  }

  edit(member: StaffMember): void {
    this.drawer.open();
    this.editingId = member.id!;
    this.staffForm.patchValue({
      userId: member.userId ?? member.id ?? '',
      name: member.name,
      role: member.role,
      bio: member.bio ?? '',
      photoUrl: member.photoUrl ?? '',
      isActive: member.isActive ?? true,
      email: member.email ?? '',
      phone: member.phone ?? ''
    });
    this.imagePreview = member.photoUrl;
  }

  initForm(): void {
    this.staffForm = this.fb.group({
      userId: [''],
      name: ['', Validators.required],
      role: ['tatuatore', Validators.required],
      bio: [''],
      photoUrl: [''],
      isActive: [true],
      email: [''],
      phone: ['']
    });

    this.staffForm.get('photoUrl')?.valueChanges.subscribe(value => {
      this.imagePreview = value;
    });

    this.staffForm.get('userId')?.valueChanges.subscribe((uid) => {
      if (this.editingId) return;
      const selected = this.staffCandidates.find(c => c.id === uid);
      if (!selected) return;
      this.staffForm.patchValue(
        {
          name: selected.name || '',
          email: selected.email || '',
          phone: selected.phone || ''
        },
        { emitEvent: false }
      );
    });
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      name: [''],
      role: [''],
      status: ['']
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  loadStaff(): void {
    this.staffService.getAllStaff().subscribe(staff => {
      this.staff = staff;
      this.applyFilters();
    });

    this.staffService.getStaffCandidates().subscribe(candidates => {
      this.staffCandidates = candidates ?? [];
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

  submit(): void {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      this.showSnack('Compila i campi obbligatori');
      return;
    }

    const data: StaffMember = this.staffForm.value;
    if (!this.editingId && !String(data.userId ?? '').trim()) {
      this.showSnack('Seleziona un utente da promuovere a staff');
      return;
    }

    if (this.editingId) {
      this.staffService.updateStaff(this.editingId, data)
        .then(() => this.cancel())
        .catch((err) => {
          console.error(err);
          this.showSnack('Errore durante l\'aggiornamento');
        });
    } else {
      this.staffService.addStaff(data)
        .then(() => this.resetForm())
        .catch((err) => {
          console.error(err);
          this.showSnack('Errore durante la creazione');
        });
    }
  }

  create(): void {
    this.openStaffDialog('create');
  }

  delete(id: string): void {
    if (!id) return;

    const conferma = confirm('Confermi la disattivazione di questo membro?');
    if (!conferma) return;

    this.staffService.deleteStaff(id)
      .then(() => {
        this.showSnack('Membro disattivato');
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
      userId: '',
      name: '',
      role: 'tatuatore',
      bio: '',
      photoUrl: '',
      isActive: true,
      email: '',
      phone: ''
    });
    this.editingId = null;
    this.imagePreview = '';
  }

  openAgenda(member: StaffMember): void {
    console.log('Apri agenda per', member);
  }

  contactStaff(member: StaffMember): void {
    console.log('Apri chat con', member);
  }

  private showSnack(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
  }
}
