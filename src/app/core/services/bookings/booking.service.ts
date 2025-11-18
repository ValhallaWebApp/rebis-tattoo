import { Injectable, signal, computed } from '@angular/core';
import {
  Database,
  ref, push, set, update, remove, get, onValue,
  query, orderByChild, equalTo,
  startAt,
  endAt
} from '@angular/fire/database';
import { Observable } from 'rxjs';

/** Stati consentiti */
export type BookingStatus =
  | 'draft'
  | 'paid'
  | 'on-going'
  | 'completed'
  | 'cancelled';

/** Draft leggero che può arrivare dal chatbot */
export interface BookingChatDraft {
  artistId?: string;   // id artista (opzionale)
  date?: string;       // "YYYY-MM-DD"
  time?: string;       // "HH:mm"
  duration?: number;   // minuti (default 30)
  note?: string;       // descrizione
  start?:string;
  end?:string;
}

/** Modello Booking salvato su RTDB */
export interface Booking {
  id: string;
  title: string;
  start: string;       // "YYYY-MM-DDTHH:mm:ss" (locale, senza Z)
  end: string;         // "YYYY-MM-DDTHH:mm:ss" (locale, senza Z)
  idClient: string;
  description: string;
  idArtist: string;
  eta?: string;
  createAt: string;    // "YYYY-MM-DDTHH:mm:ss"
  updateAt: string;    // "YYYY-MM-DDTHH:mm:ss"
  status: BookingStatus;
  price: number;
  paidAmount?: any;
  cancelledBy?: string;
  cancelReason?: string;
  rescheduleCount?: number;
  lastRescheduledAt?: string;
}

/* ============================================================================
 * BookingDraftService
 *  - Ponte in-memory fra il chatbot e la pagina /bookings
 *  - Non usa DB: tiene un draft volatile finché non viene consumato
 *  - Include log per tracciare il ciclo di vita del draft
 * ==========================================================================*/
@Injectable({ providedIn: 'root' })
export class BookingDraftService {
  /** stato in-memory del draft (niente persistenza su RTDB/Storage) */
  private _draft = signal<BookingChatDraft | null>(null);
  /** sola lettura reattiva (comoda per componenti) */
  readonly draftSig = this._draft.asReadonly();
  /** flag comodo: esiste un draft? */
  readonly hasDraftSig = computed(() => this._draft() !== null);

  /** rimuove chiavi undefined (utile su patch) */
  private stripUndef<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k];
    return out;
  }

  /** imposta/merge del draft (logga stato prima/dopo) */
  setDraft(draft: BookingChatDraft, opts: { merge?: boolean } = {}): void {
    const draftClean = this.stripUndef(draft);
    const prev = this._draft();
    const next = opts.merge && prev ? { ...prev, ...draftClean } : draftClean;
    console.log('[BookingDraftService] setDraft →', { prev, incoming: draftClean, merge: !!opts.merge, next });
    this._draft.set(next);
  }

  /** patch parziale del draft corrente */
  patchDraft(patch: Partial<BookingChatDraft>): void {
    const prev = this._draft();
    const next = { ...(prev || {}), ...this.stripUndef(patch) };
    console.log('[BookingDraftService] patchDraft →', { prev, patch, next });
    this._draft.set(next);
  }

  /** consuma e azzera il draft (one-shot) */
  consume(): BookingChatDraft | null {
    const d = this._draft();
    this._draft.set(null);
    console.log('[BookingDraftService] consume →', d);
    return d;
  }

  /** reset completo (senza restituire) */
  reset(): void {
    console.log('[BookingDraftService] reset');
    this._draft.set(null);
  }
}

/* ============================================================================
 * BookingService
 *  - Operazioni su RTDB per gestione prenotazioni
 *  - Aggiunte utilità per creare una bozza a partire da BookingChatDraft
 *  - Tanti console.log per vedere il flusso end-to-end
 * ==========================================================================*/
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly path = 'bookings';

  constructor(private db: Database) {}
 // 📅 Recupera slot disponibili per un artista in un giorno
  async getFreeSlotsInDay(
    artistId: string,
    date: string,         // "YYYY-MM-DD"
    duration: number = 60 // in minuti
  ): Promise<any[]> {
    const openingHour = 9;
    const closingHour = 18;
    const slots: any[] = [];

    const existing = await this.getBookingsByArtistAndDate(artistId, date);
    const takenTimes = new Set(existing.map(b => b.time));

    for (let hour = openingHour; hour <= closingHour - duration / 60; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      if (!takenTimes.has(time)) {
        slots.push({ time });
      }
    }

    return slots;
  }

  // 🔍 Helper: recupera tutte le prenotazioni per artista + data
  private async getBookingsByArtistAndDate(artistId: string, date: string): Promise<{ time: string }[]> {
    const q = query(ref(this.db, 'bookings'), orderByChild('idArtist'), equalTo(artistId));
    const snap = await get(q);
    const bookings: any[] = snap.exists() ? Object.values(snap.val()) : [];

    return bookings.filter(b => b.date === date && b.idArtist === artistId);
  }
  /** Lista TUTTE le prenotazioni in real-time */
  getAllBookings(): Observable<Booking[]> {
    console.log('[BookingService] getAllBookings → subscribe');
    return new Observable(obs => {
      return onValue(ref(this.db, this.path), snap => {
        const list = snap.val()
          ? Object.values<Booking>(snap.val())
          : [];
        console.log('[BookingService] getAllBookings ← next', { count: list.length });
        obs.next(list);
      });
    });
  }

  /** Lista prenotazioni per cliente (real-time) */
  getBookingsByClient(uid: string): Observable<Booking[]> {
    console.log('[BookingService] getBookingsByClient → subscribe', { uid });
    return new Observable(obs => {
      const q = query(
        ref(this.db, this.path),
        orderByChild('idClient'),
        equalTo(uid)
      );
      return onValue(q, snap => {
        const list = snap.val()
          ? Object.values<Booking>(snap.val())
          : [];
        console.log('[BookingService] getBookingsByClient ← next', { uid, count: list.length });
        obs.next(list);
      });
    });
  }

  /**
   * Lista prenotazioni di un giorno (stringa o Date).
   * Usa range "YYYY-MM-DDT00:00:00" → "YYYY-MM-DDT23:59:59\uF8FF"
   */
  getBookingsByDate(day: Date | string): Observable<Booking[]> {
    const dateStr =
      typeof day === 'string'
        ? day.slice(0, 10)
        : day.toISOString().slice(0, 10);
    const startKey = `${dateStr}T00:00:00`;
    const endKey = `${dateStr}T23:59:59\uf8ff`;

    console.log('[BookingService] getBookingsByDate → subscribe', { dateStr, startKey, endKey });

    const q = query(
      ref(this.db, this.path),
      orderByChild('start'),
      startAt(startKey),
      endAt(endKey)
    );

    return new Observable(obs =>
      onValue(q, snap => {
        const list = snap.val()
          ? Object.values<Booking>(snap.val()).sort((a, b) => a.start.localeCompare(b.start))
          : [];
        console.log('[BookingService] getBookingsByDate ← next', { dateStr, count: list.length });
        obs.next(list);
      })
    );
  }

  /** Crea una PRENOTAZIONE DRAFT su RTDB (status='draft') */
  async addDraft(draft: Omit<Booking, 'id' | 'status'>): Promise<string> {
    const node = push(ref(this.db, this.path));
    const payload = { ...draft, id: node.key, status: 'draft' };
    console.log('[BookingService] addDraft →', payload);
    await set(node, payload);
    console.log('[BookingService] addDraft ← id', node.key);
    return node.key!;
  }

  /** Update parziale di una prenotazione (qualsiasi stato) */
  updateBooking(id: string, changes: Partial<Booking>): Promise<void> {
    console.log('[BookingService] updateBooking →', { id, changes });
    return update(ref(this.db, `${this.path}/${id}`), changes);
  }

  /** Cambia lo stato (senza validazione) */
  setStatus(
    id: string,
    status: BookingStatus,
    extra: Partial<Booking> = {}
  ): Promise<void> {
    console.log('[BookingService] setStatus →', { id, status, extra });
    return this.updateBooking(id, { status, ...extra });
  }

  /** Cancella una prenotazione */
  deleteBooking(id: string): Promise<void> {
    console.log('[BookingService] deleteBooking →', { id });
    return remove(ref(this.db, `${this.path}/${id}`));
  }

  /** Leggi 1 prenotazione by id (una tantum) */
  async getBookingById(id: string): Promise<Booking | null> {
    console.log('[BookingService] getBookingById →', { id });
    const snap = await get(ref(this.db, `${this.path}/${id}`));
    const val = snap.exists() ? (snap.val() as Booking) : null;
    console.log('[BookingService] getBookingById ←', val);
    return val;
  }

  /** Osserva 1 prenotazione (real-time) */
  watchBooking(id: string): Observable<Booking | null> {
    console.log('[BookingService] watchBooking → subscribe', { id });
    return new Observable(obs => {
      const r = ref(this.db, `${this.path}/${id}`);
      return onValue(r, s => {
        const v = s.exists() ? (s.val() as Booking) : null;
        console.log('[BookingService] watchBooking ← next', v);
        obs.next(v);
      });
    });
  }

  /** Lista prenotazioni con start === dateIso (match esatto) */
  getBookingsByDay(dateIso: string): Observable<Booking[]> {
    console.log('[BookingService] getBookingsByDay → subscribe', { dateIso });
    return new Observable(obs => {
      const q = query(
        ref(this.db, this.path),
        orderByChild('start'),
        equalTo(dateIso)
      );
      return onValue(q, s => {
        const list = s.val()
          ? Object.values<Booking>(s.val())
          : [];
        console.log('[BookingService] getBookingsByDay ← next', { dateIso, count: list.length });
        obs.next(list);
      });
    });
  }

  /** Somma incassi del mese corrente su prenotazioni 'paid' */
  getTotalRevenueThisMonth(): Observable<number> {
    const [year, month] = new Date().toISOString().split('-');
    console.log('[BookingService] getTotalRevenueThisMonth → subscribe', { year, month });
    return new Observable(obs => {
      onValue(ref(this.db, this.path), snap => {
        const total = snap.val()
          ? Object.values<Booking>(snap.val())
              .filter(b =>
                b.status === 'paid' &&
                b.start.startsWith(`${year}-${month}`)
              )
              .reduce((sum, b) => sum + (b.price || 0), 0)
          : 0;
        console.log('[BookingService] getTotalRevenueThisMonth ← next', { year, month, total });
        obs.next(total);
      });
    });
  }

  /** Placeholder notifica (puoi integrarlo con email/push/webhook) */
  private notify(type: 'rescheduled' | 'cancelled' | 'completed' | 'created', booking: Booking) {
    console.log(`[NOTIFY] Evento: ${type} - Booking ID: ${booking.id}`);
  }

  /** Sposta una prenotazione, con controlli e logging completi */
  async rescheduleBooking(
    id: string,
    newStart: string,
    newEnd: string,
    updater: 'admin' | 'client'
  ): Promise<void> {
    try {
      console.log('[BookingService] rescheduleBooking →', { id, newStart, newEnd, updater });
      const booking = await this.getBookingById(id);
      if (!booking) throw new Error('Prenotazione non trovata');
      if (['completed', 'cancelled'].includes(booking.status)) {
        throw new Error('Non puoi modificare una prenotazione completata o annullata.');
      }

      await this.updateBooking(id, {
        start: newStart,
        end: newEnd,
        updateAt: new Date().toISOString(),
        lastRescheduledAt: new Date().toISOString(),
        rescheduleCount: (booking.rescheduleCount || 0) + 1
      });

      this.notify('rescheduled', { ...booking, start: newStart, end: newEnd });
      console.log('[BookingService] rescheduleBooking ← OK');
    } catch (error) {
      console.error('[BookingService] rescheduleBooking ERROR →', error);
      throw error;
    }
  }

  /** Regole di transizione stato (white-list) */
  private isValidTransition(current: BookingStatus, next: BookingStatus): boolean {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      draft: ['paid', 'cancelled'],
      paid: ['on-going', 'cancelled'],
      'on-going': ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };
    return validTransitions[current]?.includes(next) ?? false;
  }

  /** Cambio stato sicuro (con validazione + log + notify) */
  async safeSetStatus(
    id: string,
    newStatus: BookingStatus,
    extra: Partial<Booking> = {}
  ): Promise<void> {
    try {
      console.log('[BookingService] safeSetStatus →', { id, newStatus, extra });
      const booking = await this.getBookingById(id);
      if (!booking) throw new Error('Prenotazione non trovata');
      if (!this.isValidTransition(booking.status, newStatus)) {
        throw new Error(`Transizione non valida da ${booking.status} a ${newStatus}`);
      }

      await this.setStatus(id, newStatus, extra);
      this.notify(newStatus as any, { ...booking, ...extra });
      console.log('[BookingService] safeSetStatus ← OK');
    } catch (error) {
      console.error('[BookingService] safeSetStatus ERROR →', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers: sanificazione e formattazioni coerenti con le query
  // (teniamo stringhe locali "YYYY-MM-DDTHH:mm:ss" senza 'Z')
  // ─────────────────────────────────────────────────────────────
  private stripUndef<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    Object.keys(o).forEach(k => o[k] !== undefined && (out[k] = o[k]));
    return out;
  }

  private pad(n: number): string { return String(n).padStart(2, '0'); }

  /** Formatta Date → stringa locale "YYYY-MM-DDTHH:mm:ss" (senza Z) */
  private formatLocal(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mm = this.pad(d.getMinutes());
    const ss = this.pad(d.getSeconds());
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }

  /** Somma minuti a una stringa locale "YYYY-MM-DDTHH:mm:ss" */
  private addMinutesLocal(startLocal: string, minutes: number): string {
    const d = new Date(startLocal);
    d.setMinutes(d.getMinutes() + minutes);
    return this.formatLocal(d);
  }

  // ─────────────────────────────────────────────────────────────
  // CREAZIONE DRAFT A PARTIRE DAL CHATBOT
  // ─────────────────────────────────────────────────────────────

  /**
   * Costruisce il payload per addDraft(...) a partire da un draft "bot".
   * NB: se mancano date/ora → lancia un errore (gestiscilo lato UI con prefill).
   */
  buildDraftPayloadFromChat(
    draft: BookingChatDraft,
    params: { idClient: string; clientName?: string }
  ): Omit<Booking, 'id' | 'status'> {
    console.log('[BookingService] buildDraftPayloadFromChat → in', { draft, params });

    const { idClient, clientName } = params;

    if (!draft.date || !draft.time) {
      console.warn('[BookingService] buildDraftPayloadFromChat → missing date/time');
      throw new Error('Draft incompleto: servono "date" e "time" per creare la bozza.');
    }

    // start/end in formato locale (coerente con query per giorno)
    const start = `${draft.date}T${draft.time}:00`;
    const duration = draft.duration && draft.duration > 0 ? draft.duration : 30;
    const end = this.addMinutesLocal(start, duration);

    // payload conforme al modello Booking + sanificazione (mai undefined)
    const payload: Omit<Booking, 'id' | 'status'> = this.stripUndef({
      title: `${clientName || 'Cliente'} - Tattoo`,
      start,
      end,
      idClient,
      description: draft.note || '',
      idArtist: draft.artistId || '',
      createAt: this.formatLocal(new Date()),
      updateAt: this.formatLocal(new Date()),
      price: 0,
      paidAmount: 0
    } as any);

    console.log('[BookingService] buildDraftPayloadFromChat → out', payload);
    return payload;
  }

  /**
   * Scrive SUBITO una prenotazione in stato 'draft' riusando addDraft(...)
   * (ritorna l'id creato su RTDB).
   */
  async addDraftFromChat(
    draft: BookingChatDraft,
    params: { idClient: string; clientName?: string }
  ): Promise<string> {
    const payload = this.buildDraftPayloadFromChat(draft, params);
    console.log('[BookingService] addDraftFromChat → calling addDraft', payload);
    const id = await this.addDraft(payload);
    console.log('[BookingService] addDraftFromChat ← new draft id', id);
    return id;
  }
}
