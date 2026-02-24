export type CalendarViewMode = 'day' | 'week' | 'month';
export type UiEventType = 'booking' | 'session';

export interface UiArtist {
  id: string;
  name: string;
  photoUrl?: string;
  isActive?: boolean;
  calendarEnabled?: boolean;
  workdayStart?: string; // "08:00"
  workdayEnd?: string;   // "20:00"
  stepMinutes?: number;  // 15/30
  color?: string;        // "#RRGGBB"
}

export interface UiCalendarEvent {
  id: string;
  type: UiEventType;

  artistId: string;

  start: string; // ISO
  end: string;   // ISO
  durationMinutes: number;

  clientId?: string;
  projectId?: string;
  bookingId?: string;
  sessionNumber?: number;
  status?: string;
  notes?: string;
  notesByAdmin?: string;
  healingNotes?: string;
  painLevel?: number;
  paidAmount?: number;
  zone?: string;
  createdById?: string;

  // UI-only helpers (optional)
  title?: string; // es: "Booking - Mario"
  subtitle?: string;
}

export interface CreateDraft {
  type: UiEventType;
  artistId: string;
  start: string; // ISO
  end: string;   // ISO
  durationMinutes: number;

  clientId?: string;
  projectId?: string;
  bookingId?: string;
  zone?: string;
  notes?: string;
  notesByAdmin?: string;
  healingNotes?: string;
  painLevel?: number;
  paidAmount?: number;
  sessionNumber?: number;
  status?: string;
}

export interface UpdatePatch {
  id: string;
  type: UiEventType;
  patch: Partial<Pick<UiCalendarEvent, 'start' | 'end' | 'durationMinutes' | 'notes' | 'notesByAdmin' | 'healingNotes' | 'painLevel' | 'paidAmount' | 'status' | 'clientId' | 'projectId' | 'bookingId' | 'artistId' | 'zone' | 'sessionNumber'>>;
}

export interface AvailabilitySlot {
  time: string;     // "10:00"
  startISO: string; // ISO
  endISO: string;   // ISO
}

export interface AvailabilityByDateResult {
  date: string; // YYYY-MM-DD
  slots: AvailabilitySlot[];
}

export interface AvailabilityByTimeResult {
  time: string; // "10:00"
  dates: { date: string; startISO: string; endISO: string }[];
}

export interface NewEventSeed {
  artistId: string;
  durationMinutes: number;
  mode: 'byDate' | 'byTime';
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
}
