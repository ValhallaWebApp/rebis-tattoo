import { Injectable, NgZone, inject } from '@angular/core';
import { Database, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Storage, getDownloadURL, ref as storageRef, uploadBytesResumable } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { StudioDocument, StudioDocumentUpsert } from '../../models/document.model';
import { UiFeedbackService } from '../ui/ui-feedback.service';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly path = 'documents';
  private permissionWarningShown = false;

  private readonly db = inject(Database);
  private readonly storage = inject(Storage);
  private readonly zone = inject(NgZone);
  private readonly ui = inject(UiFeedbackService);

  getDocuments(): Observable<StudioDocument[]> {
    const documentsRef = ref(this.db, this.path);

    return new Observable<StudioDocument[]>((observer) => {
      const unsub = onValue(
        documentsRef,
        (snapshot) => {
          this.zone.run(() => {
            const list = snapshot.exists()
              ? Object.entries(snapshot.val() as Record<string, StudioDocument>).map(([id, value]) => ({
                  id,
                  ...value
                }))
              : [];
            observer.next(this.sortDocuments(list));
          });
        },
        (error) => {
          const message = String((error as { message?: string })?.message ?? '').toLowerCase();
          const code = String((error as { code?: string })?.code ?? '').toLowerCase();
          const isPermissionDenied = code.includes('permission-denied') || message.includes('permission_denied');

          this.zone.run(() => {
            if (isPermissionDenied) {
              observer.next([]);
              if (!this.permissionWarningShown) {
                this.permissionWarningShown = true;
                this.ui.warn('Permessi documento non disponibili per questo account');
              }
              return;
            }
            observer.error(error);
          });
        }
      );

      return () => unsub();
    });
  }

  async createDocument(payload: StudioDocumentUpsert): Promise<string> {
    const clean = this.normalizePayload(payload);
    const now = new Date().toISOString();
    const node = push(ref(this.db, this.path));
    const id = String(node.key ?? `${Date.now()}`);

    await set(node, {
      ...clean,
      id,
      createdAt: now,
      updatedAt: now
    } satisfies StudioDocument);
    this.ui.success('Documento creato');
    return id;
  }

  async updateDocument(id: string, changes: Partial<StudioDocumentUpsert>): Promise<void> {
    const safeId = String(id ?? '').trim();
    if (!safeId) return;

    const patch = this.stripUndef({
      ...this.normalizePartial(changes),
      updatedAt: new Date().toISOString()
    });
    await update(ref(this.db, `${this.path}/${safeId}`), patch);
    this.ui.success('Documento aggiornato');
  }

  async deleteDocument(id: string): Promise<void> {
    const safeId = String(id ?? '').trim();
    if (!safeId) return;
    await remove(ref(this.db, `${this.path}/${safeId}`));
    this.ui.success('Documento eliminato');
  }

  async uploadDocumentFile(file: File, onProgress?: (value: number) => void): Promise<string> {
    const safeName = this.sanitizeFilename(file.name);
    const timestamp = Date.now();
    const folder = this.path;
    const filePath = `${folder}/${timestamp}-${safeName}`;
    const targetRef = storageRef(this.storage, filePath);
    const task = uploadBytesResumable(targetRef, file, {
      contentType: String(file.type ?? '').trim() || 'application/octet-stream'
    });

    return await new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (!onProgress) return;
          const total = snapshot.totalBytes || 0;
          const current = snapshot.bytesTransferred || 0;
          const progress = total > 0 ? Math.round((current / total) * 100) : 0;
          onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  private normalizePayload(payload: StudioDocumentUpsert): StudioDocumentUpsert {
    return {
      title: String(payload.title ?? '').trim(),
      description: String(payload.description ?? '').trim(),
      fileUrl: this.normalizeFileUrl(payload.fileUrl)
    };
  }

  private normalizePartial(payload: Partial<StudioDocumentUpsert>): Partial<StudioDocumentUpsert> {
    return {
      title: payload.title !== undefined ? String(payload.title ?? '').trim() : undefined,
      description: payload.description !== undefined ? String(payload.description ?? '').trim() : undefined,
      fileUrl: payload.fileUrl !== undefined ? this.normalizeFileUrl(payload.fileUrl) : undefined
    };
  }

  private normalizeFileUrl(value: string): string {
    const clean = String(value ?? '').trim();
    if (!clean) return '';
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/')) return clean;
    return `/${clean}`;
  }

  private sortDocuments(list: StudioDocument[]): StudioDocument[] {
    return [...list].sort((a, b) => {
      const bDate = this.parseTime(b.updatedAt ?? b.createdAt);
      const aDate = this.parseTime(a.updatedAt ?? a.createdAt);
      if (bDate !== aDate) return bDate - aDate;
      return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'it');
    });
  }

  private parseTime(value: string | undefined): number {
    const time = Date.parse(String(value ?? ''));
    return Number.isFinite(time) ? time : 0;
  }

  private sanitizeFilename(value: string): string {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return 'document';
    return trimmed
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private stripUndef<T extends Record<string, unknown>>(obj: T): T {
    const output: Record<string, unknown> = {};
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== undefined) {
        output[key] = value;
      }
    });
    return output as T;
  }
}
