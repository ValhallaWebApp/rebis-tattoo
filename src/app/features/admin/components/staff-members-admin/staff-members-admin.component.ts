import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import { StaffMember, StaffService } from '../../../../core/services/staff/staff.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';
import { ConfirmDialogComponent } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import {
  StaffUpsertDialogComponent,
  StaffUpsertDialogResult,
  StaffCandidateLite,
} from './staff-upsert-dialog.component';

@Component({
  selector: 'app-staff-members-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatTooltipModule, ReactiveFormsModule],
  templateUrl: './staff-members-admin.component.html',
  styleUrl: './staff-members-admin.component.scss',
})
export class StaffMembersAdminComponent implements OnInit {
  staff: StaffMember[] = [];
  filteredStaff: StaffMember[] = [];
  staffCandidates: StaffCandidateLite[] = [];

  filterForm!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly staffService: StaffService,
    private readonly dialog: MatDialog,
    private readonly snackBar: UiFeedbackService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.initFilterForm();
    this.loadStaff();
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      name: [''],
      role: [''],
      status: [''],
    });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  loadStaff(): void {
    this.staffService.getAllStaff().subscribe((staff) => {
      this.staff = staff ?? [];
      this.applyFilters();
    });

    this.staffService.getStaffCandidates().subscribe((candidates) => {
      this.staffCandidates = (candidates ?? []) as any;
    });
  }

  applyFilters(): void {
    const { name, role, status } = this.filterForm.value;

    this.filteredStaff = (this.staff ?? []).filter((member) => {
      const matchesName = !name || member.name.toLowerCase().includes(String(name).toLowerCase());
      const matchesRole = !role || member.role === role;
      const matchesStatus =
        !status ||
        (status === 'active' && member.isActive) ||
        (status === 'inactive' && !member.isActive);

      return matchesName && matchesRole && matchesStatus;
    });
  }

  async openCreate(): Promise<void> {
    const res = await this.openUpsertDialog('create');
    if (!res) return;

    const ok = await this.confirm({
      title: 'Confermi la promozione?',
      message: 'Questo utente verra promosso a staff.',
    });
    if (!ok) return;

    this.staffService
      .addStaff(res.staff)
      .then(() => this.showSnack('Staff creato'))
      .catch((err) => {
        console.error(err);
        this.showSnack('Errore durante la creazione');
      });
  }

  async openEdit(member: StaffMember): Promise<void> {
    const res = await this.openUpsertDialog('edit', member);
    if (!res) return;

    const ok = await this.confirm({
      title: "Confermi l'aggiornamento?",
      message: 'Stai per aggiornare i dati del membro staff selezionato.',
    });
    if (!ok) return;

    const id = String(member.userId ?? member.id ?? '').trim();
    this.staffService
      .updateStaff(id, res.staff)
      .then(() => this.showSnack('Staff aggiornato'))
      .catch((err) => {
        console.error(err);
        this.showSnack("Errore durante l'aggiornamento");
      });
  }

  openDetail(member: StaffMember): void {
    const id = String(member.userId ?? member.id ?? '').trim();
    if (!id) return;
    this.router.navigate(['/admin/staff', id]);
  }

  async revoke(id: string): Promise<void> {
    if (!id) return;

    const ok = await this.confirm({
      title: 'Confermi la revoca?',
      message: 'Questo utente non sara piu staff e tornera cliente.',
    });
    if (!ok) return;

    this.staffService
      .revokeStaff(id)
      .then(() => this.showSnack('Staff revocato'))
      .catch((err) => {
        console.error(err);
        this.showSnack('Errore durante la revoca');
      });
  }

  private async openUpsertDialog(
    mode: 'create' | 'edit',
    member?: StaffMember
  ): Promise<StaffUpsertDialogResult | null> {
    const alreadyStaffIds = (this.staff ?? [])
      .map((s) => String(s.userId ?? s.id ?? '').trim())
      .filter(Boolean);

    const dialogRef = this.dialog.open<StaffUpsertDialogComponent, any, StaffUpsertDialogResult>(
      StaffUpsertDialogComponent,
      {
        width: '640px',
        maxWidth: '92vw',
        maxHeight: '80vh',
        data: {
          mode,
          staff: member,
          candidates: this.staffCandidates ?? [],
          alreadyStaffIds,
        },
      }
    );

    const res = await firstValueFrom(dialogRef.afterClosed());
    return res ?? null;
  }

  private async confirm(data: { title: string; message: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '420px',
      maxWidth: '92vw',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  private showSnack(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
