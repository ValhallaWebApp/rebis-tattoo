import { Injectable } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { CreateDraft, UiCalendarEvent, UpdatePatch } from '../../models';
import { EventDrawerHelper } from './event-drawer.helper';
import { BookingLite, ClientLite, DrawerDraft, ProjectLite, UiEventType } from './event-drawer.types';

@Injectable({ providedIn: 'root' })
export class EventDrawerFormService {
  createForm(fb: FormBuilder) {
    return fb.nonNullable.group({
      type: fb.nonNullable.control<UiEventType>('booking', Validators.required),
      artistId: fb.nonNullable.control('', Validators.required),
      day: fb.control<Date | null>(new Date(), Validators.required),
      time: fb.nonNullable.control('10:00', Validators.required),
      durationMinutes: fb.nonNullable.control(60, [Validators.required, Validators.min(15)]),
      status: fb.nonNullable.control('draft', Validators.required),
      clientId: fb.nonNullable.control(''),
      clientQuery: fb.control<ClientLite | string>(''),
      projectId: fb.nonNullable.control(''),
      projectQuery: fb.control<ProjectLite | string>(''),
      bookingId: fb.nonNullable.control(''),
      bookingQuery: fb.control<BookingLite | string>(''),
      zone: fb.nonNullable.control(''),
      notes: fb.nonNullable.control(''),
      sessionNumber: fb.control<number | null>(null),
      painLevel: fb.control<number | null>(null),
      notesByAdmin: fb.nonNullable.control(''),
      healingNotes: fb.nonNullable.control(''),
      paidAmount: fb.control<number | null>(null)
    });
  }

  recomputeDisabledState(
    form: any,
    args: {
      lockSchedule: boolean;
      lockAssignment: boolean;
      lockProjectSelection: boolean;
      artistId: string;
      lockSessionNumber: boolean;
    }
  ): void {
    const lockTime = args.lockSchedule || !String(args.artistId ?? '').trim();
    this.setDisabled(form.controls.artistId, args.lockAssignment);
    this.setDisabled(form.controls.day, args.lockSchedule);
    this.setDisabled(form.controls.time, lockTime);
    this.setDisabled(form.controls.durationMinutes, args.lockSchedule);
    this.setDisabled(form.controls.projectQuery, args.lockProjectSelection);
    this.setDisabled(form.controls.bookingQuery, args.lockAssignment);
    this.setDisabled(form.controls.sessionNumber, args.lockSessionNumber);
  }

  patchFromInitial(form: any, value: Partial<DrawerDraft>, clients: ClientLite[], projects: ProjectLite[], bookings: BookingLite[]): void {
    let day: Date | null = null;
    let time = '10:00';

    if (value.start) {
      const parsed = new Date(value.start);
      if (!isNaN(parsed.getTime())) {
        day = parsed;
        time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
      }
    }

    form.patchValue({
      type: (value.type ?? 'booking') as UiEventType,
      artistId: value.artistId ?? '',
      day: day ?? new Date(),
      time,
      durationMinutes: value.durationMinutes ?? value.duration ?? 60,
      status: value.status ?? (value.type === 'session' ? 'planned' : 'draft'),
      clientId: value.clientId ?? '',
      projectId: value.projectId ?? '',
      bookingId: value.bookingId ?? '',
      zone: value.zone ?? '',
      notes: value.notes ?? value.notesByAdmin ?? '',
      sessionNumber: value.sessionNumber ?? null,
      painLevel: (value.painLevel ?? (value as any).pain) ?? null,
      notesByAdmin: value.notesByAdmin ?? value.notes ?? '',
      healingNotes: value.healingNotes ?? (value as any).healingNote ?? '',
      paidAmount: (value as any).paidAmount ?? null
    });

    if (value.type === 'session') {
      const sessionNumber = value.sessionNumber == null || Number.isNaN(Number(value.sessionNumber))
        ? 1
        : Number(value.sessionNumber);
      form.controls.sessionNumber.setValue(sessionNumber, { emitEvent: false });
    }

    if (value.clientId) {
      const client = EventDrawerHelper.findByAnyId(clients ?? [], String(value.clientId));
      if (client) {
        form.controls.clientQuery.setValue(client, { emitEvent: false });
      } else {
        form.controls.clientQuery.setValue(
          EventDrawerHelper.getClientReadableLabel(clients ?? [], String(value.clientId), (value as any).title),
          { emitEvent: false }
        );
      }
    }

    if (value.projectId) {
      const project = EventDrawerHelper.findByAnyId(projects ?? [], String(value.projectId));
      if (project) form.controls.projectQuery.setValue(project, { emitEvent: false });
      else form.controls.projectQuery.setValue(String(value.projectId), { emitEvent: false });
    }

    if (value.bookingId) {
      const booking = EventDrawerHelper.findByAnyId(bookings ?? [], String(value.bookingId));
      if (booking) form.controls.bookingQuery.setValue(booking, { emitEvent: false });
      else form.controls.bookingQuery.setValue(String(value.bookingId), { emitEvent: false });
    }
  }

  hydrateClientQueryFromId(form: any, clients: ClientLite[]): void {
    const clientId = String(form.controls.clientId.value ?? '').trim();
    if (!clientId) return;
    const current = form.controls.clientQuery.value;
    if (current && typeof current !== 'string') return;
    const client = EventDrawerHelper.findByAnyId(clients ?? [], clientId);
    if (client) form.controls.clientQuery.setValue(client, { emitEvent: false });
    else form.controls.clientQuery.setValue(EventDrawerHelper.getClientReadableLabel(clients ?? [], clientId), { emitEvent: false });
  }

  hydrateProjectQueryFromId(form: any, projects: ProjectLite[]): void {
    const projectId = String(form.controls.projectId.value ?? '').trim();
    if (!projectId) return;
    const current = form.controls.projectQuery.value;
    if (current && typeof current !== 'string') return;
    const project = EventDrawerHelper.findByAnyId(projects ?? [], projectId);
    if (project) form.controls.projectQuery.setValue(project, { emitEvent: false });
    else form.controls.projectQuery.setValue(projectId, { emitEvent: false });
  }

  hydrateBookingQueryFromId(form: any, bookings: BookingLite[]): void {
    const bookingId = String(form.controls.bookingId.value ?? '').trim();
    if (!bookingId) return;
    const current = form.controls.bookingQuery.value;
    if (current && typeof current !== 'string') return;
    const booking = EventDrawerHelper.findByAnyId(bookings ?? [], bookingId);
    if (booking) form.controls.bookingQuery.setValue(booking, { emitEvent: false });
    else form.controls.bookingQuery.setValue(bookingId, { emitEvent: false });
  }

  syncSessionNumberFromProject(form: any, projectId: string | undefined, projects: ProjectLite[], events: UiCalendarEvent[]): void {
    const next = EventDrawerHelper.computeNextSessionNumber(projectId, projects ?? [], events ?? []);
    if (next == null) return;
    form.controls.sessionNumber.setValue(next, { emitEvent: false });
  }

  buildDraft(raw: any, start: string, end: string): CreateDraft {
    return {
      type: raw.type,
      artistId: raw.artistId,
      start,
      end,
      durationMinutes: raw.durationMinutes,
      status: raw.status,
      clientId: raw.type === 'booking' ? (raw.clientId.trim() || undefined) : undefined,
      projectId: raw.projectId.trim() || undefined,
      bookingId: raw.bookingId.trim() || undefined,
      zone: raw.zone.trim() || undefined,
      notes: raw.notes.trim() || undefined,
      sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
      painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
      notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
      healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
      paidAmount: raw.type === 'session' ? (raw.paidAmount ?? undefined) : undefined
    } as any;
  }

  buildUpdate(editingEventId: string, raw: any, start: string, end: string): UpdatePatch {
    return {
      id: editingEventId,
      type: raw.type,
      patch: {
        artistId: raw.artistId,
        start,
        end,
        durationMinutes: raw.durationMinutes,
        status: raw.status,
        clientId: raw.type === 'booking' ? (raw.clientId.trim() || undefined) : undefined,
        projectId: raw.projectId.trim() || undefined,
        bookingId: raw.bookingId.trim() || undefined,
        zone: raw.zone.trim() || undefined,
        notes: raw.notes.trim() || undefined,
        sessionNumber: raw.type === 'session' ? (raw.sessionNumber ?? 1) : undefined,
        painLevel: raw.type === 'session' ? (raw.painLevel ?? undefined) : undefined,
        notesByAdmin: raw.type === 'session' ? (raw.notesByAdmin.trim() || undefined) : undefined,
        healingNotes: raw.type === 'session' ? (raw.healingNotes.trim() || undefined) : undefined,
        paidAmount: raw.type === 'session' ? (raw.paidAmount ?? undefined) : undefined
      } as any
    };
  }

  private setDisabled(ctrl: { disable: (opts?: any) => void; enable: (opts?: any) => void; disabled: boolean }, disabled: boolean): void {
    if (disabled) {
      if (!ctrl.disabled) ctrl.disable({ emitEvent: false });
      return;
    }
    if (ctrl.disabled) ctrl.enable({ emitEvent: false });
  }
}
