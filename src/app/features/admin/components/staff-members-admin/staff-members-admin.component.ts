import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { StaffDialogAdminComponent } from '../../../../shared/components/dialogs/staff-dialog-admin/staff-dialog-admin.component';
import { MatDrawer } from '@angular/material/sidenav';

@Component({
  selector: 'app-staff-members-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './staff-members-admin.component.html',
  styleUrl: './staff-members-admin.component.scss'
})
export class StaffMembersAdminComponent implements OnInit {
  staff: StaffMember[] = [];
  staffForm!: FormGroup;
  editingId: string | null = null;
  imagePreview: any  = '';
  @ViewChild('drawer') drawer!: MatDrawer;

  constructor(
    private fb: FormBuilder,
    private staffService: StaffService,
    private dialog:MatDialog
  ) {}

  ngOnInit(): void {
    this.loadStaff();
    this.initForm();
  }

toggleDrawer(): void {
  if (this.drawer.opened) {
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

  loadStaff(): void {
    this.staffService.getAllStaff().subscribe(staff => {
      this.staff = staff;
    });
  }

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
  create(){
    this.openStaffDialog('create')
  }

  delete(id: string): void {
    if (confirm("Confermi l'eliminazione del membro?")) {
      this.staffService.deleteStaff(id);
    }
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
        width:'400px'
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

}
