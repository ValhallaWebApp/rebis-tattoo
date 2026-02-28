import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { EventDrawerHelper } from './event-drawer.helper';
import { BookingLite, ClientLite, ProjectLite } from './event-drawer.types';

interface ProjectSelectionArgs {
  form: any;
  project: ProjectLite;
  clients: ClientLite[];
  bookings: BookingLite[];
  mode: 'create' | 'edit';
  isBooking: boolean;
  editingEventId: string | null;
  confirmedProjectId: string | null;
}

@Injectable({ providedIn: 'root' })
export class EventDrawerProjectSelectionService {
  private readonly dialog = inject(MatDialog);

  async applySelection(args: ProjectSelectionArgs): Promise<string | null> {
    const { form, project, mode, isBooking, editingEventId, confirmedProjectId } = args;
    if (!project?.id) return confirmedProjectId;

    const previousProjectId = String(form.controls.projectId.value ?? '').trim();
    const previousProjectQuery = form.controls.projectQuery.value;

    form.controls.projectId.setValue(project.id);
    form.controls.projectQuery.setValue(project, { emitEvent: false });
    form.controls.projectQuery.setErrors(null);

    const projectBookingId = String(project.bookingId ?? '').trim();
    const currentBookingId = mode === 'edit' && isBooking ? String(editingEventId ?? '').trim() : '';
    const selectedClientId = String(form.controls.clientId.value ?? '').trim();
    const projectClientId = String(project.clientId ?? '').trim();

    const bookingWillBeReplaced = isBooking && !!projectBookingId && projectBookingId !== currentBookingId;
    const clientWillBeReplaced = isBooking && !!projectClientId && !!selectedClientId && projectClientId !== selectedClientId;

    if (!bookingWillBeReplaced && !clientWillBeReplaced) {
      return null;
    }

    const selectedProjectId = String(project.id ?? '').trim();
    if (selectedProjectId && confirmedProjectId === selectedProjectId) {
      return confirmedProjectId;
    }

    const warnings: string[] = [];
    if (bookingWillBeReplaced) {
      warnings.push(
        `Questo progetto e gia collegato alla consulenza "${this.getBookingLabel(args.bookings, projectBookingId)}". Continuando, la consulenza verra sostituita.`
      );
    }
    if (clientWillBeReplaced) {
      warnings.push(
        `Il progetto e associato al cliente "${this.getClientLabel(args.clients, projectClientId)}". Continuando, il cliente selezionato "${this.getClientLabel(args.clients, selectedClientId)}" verra sostituito.`
      );
    }

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '520px',
      data: {
        title: 'Conferma sostituzione',
        message: warnings.join('\n\n'),
        confirmText: 'Continua',
        cancelText: 'Annulla'
      }
    });
    const ok = await firstValueFrom(ref.afterClosed());

    const currentSelectedProjectId = String(form.controls.projectId.value ?? '').trim();
    if (currentSelectedProjectId !== selectedProjectId) {
      return confirmedProjectId;
    }

    if (!ok) {
      form.controls.projectId.setValue(previousProjectId, { emitEvent: false });
      form.controls.projectQuery.setValue(previousProjectQuery, { emitEvent: false });
      return null;
    }

    return selectedProjectId || null;
  }

  private getClientLabel(clients: ClientLite[], clientId?: string): string {
    const id = String(clientId ?? '').trim();
    if (!id) return 'cliente non specificato';
    const row = EventDrawerHelper.findByAnyId(clients ?? [], id);
    return String(row?.fullName ?? '').trim() || id;
  }

  private getBookingLabel(bookings: BookingLite[], bookingId?: string): string {
    const id = String(bookingId ?? '').trim();
    if (!id) return 'consulenza';
    const row = (bookings ?? []).find(b => String(b.id ?? '').trim() === id);
    if (!row) return id;
    const title = String(row.title ?? '').trim();
    const when = String(row.start ?? '').trim();
    if (title && when) return `${title} (${when})`;
    if (title) return title;
    return id;
  }
}
