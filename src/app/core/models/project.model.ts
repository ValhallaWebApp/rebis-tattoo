import { MediaAsset } from './media-asset.model';
export type ProjectStatus = 'draft' | 'scheduled' | 'active' | 'healing' | 'completed' | 'cancelled';

/** Progetto tatuaggio canonico applicativo. */
export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;

  // canonico
  artistId?: string;
  clientId?: string;
  bookingId?: string;
  sessionIds?: string[];
  zone?: string;
  placement?: string;
  notes?: string;
  isPublic?: boolean;
  style?: string;
  subject?: string;
  imageUrls?: string[];
  coverImage?: MediaAsset | null;
  gallery?: MediaAsset[];
  referenceImages?: MediaAsset[];
  createdAt: string;
  updatedAt?: string;

}
