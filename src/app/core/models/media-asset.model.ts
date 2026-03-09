export type MediaAssetRole =
  | 'cover'
  | 'gallery'
  | 'hero'
  | 'background'
  | 'thumbnail'
  | 'reference'
  | 'before'
  | 'after';

export type MediaAssetSourceType =
  | 'project'
  | 'session'
  | 'home'
  | 'page-section'
  | 'generic';

export interface MediaAsset {
  id: string;
  name: string;
  fullPath: string;
  downloadUrl: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  alt?: string;
  role: MediaAssetRole;
  sortOrder?: number;
  sourceType: MediaAssetSourceType;
  sourceId: string;
}

