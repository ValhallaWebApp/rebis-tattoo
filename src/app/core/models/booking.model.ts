export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Draft leggero che puo arrivare da chatbot/fast-booking. */
export interface BookingChatDraft {
  artistId?: string;
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:mm"
  duration?: number; // minuti
  note?: string;
  start?: string;
  end?: string;
}

/** Booking canonico applicativo. */
export interface Booking {
  id: string;

  // canonico
  clientId: string;
  artistId: string;
  projectId?: string;
  type?: 'consultation' | 'session';
  source?: 'fast-booking' | 'chat-bot' | 'manual';

  title: string;
  start: string; // "YYYY-MM-DDTHH:mm:ss" locale
  end: string;
  notes?: string;
  status: BookingStatus;

  price?: number;
  depositRequired?: number;
  paidAmount?: number;

  createdAt: string;
  updatedAt: string;

  // lifecycle
  lastRescheduledAt?: string;
  rescheduleCount?: number;
  cancelledBy?: 'admin' | 'client';
  cancelReason?: string;

  createdById?: string;
}
