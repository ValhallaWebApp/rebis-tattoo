import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';
import { DynamicField, DynamicFormComponent } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { MediaAsset } from '../../../../../core/models/media-asset.model';
import { MediaStorageService } from '../../../../../core/services/media/media-storage.service';
import { UiFeedbackService } from '../../../../../core/services/ui/ui-feedback.service';

export interface ProjectTrackerSessionDialogData {
  project: TattooProject;
  session?: any;
}

@Component({
  selector: 'app-project-tracker-session-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './project-tracker-session-dialog.component.html',
  styleUrls: ['./project-tracker-session-dialog.component.scss']
})
export class ProjectTrackerSessionDialogComponent {
  readonly form;
  readonly imageItems: Array<{ url: string; asset?: MediaAsset }> = [];
  uploadingImage = false;
  imageUploadProgress = 0;
  readonly formFields: DynamicField[] = [
    { type: 'date-native', name: 'date', label: 'Data', required: true },
    { type: 'time', name: 'time', label: 'Ora', required: true },
    { type: 'number', name: 'durationMinutes', label: 'Durata (min)', min: 15, required: true },
    {
      type: 'select',
      name: 'status',
      label: 'Status',
      required: true,
      options: [
        { label: 'Pianificata', value: 'planned' },
        { label: 'Completata', value: 'completed' },
        { label: 'Annullata', value: 'cancelled' }
      ]
    },
    { type: 'number', name: 'paidAmount', label: 'Pagato (seduta)', min: 0 },
    { type: 'textarea', name: 'notesByAdmin', label: 'Note admin', rows: 2, className: 'full' }
  ];

  constructor(
    private fb: FormBuilder,
    private mediaStorage: MediaStorageService,
    private ui: UiFeedbackService,
    private dialogRef: MatDialogRef<ProjectTrackerSessionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerSessionDialogData
  ) {
    this.form = this.fb.group({
      date: ['', Validators.required],
      time: ['', Validators.required],
      durationMinutes: [60, [Validators.required, Validators.min(15)]],
      status: ['planned', Validators.required],
      notesByAdmin: [''],
      paidAmount: [0]
    });

    const s = data.session;
    const gallery = this.normalizeMediaAssets((s as any)?.gallery);
    const legacy = Array.isArray((s as any)?.photoUrlList) ? (s as any).photoUrlList : [];
    const merged = new Map<string, { url: string; asset?: MediaAsset }>();
    for (const asset of gallery) {
      const url = String(asset.downloadUrl ?? '').trim();
      if (!url) continue;
      merged.set(url, { url, asset });
    }
    for (const item of legacy) {
      const url = String(item ?? '').trim();
      if (!url) continue;
      if (!merged.has(url)) merged.set(url, { url });
    }
    this.imageItems.push(...Array.from(merged.values()));

    if (s?.start) {
      const d = new Date(s.start);
      const date = this.toDateKey(d);
      const time = `${this.pad(d.getHours())}:${this.pad(d.getMinutes())}`;
      this.form.patchValue({
        date,
        time,
        durationMinutes: s.durationMinutes ?? 60,
        status: s.status ?? 'planned',
        notesByAdmin: s.notesByAdmin ?? '',
        paidAmount: s.paidAmount ?? 0
      });
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const start = `${v.date}T${v.time}:00`;
    const end = this.addMinutes(start, Number(v.durationMinutes ?? 60));

    this.dialogRef.close({
      projectId: this.data.project?.id,
      artistId: this.data.project?.artistId,
      clientId: this.data.project?.clientId,
      bookingId: (this.data.project as any)?.bookingId ?? undefined,
      start,
      end,
      durationMinutes: Number(v.durationMinutes ?? 60),
      status: v.status,
      notesByAdmin: v.notesByAdmin,
      paidAmount: Number(v.paidAmount ?? 0),
      photoUrlList: this.imageItems.map(item => item.url),
      gallery: this.imageItems
        .map(item => item.asset)
        .filter((asset): asset is MediaAsset => !!asset),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0);
    if (!file || this.uploadingImage) return;

    this.uploadingImage = true;
    this.imageUploadProgress = 0;
    try {
      const sessionId =
        String((this.data.session as any)?.id ?? '').trim() ||
        `draft-${String(this.data.project?.id ?? '').trim() || Date.now()}`;
      const asset = await this.mediaStorage.uploadSessionImage(sessionId, 'gallery', file, value => {
        this.imageUploadProgress = value;
      });
      const url = String(asset.downloadUrl ?? '').trim();
      if (url && !this.imageItems.some(item => item.url === url)) {
        this.imageItems.push({ url, asset });
      }
      this.ui.success('Immagine seduta caricata');
    } catch (error) {
      console.error('[ProjectTrackerSessionDialog] upload image failed', error);
      this.ui.error('Upload immagine non riuscito');
    } finally {
      this.uploadingImage = false;
      this.imageUploadProgress = 0;
      if (input) input.value = '';
    }
  }

  async removeImage(item: { url: string; asset?: MediaAsset }): Promise<void> {
    const index = this.imageItems.findIndex(entry => entry.url === item.url);
    if (index < 0) return;
    this.imageItems.splice(index, 1);
    if (item.asset) {
      try {
        await this.mediaStorage.deleteImage(item.asset);
      } catch (error) {
        console.warn('[ProjectTrackerSessionDialog] delete image failed', error);
      }
    }
  }

  private addMinutes(start: string, minutes: number): string {
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + minutes);
    return this.toLocalDateTime(d);
  }

  private toLocalDateTime(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}T${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:00`;
  }

  private toDateKey(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  private normalizeMediaAssets(value: unknown): MediaAsset[] {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const id = String((item as any).id ?? '').trim();
        const fullPath = String((item as any).fullPath ?? '').trim();
        const downloadUrl = String((item as any).downloadUrl ?? '').trim();
        if (!id || !fullPath || !downloadUrl) return null;
        return item as MediaAsset;
      })
      .filter((item): item is MediaAsset => !!item);
  }
}
