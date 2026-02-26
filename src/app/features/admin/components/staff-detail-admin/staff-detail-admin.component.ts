import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../../../core/modules/material.module';
import {
  StaffAvailability,
  StaffCalendarSettings,
  StaffMember,
  StaffService,
  WeekdayKey,
  StaffTimeSlot,
} from '../../../../core/services/staff/staff.service';
import { DynamicField, DynamicFormComponent } from '../../../../shared/components/form/dynamic-form/dynamic-form.component';

@Component({
  selector: 'app-staff-detail-admin',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule, DynamicFormComponent],
  templateUrl: './staff-detail-admin.component.html',
  styleUrls: ['./staff-detail-admin.component.scss'],
})
export class StaffDetailAdminComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly staffService = inject(StaffService);
  private readonly fb = inject(FormBuilder);

  private readonly sub = new Subscription();

  staffId = '';
  member: StaffMember | null = null;

  readonly calendarForm = this.fb.nonNullable.group({
    enabled: this.fb.nonNullable.control(true),
    color: this.fb.nonNullable.control('#be9045'),
    workdayStart: this.fb.nonNullable.control('08:00', [Validators.required]),
    workdayEnd: this.fb.nonNullable.control('20:00', [Validators.required]),
    stepMinutes: this.fb.nonNullable.control(30, [Validators.required, Validators.min(5)]),
  });
  readonly calendarFields: DynamicField[] = [
    { type: 'toggle', name: 'enabled', label: 'Abilitato', className: 'full' },
    { type: 'color', name: 'color', label: 'Colore' },
    { type: 'time', name: 'workdayStart', label: 'Inizio giornata', required: true },
    { type: 'time', name: 'workdayEnd', label: 'Fine giornata', required: true },
    { type: 'number', name: 'stepMinutes', label: 'Step (min)', min: 5, required: true }
  ];

  availability: StaffAvailability = {
    timezone: 'Europe/Rome',
    week: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  };

  readonly days: Array<{ key: WeekdayKey; label: string }> = [
    { key: 'mon', label: 'Lunedi' },
    { key: 'tue', label: 'Martedi' },
    { key: 'wed', label: 'Mercoledi' },
    { key: 'thu', label: 'Giovedi' },
    { key: 'fri', label: 'Venerdi' },
    { key: 'sat', label: 'Sabato' },
    { key: 'sun', label: 'Domenica' },
  ];

  ngOnInit(): void {
    this.sub.add(
      this.route.paramMap.subscribe((pm) => {
        const id = String(pm.get('id') ?? '').trim();
        if (!id) return;
        this.staffId = id;
        this.bindData();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  back(): void {
    this.router.navigate(['/admin/staff']);
  }

  private bindData(): void {
    if (!this.staffId) return;

    // live staff snapshot (via getAllStaff)
    this.sub.add(
      this.staffService.getAllStaff().subscribe((list) => {
        this.member = (list ?? []).find((s) => String(s.userId ?? s.id ?? '') === this.staffId) ?? null;
      })
    );

    this.sub.add(
      this.staffService.getCalendarSettings(this.staffId).subscribe((cal) => {
        const v: StaffCalendarSettings = cal ?? {};
        this.calendarForm.patchValue(
          {
            enabled: v.enabled !== false,
            color: String(v.color ?? '#be9045'),
            workdayStart: String(v.workdayStart ?? '08:00'),
            workdayEnd: String(v.workdayEnd ?? '20:00'),
            stepMinutes: Number(v.stepMinutes ?? 30),
          },
          { emitEvent: false }
        );
      })
    );

    this.sub.add(
      this.staffService.getAvailability(this.staffId).subscribe((a) => {
        this.availability = a ?? {
          timezone: 'Europe/Rome',
          week: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        };
      })
    );
  }

  async saveCalendar(): Promise<void> {
    if (!this.staffId) return;
    if (this.calendarForm.invalid) {
      this.calendarForm.markAllAsTouched();
      return;
    }

    const v = this.calendarForm.getRawValue();
    const patch: StaffCalendarSettings = {
      enabled: v.enabled === true,
      color: String(v.color ?? '').trim() || '#be9045',
      workdayStart: v.workdayStart,
      workdayEnd: v.workdayEnd,
      stepMinutes: Number(v.stepMinutes ?? 30),
    };

    this.staffService
      .updateCalendarSettings(this.staffId, patch)
      .catch((e) => {
        console.error(e);
      });
  }

  addSlot(day: WeekdayKey): void {
    this.availability.week[day] = [...(this.availability.week[day] ?? []), { start: '09:00', end: '13:00' }];
  }

  removeSlot(day: WeekdayKey, idx: number): void {
    const cur = this.availability.week[day] ?? [];
    this.availability.week[day] = cur.filter((_, i) => i !== idx);
  }

  patchSlot(day: WeekdayKey, idx: number, patch: Partial<StaffTimeSlot>): void {
    const cur = [...(this.availability.week[day] ?? [])];
    const row = { ...(cur[idx] ?? { start: '09:00', end: '13:00' }), ...patch };
    cur[idx] = row;
    this.availability.week[day] = cur;
  }

  async saveAvailability(): Promise<void> {
    if (!this.staffId) return;

    this.staffService
      .setAvailability(this.staffId, this.availability)
      .catch((e) => {
        console.error(e);
      });
  }
}
