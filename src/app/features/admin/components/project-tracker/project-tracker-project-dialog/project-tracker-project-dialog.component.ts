import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../../core/modules/material.module';
import { TattooProject } from '../../../../../core/services/projects/projects.service';
import { DynamicField, DynamicFormComponent } from '../../../../../shared/components/form/dynamic-form/dynamic-form.component';
import { MediaAsset } from '../../../../../core/models/media-asset.model';
import { MediaStorageService } from '../../../../../core/services/media/media-storage.service';
import { UiFeedbackService } from '../../../../../core/services/ui/ui-feedback.service';

export interface ProjectTrackerProjectDialogData {
  project: TattooProject;
}

@Component({
  selector: 'app-project-tracker-project-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DynamicFormComponent],
  templateUrl: './project-tracker-project-dialog.component.html',
  styleUrls: ['./project-tracker-project-dialog.component.scss']
})
export class ProjectTrackerProjectDialogComponent {
  readonly form;
  readonly imageItems: Array<{ url: string; asset?: MediaAsset }> = [];
  uploadingImage = false;
  imageUploadProgress = 0;
  readonly formFields: DynamicField[] = [
    { type: 'text', name: 'title', label: 'Titolo', required: true },
    { type: 'toggle', name: 'isPublic', label: 'Visibile nel portfolio pubblico', className: 'full' },
    { type: 'text', name: 'zone', label: 'Zona' },
    { type: 'text', name: 'style', label: 'Stile', placeholder: 'Es. blackwork, fine line' },
    { type: 'text', name: 'subject', label: 'Soggetto', placeholder: 'Es. animali, volti' },
    {
      type: 'select',
      name: 'status',
      label: 'Stato',
      required: true,
      options: [
        { label: 'Bozza', value: 'draft' },
        { label: 'Prenotato', value: 'scheduled' },
        { label: 'Attivo', value: 'active' },
        { label: 'Guarigione', value: 'healing' },
        { label: 'Concluso', value: 'completed' },
        { label: 'Annullato', value: 'cancelled' }
      ]
    },
    { type: 'textarea', name: 'notes', label: 'Note', rows: 3, className: 'full' },
    {
      type: 'textarea',
      name: 'imageUrls',
      label: 'Immagini (URL separati da virgola o a capo)',
      rows: 3,
      className: 'full',
      hint: 'Usa solo URL http/https validi'
    }
  ];
  private readonly imageUrlsValidator = (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (!raw) return null;
    const urls = raw
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const invalid = urls.filter(u => !this.isValidUrl(u));
    return invalid.length ? { invalidUrls: invalid } : null;
  };

  constructor(
    private fb: FormBuilder,
    private mediaStorage: MediaStorageService,
    private ui: UiFeedbackService,
    private dialogRef: MatDialogRef<ProjectTrackerProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectTrackerProjectDialogData
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      zone: [''],
      notes: [''],
      status: ['scheduled', Validators.required],
      isPublic: [false],
      style: [''],
      subject: [''],
      imageUrls: ['', [this.imageUrlsValidator]]
    });

    const p = data.project;
    const gallery = this.normalizeMediaAssets((p as any)?.gallery);
    const legacyUrls = Array.isArray((p as any)?.imageUrls) ? (p as any).imageUrls : [];
    const merged = new Map<string, { url: string; asset?: MediaAsset }>();
    for (const asset of gallery) {
      const url = String(asset.downloadUrl ?? '').trim();
      if (!url) continue;
      merged.set(url, { url, asset });
    }
    for (const item of legacyUrls) {
      const url = String(item ?? '').trim();
      if (!url) continue;
      if (!merged.has(url)) merged.set(url, { url });
    }
    this.imageItems.push(...Array.from(merged.values()));

    this.form.patchValue({
      title: p?.title ?? '',
      zone: p?.zone ?? '',
      notes: p?.notes ?? '',
      status: p?.status ?? 'scheduled',
      isPublic: (p as any)?.isPublic === true,
      style: String((p as any)?.style ?? (p as any)?.genere ?? '').trim(),
      subject: String((p as any)?.subject ?? '').trim(),
      imageUrls: this.imageItems.map(item => item.url).join(', ')
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const imageUrls = this.extractImageUrls(v.imageUrls);
    const gallery = this.imageItems
      .map(item => item.asset)
      .filter((asset): asset is MediaAsset => !!asset && imageUrls.includes(String(asset.downloadUrl ?? '').trim()));
    const coverImage = gallery.length ? gallery[0] : null;

    this.dialogRef.close({
      title: v.title,
      zone: v.zone || undefined,
      notes: v.notes || undefined,
      status: v.status,
      isPublic: v.isPublic === true,
      style: v.style || undefined,
      subject: v.subject || undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      gallery: gallery.length ? gallery : undefined,
      coverImage
    });
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.item(0);
    if (!file || this.uploadingImage) return;

    this.uploadingImage = true;
    this.imageUploadProgress = 0;
    try {
      const projectId = String(this.data.project?.id ?? '').trim() || `draft-${Date.now()}`;
      const asset = await this.mediaStorage.uploadProjectImage(projectId, 'gallery', file, value => {
        this.imageUploadProgress = value;
      });

      const url = String(asset.downloadUrl ?? '').trim();
      if (url) {
        const index = this.imageItems.findIndex(item => item.url === url);
        if (index >= 0) this.imageItems[index] = { url, asset };
        else this.imageItems.push({ url, asset });
        this.setImageUrlsControl(this.imageItems.map(item => item.url));
      }
      this.ui.success('Immagine progetto caricata');
    } catch (error) {
      console.error('[ProjectTrackerProjectDialog] upload image failed', error);
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
    this.setImageUrlsControl(this.imageItems.map(entry => entry.url));

    if (item.asset) {
      try {
        await this.mediaStorage.deleteImage(item.asset);
      } catch (error) {
        console.warn('[ProjectTrackerProjectDialog] delete image failed', error);
      }
    }
  }

  syncImageUrlsFromTextArea(): void {
    const urls = this.extractImageUrls(this.form.get('imageUrls')?.value);
    const merged = new Map<string, { url: string; asset?: MediaAsset }>();
    for (const item of this.imageItems) {
      if (!urls.includes(item.url)) continue;
      merged.set(item.url, item);
    }
    for (const url of urls) {
      if (!merged.has(url)) merged.set(url, { url });
    }
    this.imageItems.splice(0, this.imageItems.length, ...Array.from(merged.values()));
    this.setImageUrlsControl(urls, false);
  }

  private isValidUrl(value: string): boolean {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
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

  private extractImageUrls(raw: unknown): string[] {
    return String(raw ?? '')
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  private setImageUrlsControl(urls: string[], emitEvent = true): void {
    this.form.get('imageUrls')?.setValue(urls.join(', '), { emitEvent });
  }
}
