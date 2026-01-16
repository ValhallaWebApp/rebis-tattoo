import { Injectable, signal, computed } from '@angular/core';
import {
  Database,
  ref, push, set, update, remove, get, onValue,
  query, orderByChild, equalTo,
  startAt,
  endAt
} from '@angular/fire/database';
import { Observable } from 'rxjs';

/** Stati consentiti (coerenti con RTDB) */
export type BookingStatus =
  | 'draft'
  | 'paid'
  | 'on-going'
  | 'completed'
  | 'cancelled';

/** Draft leggero che può arrivare dal chatbot / fast-booking */
export interface BookingChatDraft {
  artistId?: string;   // id artista (opzionale)
  date?: string;       // "YYYY-MM-DD"
  time?: string;       // "HH:mm"
  duration?: number;   // minuti (default 30)
  note?: string;       // descrizione
  start?: string;
  end?: string;
}

/** Modello Booking salvato su RTDB */
export interface Booking {
  id: string;
  title: string;
  start: string;       // "YYYY-MM-DDTHH:mm:ss" (locale, senza Z) - ma nel DB possono esserci varianti
  end: string;         // "YYYY-MM-DDTHH:mm:ss" (locale, senza Z) - ma nel DB possono esserci varianti
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
 *  - Ponte in-memory fra chatbot e pagina /bookings (nessuna persistenza)
 *  - Utile per passare un draft “volatile” tra componenti/pagine
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
 *  - Include utilità per creare una bozza da BookingChatDraft
 *  - Include disponibilità slot (robusta su start/end)
 * ==========================================================================*/
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly path = 'bookings';

  constructor(private db: Database) {}

  // ─────────────────────────────────────────────────────────────
  // DISPONIBILITÀ: SLOT LIBERI (ROBUSTO SU start/end)
  // ─────────────────────────────────────────────────────────────

  /**
   * 📅 Recupera slot disponibili per un artista in un giorno.
   *
   * ✅ Funziona con ogni input data:
   *  - "YYYY-MM-DD"
   *  - "YYYY-MM-DDTHH:mm"
   *  - "YYYY-MM-DDTHH:mm:ss"
   *  - "...Z" / ".000Z"
   *
   * ✅ Funziona con i record reali RTDB che hanno start/end (anche con formati misti).
   *
   * @param artistId  id artista (matcha RTDB: idArtist)
   * @param date      giorno (qualunque stringa che contenga almeno YYYY-MM-DD)
   * @param duration  durata in minuti (es 60)
   * @param stepMin   granularità slot (60=ogni ora; 30=ogni mezz'ora)
   */
  async getFreeSlotsInDay(
    artistId: string,
    date: string,
    duration: number = 60,
    stepMin: number = 60
  ): Promise<{ time: string }[]> {
    // Orari "studio" (se vuoi: spostali in config o in Staff schedule)
    const openingHour = 9;
    const closingHour = 18;

    const day = this.normalizeDateOnly(date); // "YYYY-MM-DD"
    if (!day) return [];

    // Range giorno (in locale) usato per query su 'start' (stringa)
    const dayStartLocal = `${day}T00:00:00`;
    const dayEndLocal = `${day}T23:59:59`;

    // 1) carico tutte le booking dell'artista in quel giorno (status "occupanti")
    const existing = await this.getBookingsByArtistAndDayRange(artistId, dayStartLocal, dayEndLocal);

    // 2) genero slot candidati e scarto quelli che overlap con booking esistenti
    const slots: { time: string }[] = [];
    const minutesStart = openingHour * 60;
    const minutesEnd = closingHour * 60;

    for (let m = minutesStart; m <= minutesEnd - duration; m += stepMin) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;

      const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const slotStart = `${day}T${time}:00`;
      const slotEnd = this.addMinutesLocal(slotStart, duration);

      // overlap standard: slotStart < bookingEnd && bookingStart < slotEnd
      const overlaps = existing.some(b => this.overlapsLocal(slotStart, slotEnd, b.start, b.end));
      if (!overlaps) slots.push({ time });
    }

    return slots;
  }

  /**
   * 🔍 Recupera booking esistenti per artista nel range giorno.
   *
   * Nota RTDB:
   * - Possiamo query-are per startAt/endAt su 'start'
   * - Ma non possiamo fare anche filtro composto su idArtist nello stesso query
   *   quindi: query per range -> poi filtro in memoria su idArtist.
   *
   * Stati che NON bloccano slot:
   * - cancelled
   * (puoi aggiungere 'annulled' se esiste nel tuo DB)
   *
   * Stati che bloccano slot:
   * - draft / paid / on-going / completed
   *
   * Includere draft è il fail-safe contro doppie prenotazioni in fase pagamento.
   */
  private async getBookingsByArtistAndDayRange(
    artistId: string,
    dayStartLocal: string, // "YYYY-MM-DDT00:00:00"
    dayEndLocal: string    // "YYYY-MM-DDT23:59:59"
  ): Promise<Booking[]> {
    const q = query(
      ref(this.db, this.path),
      orderByChild('start'),
      startAt(dayStartLocal),
      endAt(`${dayEndLocal}\uf8ff`)
    );

    const snap = await get(q);

    const all: Booking[] = snap.exists()
      ? Object.values<any>(snap.val()).map(v => v as Booking)
      : [];

    // Stati che NON devono occupare slot
    const nonBlocking = new Set<string>(['cancelled', 'annulled']);

    return all
      .filter(b => b?.idArtist === artistId)           // filtro artista
      .filter(b => !!b?.start && !!b?.end)             // devono avere intervallo
      .filter(b => !nonBlocking.has(String(b.status))) // filtro status
      .map(b => ({
        ...b,
        // normalizzo formati per evitare mismatch tra record vecchi/nuovi
        start: this.normalizeLocalDateTime(b.start),
        end: this.normalizeLocalDateTime(b.end),
      }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  // ─────────────────────────────────────────────────────────────
  // CRUD / LISTE
  // ─────────────────────────────────────────────────────────────

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
    const d = new Date(this.normalizeLocalDateTime(startLocal));
    d.setMinutes(d.getMinutes() + minutes);
    return this.formatLocal(d);
  }

  /** Estrae "YYYY-MM-DD" anche se input contiene ora/secondi/Z */
  private normalizeDateOnly(input: string): string {
    if (!input) return '';
    return input.slice(0, 10);
  }

  /**
   * Normalizza qualunque formato a "YYYY-MM-DDTHH:mm:ss" (senza Z),
   * gestendo anche:
   * - "YYYY-MM-DDTHH:mm"
   * - "YYYY-MM-DDTHH:mm:ss"
   * - "YYYY-MM-DDTHH:mm:ss.000Z"
   */
  private normalizeLocalDateTime(input: string): string {
    if (!input) return input;

    // rimuove 'Z' e frazioni di secondo
    let s = String(input).replace('Z', '');
    s = s.split('.')[0];

    const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s);
    const hasMinutesOnly = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

    if (hasMinutesOnly) return `${s}:00`;
    if (hasSeconds) return s;

    // fallback: se arriva qualcosa di strano, prova Date()
    const d = new Date(input);
    if (!isNaN(d.getTime())) return this.formatLocal(d);

    return s;
  }

  /** Overlap tra intervalli locali [aStart,aEnd) e [bStart,bEnd) */
  private overlapsLocal(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const A0 = new Date(this.normalizeLocalDateTime(aStart)).getTime();
    const A1 = new Date(this.normalizeLocalDateTime(aEnd)).getTime();
    const B0 = new Date(this.normalizeLocalDateTime(bStart)).getTime();
    const B1 = new Date(this.normalizeLocalDateTime(bEnd)).getTime();

    // overlap standard
    return A0 < B1 && B0 < A1;
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
      start: this.normalizeLocalDateTime(start),
      end: this.normalizeLocalDateTime(end),
      idClient,
      description: draft.note || '',
      idArtist: draft.artistId || '',
      createAt: this.formatLocal(new Date()),
      updateAt: this.formatLocal(new Date()),
      status: 'draft',
      price: 0,
      paidAmount: 0
    } as any);

    // Nota: status viene impostato da addDraft(...) comunque.
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
