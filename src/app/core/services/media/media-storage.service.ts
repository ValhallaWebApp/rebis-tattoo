import { Injectable, inject } from '@angular/core';
import { Database, ref as dbRef, remove, set } from '@angular/fire/database';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable
} from '@angular/fire/storage';
import { MediaAsset, MediaAssetRole, MediaAssetSourceType } from '../../models/media-asset.model';

export interface UploadImageInput {
  file: File;
  fullPath: string;
  role: MediaAssetRole;
  sourceType: MediaAssetSourceType;
  sourceId: string;
  alt?: string;
  sortOrder?: number;
  onProgress?: (value: number) => void;
}

@Injectable({ providedIn: 'root' })
export class MediaStorageService {
  private readonly storage = inject(Storage);
  private readonly db = inject(Database);

  // Keep limit centralized and easy to tune.
  private readonly maxImageSizeBytes = 8 * 1024 * 1024;
  private readonly allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  async uploadImage(input: UploadImageInput): Promise<MediaAsset> {
    this.validateImageFile(input.file);

    const uploadPath = this.normalizeFullPath(input.fullPath, input.file.name);
    const fileName = this.filenameFromPath(uploadPath);
    const targetRef = storageRef(this.storage, uploadPath);
    const task = uploadBytesResumable(targetRef, input.file, {
      contentType: String(input.file.type ?? '').trim() || 'application/octet-stream'
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        snapshot => {
          if (!input.onProgress) return;
          const total = snapshot.totalBytes || 0;
          const transferred = snapshot.bytesTransferred || 0;
          const progress = total > 0 ? Math.round((transferred / total) * 100) : 0;
          input.onProgress(progress);
        },
        error => reject(error),
        async () => {
          try {
            resolve(await getDownloadURL(task.snapshot.ref));
          } catch (error) {
            reject(error);
          }
        }
      );
    });

    const now = new Date().toISOString();
    const asset: MediaAsset = {
      id: this.createAssetId(),
      name: fileName,
      fullPath: uploadPath,
      downloadUrl,
      contentType: String(input.file.type ?? '').trim() || 'application/octet-stream',
      size: Number(input.file.size ?? 0),
      createdAt: now,
      updatedAt: now,
      alt: this.cleanOptional(input.alt),
      role: input.role,
      sortOrder: input.sortOrder,
      sourceType: input.sourceType,
      sourceId: this.cleanSourceId(input.sourceId)
    };

    await this.saveMetadata(asset);
    return asset;
  }

  async replaceImage(oldAsset: MediaAsset | null | undefined, input: UploadImageInput): Promise<MediaAsset> {
    const nextAsset = await this.uploadImage(input);
    if (oldAsset?.fullPath) {
      await this.deleteImage(oldAsset).catch(() => void 0);
    }
    return nextAsset;
  }

  async deleteImage(asset: Pick<MediaAsset, 'fullPath' | 'id' | 'sourceType' | 'sourceId'>): Promise<void> {
    const fullPath = String(asset.fullPath ?? '').trim();
    if (!fullPath) return;

    await deleteObject(storageRef(this.storage, fullPath));
    await this.deleteMetadata(asset.sourceType, asset.sourceId, asset.id);
  }

  async uploadProjectImage(
    projectId: string,
    role: Extract<MediaAssetRole, 'cover' | 'gallery' | 'reference' | 'thumbnail'>,
    file: File,
    onProgress?: (value: number) => void
  ): Promise<MediaAsset> {
    const cleanProjectId = this.cleanSourceId(projectId);
    const folder = role === 'cover' ? 'cover' : role === 'reference' ? 'reference' : role === 'thumbnail' ? 'cover' : 'gallery';
    return this.uploadImage({
      file,
      fullPath: `rebis/projects/${cleanProjectId}/${folder}/${this.uniqueFileName(file.name)}`,
      role,
      sourceType: 'project',
      sourceId: cleanProjectId,
      onProgress
    });
  }

  async uploadSessionImage(
    sessionId: string,
    role: Extract<MediaAssetRole, 'gallery' | 'before' | 'after' | 'reference'>,
    file: File,
    onProgress?: (value: number) => void
  ): Promise<MediaAsset> {
    const cleanSessionId = this.cleanSourceId(sessionId);
    const folder = role === 'reference' ? 'reference' : 'gallery';
    return this.uploadImage({
      file,
      fullPath: `rebis/sessions/${cleanSessionId}/${folder}/${this.uniqueFileName(file.name)}`,
      role,
      sourceType: 'session',
      sourceId: cleanSessionId,
      onProgress
    });
  }

  async uploadHomeImage(
    slotKey: string,
    role: Extract<MediaAssetRole, 'hero' | 'background' | 'thumbnail'>,
    file: File,
    onProgress?: (value: number) => void
  ): Promise<MediaAsset> {
    const cleanSlot = this.cleanSourceId(slotKey);
    return this.uploadImage({
      file,
      fullPath: `rebis/site/home/${cleanSlot}/${this.uniqueFileName(file.name)}`,
      role,
      sourceType: 'home',
      sourceId: cleanSlot,
      onProgress
    });
  }

  async uploadPageSectionImage(
    pageKey: string,
    sectionKey: string,
    role: Extract<MediaAssetRole, 'background' | 'gallery' | 'hero' | 'thumbnail'>,
    file: File,
    onProgress?: (value: number) => void
  ): Promise<MediaAsset> {
    const cleanPage = this.cleanSourceId(pageKey);
    const cleanSection = this.cleanSourceId(sectionKey);
    const folder = role === 'background' ? 'background' : 'gallery';
    return this.uploadImage({
      file,
      fullPath: `rebis/site/pages/${cleanPage}/sections/${cleanSection}/${folder}/${this.uniqueFileName(file.name)}`,
      role,
      sourceType: 'page-section',
      sourceId: `${cleanPage}:${cleanSection}`,
      onProgress
    });
  }

  validateImageFile(file: File): void {
    if (!(file instanceof File)) {
      throw new Error('media/invalid-file');
    }
    const mime = String(file.type ?? '').toLowerCase().trim();
    if (!this.allowedImageTypes.has(mime)) {
      throw new Error('media/invalid-file-type');
    }
    const size = Number(file.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('media/invalid-file-size');
    }
    if (size > this.maxImageSizeBytes) {
      throw new Error('media/file-too-large');
    }
  }

  private async saveMetadata(asset: MediaAsset): Promise<void> {
    const path = this.metadataPath(asset.sourceType, asset.sourceId, asset.id);
    await set(dbRef(this.db, path), asset);
  }

  private async deleteMetadata(sourceType: MediaAssetSourceType, sourceId: string, id: string): Promise<void> {
    const cleanId = String(id ?? '').trim();
    if (!cleanId) return;
    const path = this.metadataPath(sourceType, sourceId, cleanId);
    await remove(dbRef(this.db, path));
  }

  private metadataPath(sourceType: MediaAssetSourceType, sourceId: string, id: string): string {
    const cleanType = String(sourceType ?? '').trim() || 'generic';
    const cleanSourceId = this.cleanSourceId(sourceId);
    const cleanId = String(id ?? '').trim();
    return `mediaAssets/${cleanType}/${cleanSourceId}/${cleanId}`;
  }

  private normalizeFullPath(path: string, fileName: string): string {
    const cleanPath = String(path ?? '').trim().replace(/\\/g, '/');
    const normalized = cleanPath.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalized) {
      return this.uniqueFileName(fileName);
    }
    return normalized;
  }

  private filenameFromPath(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || 'image';
  }

  private uniqueFileName(fileName: string): string {
    const safe = this.normalizeFileName(fileName);
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  }

  private normalizeFileName(value: string): string {
    const raw = String(value ?? '').trim().toLowerCase();
    const clean = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean || 'image';
  }

  private cleanSourceId(value: string): string {
    const clean = String(value ?? '').trim().replace(/[^a-zA-Z0-9:_-]/g, '-');
    return clean || 'unknown';
  }

  private cleanOptional(value: string | undefined): string | undefined {
    const clean = String(value ?? '').trim();
    return clean || undefined;
  }

  private createAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

