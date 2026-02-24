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
  createdAt: string;
  updatedAt?: string;

}
