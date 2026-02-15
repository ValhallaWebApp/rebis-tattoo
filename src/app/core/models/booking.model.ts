// booking.model.ts

export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Draft leggero che può arrivare dal chatbot */
export interface BookingChatDraft {
  artistId?: string;
  date?: string;       // "YYYY-MM-DD"
  time?: string;       // "HH:mm"
  duration?: number;   // minuti (default 30)
  note?: string;
  start?: string;
  end?: string;
}

/** Modello Booking salvato su Firebase RTDB */
export interface Booking {
  id: string;
  title: string;
  start: string;               // "YYYY-MM-DDTHH:mm:ss" (locale, no Z)
  end: string;                 // "YYYY-MM-DDTHH:mm:ss"
  idClient: string;
  description: string;
  idArtist: string;
  status: BookingStatus;
  price: number;
  paidAmount?: number | null;

  // Tracciamento temporale
  createAt: string;
  updateAt: string;
  lastRescheduledAt?: string;
  rescheduleCount?: number;

  // Audit & tracking
  createdBy?: string;
  updatedBy?: string;

  // Annullamento
  cancelledBy?: string;
  cancelReason?: string;

  // Info UI (opzionali)
  clientName?: string;
  artistName?: string;
  source?: 'fast-booking' | 'chat-bot' | 'manual';

  // Relazioni future (opzionali)
  serviceId?: string;
  sessionId?: string;
  tags?: string[];

  // Extra
  timezone?: string;
  isDeleted?: boolean;
  isReschedulable?: boolean;
}
