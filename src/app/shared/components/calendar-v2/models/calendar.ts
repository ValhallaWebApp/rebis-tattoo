export type CalendarView = 'day' | 'week' | 'month';

export type CalendarEventType = 'booking' | 'session';

export type CalendarEventStatus =
  | 'draft'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

/**
 * Evento normalizzato usato dal Calendar V2
 */
export interface CalendarEvent {
  /** ID dell'entità originale (bookingId/sessionId) */
  id: string;

  /** Tipo di entità (booking/session) */
  type: CalendarEventType;

  /** Titolo mostrato sull'evento */
  title: string;

  /** Data logica dell'evento, es. '2025-11-20' */
  date: string;

  /** ISO start e end: '2025-11-20T14:00:00' */
  start: string;
  end: string;

  /** Artista / risorsa */
  artistId: string;
  artistName?: string;
  artistAvatar?: string;

  /** Stato (opzionale) */
  status?: CalendarEventStatus;

  /** Colore opzionale (per highlight in UI) */
  color?: string;

  /** Extra (projectId, userId, durata, isMine, ecc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Payload emesso quando l'utente crea un nuovo evento
 * dal drawer del Calendar V2
 */
export interface BookingDraftPayload {
  type: CalendarEventType;

  /** Risorsa/artista */
  artistId: string;

  /** Data + ora scelte dalla UI */
  date: string;   // 'YYYY-MM-DD'
  time: string;   // 'HH:mm'

  /** Durata in minuti */
  duration: number;

  /** Descrizione / note */
  description: string;

  /** Collegamenti opzionali */
  idClient?: string;
  idProject?: string;

  price?: number;
  paidAmount?: number;

  /** Extra */
  metadata?: Record<string, unknown>;
}

/**
 * Payload emesso dal drag&drop in Day/Week view
 */
export interface CalendarDragUpdate {
  event: CalendarEvent;

  /** Nuova data e ora */
  newDate: string;    // 'YYYY-MM-DD'
  newHour: string;    // 'HH:mm'

  /** Nuovo artista opzionale */
  newArtistId: string;
}
