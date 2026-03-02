import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StudioDocument } from '../../../../core/models/document.model';
import { MaterialModule } from '../../../../core/modules/material.module';
import { DocumentsService } from '../../../../core/services/documents/documents.service';
import { ConfirmActionService } from '../../../../core/services/ui/confirm-action.service';
import { UiFeedbackService } from '../../../../core/services/ui/ui-feedback.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss'],
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsComponent {
  private static readonly MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

  private readonly formBuilder = inject(FormBuilder);
  private readonly documentsService = inject(DocumentsService);
  private readonly confirmAction = inject(ConfirmActionService);
  private readonly ui = inject(UiFeedbackService);

  readonly documents = toSignal(this.documentsService.getDocuments(), {
    initialValue: [] as StudioDocument[]
  });
  readonly editingDocumentId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly dropActive = signal(false);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadedFilename = signal('');
  readonly isEditing = computed(() => !!this.editingDocumentId());
  readonly submitLabel = computed(() => (this.isEditing() ? 'Salva modifiche' : 'Crea documento'));
  readonly acceptTypes = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';

  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.maxLength(320)]],
    fileUrl: ['', [Validators.required, Validators.pattern(/^(https?:\/\/|\/).+/i)]]
  });

  async saveDocument(): Promise<void> {
    if (this.form.invalid) {
      if (this.form.controls.fileUrl.hasError('required')) {
        this.ui.warn('Carica un file prima di salvare il documento');
      }
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    const payload = {
      title: this.form.controls.title.value.trim(),
      description: this.form.controls.description.value.trim(),
      fileUrl: this.form.controls.fileUrl.value.trim()
    };

    this.saving.set(true);
    try {
      const currentId = this.editingDocumentId();
      if (currentId) {
        await this.documentsService.updateDocument(currentId, payload);
      } else {
        await this.documentsService.createDocument(payload);
      }
      this.startCreate();
      this.drawerOpen.set(false);
    } catch {
      this.ui.error('Salvataggio documento non riuscito');
    } finally {
      this.saving.set(false);
    }
  }

  openCreateDrawer(): void {
    this.startCreate();
    this.drawerOpen.set(true);
  }

  openEditDrawer(document: StudioDocument): void {
    this.startEdit(document);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.resetUploadState();
  }

  onDrawerOpenedChange(open: boolean): void {
    this.drawerOpen.set(open);
    if (!open) {
      this.resetUploadState();
    }
  }

  startCreate(): void {
    this.editingDocumentId.set(null);
    this.form.reset({
      title: '',
      description: '',
      fileUrl: ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.resetUploadState();
  }

  startEdit(document: StudioDocument): void {
    const id = String(document.id ?? '').trim();
    if (!id) return;
    this.editingDocumentId.set(id);
    this.form.reset({
      title: String(document.title ?? ''),
      description: String(document.description ?? ''),
      fileUrl: String(document.fileUrl ?? '')
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.resetUploadState();
  }

  async deleteDocument(document: StudioDocument): Promise<void> {
    const id = String(document.id ?? '').trim();
    if (!id) return;

    const confirmed = await this.confirmAction.confirm({
      title: 'Eliminare documento?',
      message: `Il documento "${document.title}" verrà rimosso in modo permanente.`,
      confirmText: 'Elimina',
      cancelText: 'Annulla'
    });
    if (!confirmed) return;

    try {
      await this.documentsService.deleteDocument(id);
      if (this.editingDocumentId() === id) {
        this.startCreate();
      }
    } catch {
      this.ui.error('Eliminazione documento non riuscita');
    }
  }

  trackByDocument(index: number, document: StudioDocument): string {
    return String(document.id ?? `${document.title}-${index}`);
  }

  onDropZoneDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive.set(true);
  }

  onDropZoneDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive.set(false);
  }

  async onDropZoneDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive.set(false);

    const file = event.dataTransfer?.files?.item(0) ?? null;
    if (!file) return;
    await this.uploadSelectedFile(file);
  }

  async onFileInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0) ?? null;
    if (input) input.value = '';
    if (!file) return;
    await this.uploadSelectedFile(file);
  }

  private async uploadSelectedFile(file: File): Promise<void> {
    if (this.uploading()) return;

    if (!this.isSupportedFile(file)) {
      this.ui.warn('Formato file non supportato. Usa PDF, DOC, DOCX o immagine.');
      return;
    }

    if (file.size > DocumentsComponent.MAX_FILE_SIZE_BYTES) {
      this.ui.warn('File troppo grande. Limite massimo 15MB.');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadedFilename.set(file.name);

    try {
      const fileUrl = await this.documentsService.uploadDocumentFile(file, (progress) => {
        this.uploadProgress.set(progress);
      });
      this.form.patchValue({ fileUrl });
      this.form.controls.fileUrl.markAsDirty();
      this.form.controls.fileUrl.markAsTouched();

      const titleControl = this.form.controls.title;
      if (!String(titleControl.value ?? '').trim()) {
        titleControl.setValue(this.suggestTitle(file.name));
      }
      this.ui.success('File caricato');
    } catch {
      this.ui.error('Caricamento file non riuscito');
    } finally {
      this.uploading.set(false);
    }
  }

  private suggestTitle(filename: string): string {
    return String(filename ?? '').replace(/\.[^/.]+$/, '').trim();
  }

  private isSupportedFile(file: File): boolean {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]);

    const mime = String(file.type ?? '').toLowerCase().trim();
    if (allowedMimeTypes.has(mime)) return true;

    const name = String(file.name ?? '').toLowerCase().trim();
    return /\.(pdf|doc|docx|png|jpe?g|webp)$/i.test(name);
  }

  private resetUploadState(): void {
    this.dropActive.set(false);
    this.uploading.set(false);
    this.uploadProgress.set(0);
    this.uploadedFilename.set('');
  }
}
