import { CreateDraft, UpdatePatch } from '../../models';

export type UiEventType = 'booking' | 'session';

export interface ClientLite {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface ProjectLite {
  id: string;
  title: string;
  clientId?: string;
  artistId?: string;
  sessionIds?: string[];
  bookingId?: string;
}

export interface BookingLite {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  artistId?: string;
  clientId?: string;
  projectId?: string;
}

export interface DrawerDraft {
  type: UiEventType;
  artistId: string;
  start: string;
  end: string;
  durationMinutes: number;
  date: string;
  time: string;
  duration: number;
  status: string;
  clientId?: string;
  projectId?: string;
  bookingId?: string;
  zone?: string;
  notes?: string;
  sessionNumber?: number;
  painLevel?: number;
  notesByAdmin?: string;
  healingNotes?: string;
}

export interface EventDrawerResult {
  mode: 'create' | 'edit';
  draft: CreateDraft;
  update?: UpdatePatch;
  projectWarningConfirmedId?: string;
}

export interface CreateProjectTriggerPayload {
  clientId?: string;
  artistId?: string;
  titleHint?: string;
  bookingId?: string;
}
