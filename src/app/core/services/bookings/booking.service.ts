import { Injectable, computed, signal } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  query,
  orderByChild,
  equalTo,
  startAt,
  endAt,
  DataSnapshot
} from '@angular/fire/database';
import { Observable } from 'rxjs';

/** Stati booking (nuovi + realistici) */
export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Draft leggero che può arrivare dal chatbot / fast-booking */
export interface BookingChatDraft {
  artistId?: string; // id artista
  date?: string;     // "YYYY-MM-DD"
  time?: string;     // "HH:mm"
  duration?: number; // minuti
  note?: string;

  // opzionali (se vuoi far arrivare già slot completi)
  start?: string;
  end?: string;
}

/**
 * Modello Booking salvato su RTDB
 * ✅ Nuovo schema + campi legacy opzionali per compat immediata
 */
export interface Booking {
  id: string;

  // ✅ nuovo
  clientId: string;
  artistId: string;
  projectId?: string; // booking può esistere senza project (booking future/consulenze)
  type?: 'consultation' | 'session';

  title: string;
  start: string; // "YYYY-MM-DDTHH:mm:ss" (locale)
  end: string;   // "YYYY-MM-DDTHH:mm:ss" (locale)
  notes?: string;

  status: BookingStatus;

  price?: number;          // totale previsto
  depositRequired?: number;
  paidAmount?: number;

  createdAt: string;
  updatedAt: string;

  cancelledBy?: 'admin' | 'client';
  cancelReason?: string;
  rescheduleCount?: number;
  lastRescheduledAt?: string;

  // ✅ legacy (per non rompere UI/feature esistenti)
  idClient?: string;
  idArtist?: string;
  description?: string;
  createAt?: string;
  updateAt?: string;
  eta?: string;
}

/* =============================================================================
 * BookingDraftService (in-memory)
 * ============================================================================= */
@Injectable({ providedIn: 'root' })
export class BookingDraftService {
  private _draft = signal<BookingChatDraft | null>(null);

  readonly draftSig = this._draft.asReadonly();
  readonly hasDraftSig = computed(() => this._draft() !== null);

  private stripUndef<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k];
    return out;
  }

  setDraft(draft: BookingChatDraft, opts: { merge?: boolean } = {}): void {
    const clean = this.stripUndef(draft);
    const prev = this._draft();
    const next = opts.merge && prev ? { ...prev, ...clean } : clean;
    console.log('[BookingDraftService] setDraft →', { prev, incoming: clean, merge: !!opts.merge, next });
    this._draft.set(next);
  }

  patchDraft(patch: Partial<BookingChatDraft>): void {
    const prev = this._draft();
    const next = { ...(prev || {}), ...this.stripUndef(patch) };
    console.log('[BookingDraftService] patchDraft →', { prev, patch, next });
    this._draft.set(next);
  }

  consume(): BookingChatDraft | null {
    const d = this._draft();
    this._draft.set(null);
    console.log('[BookingDraftService] consume →', d);
    return d;
  }

  reset(): void {
    console.log('[BookingDraftService] reset');
    this._draft.set(null);
  }
}

/* =============================================================================
 * BookingService
 * ============================================================================= */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly path = 'bookings';

  constructor(private db: Database) {}

  // ---------------------------------------------------------------------------
  // COMPAT: mappa dati DB (vecchi/nuovi) -> Booking canonico
  // ---------------------------------------------------------------------------
  private toCanonical(raw: any): Booking {
    const createdAt = raw.createdAt ?? raw.createAt ?? new Date().toISOString();
    const updatedAt = raw.updatedAt ?? raw.updateAt ?? createdAt;

    const clientId = raw.clientId ?? raw.idClient ?? '';
    const artistId = raw.artistId ?? raw.idArtist ?? '';

    const notes = raw.notes ?? raw.description ?? '';

    const b: Booking = {
      ...raw,
      clientId,
      artistId,
      notes,
      createdAt,
      updatedAt,

      // legacy mirror per UI vecchie
      idClient: raw.idClient ?? clientId,
      idArtist: raw.idArtist ?? artistId,
      description: raw.description ?? notes,
      createAt: raw.createAt ?? createdAt,
      updateAt: raw.updateAt ?? updatedAt,
    };

    b.start = this.normalizeLocalDateTime(b.start);
    b.end = this.normalizeLocalDateTime(b.end);

    // defaults hardening
    b.status = (b.status ?? 'draft') as BookingStatus;
    b.price = b.price ?? 0;
    b.paidAmount = b.paidAmount ?? 0;

    return b;
  }

  /** patch generico -> patch per DB coerente (scrive anche legacy per retrocompat) */
  private toDbPatch(patch: Partial<Booking>): any {
    const out: any = { ...patch };

    // legacy -> new
    if (out.idClient && !out.clientId) out.clientId = out.idClient;
    if (out.idArtist && !out.artistId) out.artistId = out.idArtist;
    if (out.description && !out.notes) out.notes = out.description;
    if (out.createAt && !out.createdAt) out.createdAt = out.createAt;
    if (out.updateAt && !out.updatedAt) out.updatedAt = out.updateAt;

    // new -> legacy
    if (out.clientId && !out.idClient) out.idClient = out.clientId;
    if (out.artistId && !out.idArtist) out.idArtist = out.artistId;
    if (out.notes && !out.description) out.description = out.notes;
    if (out.createdAt && !out.createAt) out.createAt = out.createdAt;
    if (out.updatedAt && !out.updateAt) out.updateAt = out.updatedAt;

    // normalize times
    if (out.start) out.start = this.normalizeLocalDateTime(out.start);
    if (out.end) out.end = this.normalizeLocalDateTime(out.end);

    return out;
  }

  private snapshotToList(snapshot: DataSnapshot): Booking[] {
    const data = snapshot.val();
    if (!data) return [];
    // data può essere {id: {...}} o array: gestiamo oggetto
    return Object.entries<any>(data).map(([key, value]) => this.toCanonical({ id: key, ...value }));
  }

  // ---------------------------------------------------------------------------
  // AVAILABILITY: SLOT LIBERI (robusto)
  // ---------------------------------------------------------------------------
  async getFreeSlotsInDay(
    artistId: string,
    date: string,
    duration: number = 60,
    stepMin: number = 60
  ): Promise<{ time: string }[]> {
    const openingHour = 9;
    const closingHour = 18;

    const day = this.normalizeDateOnly(date);
    if (!day) return [];

    const dayStartLocal = `${day}T00:00:00`;
    const dayEndLocal = `${day}T23:59:59`;

    const existing = await this.getBookingsByArtistAndDayRange(artistId, dayStartLocal, dayEndLocal);

    const slots: { time: string }[] = [];
    const minutesStart = openingHour * 60;
    const minutesEnd = closingHour * 60;

    for (let m = minutesStart; m <= minutesEnd - duration; m += stepMin) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;

      const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const slotStart = `${day}T${time}:00`;
      const slotEnd = this.addMinutesLocal(slotStart, duration);

      const overlaps = existing.some(b => this.overlapsLocal(slotStart, slotEnd, b.start, b.end));
      if (!overlaps) slots.push({ time });
    }

    return slots;
  }

  private async getBookingsByArtistAndDayRange(
    artistId: string,
    dayStartLocal: string,
    dayEndLocal: string
  ): Promise<Booking[]> {
    const qy = query(
      ref(this.db, this.path),
      orderByChild('start'),
      startAt(dayStartLocal),
      endAt(`${dayEndLocal}\uf8ff`)
    );

    const snap = await get(qy);

    const all: Booking[] = snap.exists()
      ? Object.values<any>(snap.val()).map(v => this.toCanonical(v))
      : [];

    // booking che NON bloccano slot
    const nonBlocking = new Set<string>(['cancelled', 'annulled', 'no_show']);

    return all
      .filter(b => (b.artistId || b.idArtist) === artistId)
      .filter(b => !!b.start && !!b.end)
      .filter(b => !nonBlocking.has(String(b.status)))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  // ---------------------------------------------------------------------------
  // CRUD / WATCH
  // ---------------------------------------------------------------------------
  getAllBookings(): Observable<Booking[]> {
    console.log('[BookingService] getAllBookings → subscribe');
    return new Observable(obs => {
      const unsub = onValue(
        ref(this.db, this.path),
        snap => {
          const list = snap.exists() ? this.snapshotToList(snap) : [];
          console.log('[BookingService] getAllBookings ← next', { count: list.length });
          obs.next(list);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  /** Client bookings (nuovo campo: clientId) */
  getBookingsByClient(clientId: string): Observable<Booking[]> {
    console.log('[BookingService] getBookingsByClient → subscribe', { clientId });
    return new Observable(obs => {
      const qy = query(ref(this.db, this.path), orderByChild('clientId'), equalTo(clientId));
      const unsub = onValue(
        qy,
        snap => {
          const list = snap.exists() ? this.snapshotToList(snap) : [];
          obs.next(list);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  /** Artist bookings (nuovo campo: artistId) */
  getBookingsByArtist(artistId: string): Observable<Booking[]> {
    return new Observable(obs => {
      const qy = query(ref(this.db, this.path), orderByChild('artistId'), equalTo(artistId));
      const unsub = onValue(
        qy,
        snap => {
          const list = snap.exists() ? this.snapshotToList(snap) : [];
          obs.next(list);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  /** Booking by day (range su start) */
  getBookingsByDate(day: Date | string): Observable<Booking[]> {
    const dateStr =
      typeof day === 'string'
        ? day.slice(0, 10)
        : day.toISOString().slice(0, 10);

    const startKey = `${dateStr}T00:00:00`;
    const endKey = `${dateStr}T23:59:59\uf8ff`;

    const qy = query(ref(this.db, this.path), orderByChild('start'), startAt(startKey), endAt(endKey));

    return new Observable(obs => {
      const unsub = onValue(
        qy,
        snap => {
          const list = snap.exists()
            ? this.snapshotToList(snap).sort((a, b) => a.start.localeCompare(b.start))
            : [];
          obs.next(list);
        },
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  async getBookingById(id: string): Promise<Booking | null> {
    const snap = await get(ref(this.db, `${this.path}/${id}`));
    if (!snap.exists()) return null;
    const val = snap.val();
    return this.toCanonical({ id, ...val });
  }

  watchBooking(id: string): Observable<Booking | null> {
    return new Observable(obs => {
      const r = ref(this.db, `${this.path}/${id}`);
      const unsub = onValue(
        r,
        s => obs.next(s.exists() ? this.toCanonical({ id, ...s.val() }) : null),
        err => obs.error(err)
      );
      return () => unsub();
    });
  }

  // ---------------------------------------------------------------------------
  // COMPAT: addDraft (vecchio codice lo usa ovunque)
  // ---------------------------------------------------------------------------
  async addDraft(draft: any): Promise<string> {
    const node = push(ref(this.db, this.path));
    const id = node.key!;
    const now = new Date().toISOString();

    const payload = this.toDbPatch({
      ...draft,
      id,
      status: 'draft',
      createdAt: draft.createdAt ?? draft.createAt ?? now,
      updatedAt: now
    } as any);

    console.log('[BookingService] addDraft →', payload);
    await set(node, payload);
    return id;
  }

  /** Create booking “nuovo” (se vuoi usarlo nei nuovi component) */
  async createBooking(
    data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> & { status?: BookingStatus }
  ): Promise<Booking> {
    const node = push(ref(this.db, this.path));
    const id = node.key!;
    const now = new Date().toISOString();

    const payload: Booking = this.toCanonical({
      ...data,
      id,
      status: data.status ?? data.status ?? 'draft',
      createdAt: now,
      updatedAt: now
    });

    await set(node, this.toDbPatch(payload));
    return payload;
  }

  async updateBooking(id: string, changes: Partial<Booking>): Promise<void> {
    const patch = this.toDbPatch({
      ...changes,
      updatedAt: new Date().toISOString()
    });

    // non cambiare createdAt
    delete patch.createdAt;
    delete patch.createAt;

    console.log('[BookingService] updateBooking →', { id, patch });
    await update(ref(this.db, `${this.path}/${id}`), patch);
  }

  async deleteBooking(id: string): Promise<void> {
    console.log('[BookingService] deleteBooking →', { id });
    await remove(ref(this.db, `${this.path}/${id}`));
  }

  // ---------------------------------------------------------------------------
  // STATUS / RESCHEDULE
  // ---------------------------------------------------------------------------
  private isValidTransition(current: BookingStatus, next: BookingStatus): boolean {
    const valid: Record<BookingStatus, BookingStatus[]> = {
      draft: ['pending', 'confirmed', 'cancelled'],
      pending: ['confirmed', 'cancelled'],
      confirmed: ['paid', 'cancelled', 'no_show', 'in_progress'],
      paid: ['in_progress', 'cancelled', 'no_show'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      no_show: []
    };
    return valid[current]?.includes(next) ?? false;
  }

  async safeSetStatus(id: string, newStatus: BookingStatus, extra: Partial<Booking> = {}): Promise<void> {
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error('Prenotazione non trovata');

    const current = booking.status ?? 'draft';
    if (!this.isValidTransition(current, newStatus)) {
      throw new Error(`Transizione non valida da ${current} a ${newStatus}`);
    }

    await this.updateBooking(id, { status: newStatus, ...extra });
  }

  async rescheduleBooking(
    id: string,
    newStart: string,
    newEnd: string,
    updater: 'admin' | 'client'
  ): Promise<void> {
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error('Prenotazione non trovata');

    if (['completed', 'cancelled', 'no_show'].includes(booking.status)) {
      throw new Error('Non puoi modificare una prenotazione chiusa.');
    }

    await this.updateBooking(id, {
      start: newStart,
      end: newEnd,
      lastRescheduledAt: new Date().toISOString(),
      rescheduleCount: (booking.rescheduleCount || 0) + 1,
    });

    console.log('[BookingService] rescheduleBooking OK', { id, updater });
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS: mese corrente (usato in admin-dashboard)
  // ---------------------------------------------------------------------------
  getTotalRevenueThisMonth(): Observable<number> {
    const [year, month] = new Date().toISOString().split('-');

    return new Observable(obs => {
      const unsub = onValue(ref(this.db, this.path), snap => {
        const total = snap.val()
          ? Object.values<any>(snap.val())
              .map(v => this.toCanonical(v))
              .filter(b => b.status === 'paid' && b.start.startsWith(`${year}-${month}`))
              .reduce((sum, b) => sum + (b.price ?? 0), 0)
          : 0;

        obs.next(total);
      });
      return () => unsub();
    });
  }

  // ---------------------------------------------------------------------------
  // CHATBOT / FAST BOOKING COMPAT: addDraftFromChat (vecchio codice lo usa)
  // ---------------------------------------------------------------------------
  buildDraftPayloadFromChat(
    draft: BookingChatDraft,
    params: { clientId: string; clientName?: string; type?: 'consultation' | 'session' }
  ): Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> {
    const { clientId, clientName, type } = params;

    let start = draft.start ? this.normalizeLocalDateTime(draft.start) : '';
    let end = draft.end ? this.normalizeLocalDateTime(draft.end) : '';

    if (!start || !end) {
      if (!draft.date || !draft.time) {
        throw new Error('Draft incompleto: servono "date" e "time".');
      }
      start = this.normalizeLocalDateTime(`${draft.date}T${draft.time}:00`);
      const duration = draft.duration && draft.duration > 0 ? draft.duration : 30;
      end = this.addMinutesLocal(start, duration);
    }

    return {
      clientId,
      artistId: draft.artistId || '',
      type: type ?? 'consultation',

      title: `${clientName || 'Cliente'} - Prenotazione`,
      start,
      end,
      notes: draft.note || '',
      status: 'draft',

      price: 0,
      depositRequired: 0,
      paidAmount: 0,

      // legacy mirror utile se qualcuno usa description/idClient/idArtist
      idClient: clientId,
      idArtist: draft.artistId || '',
      description: draft.note || '',
    } as any;
  }

  async addDraftFromChat(
    draft: BookingChatDraft,
    params: { idClient?: string; clientId?: string; clientName?: string }
  ): Promise<string> {
    const clientId = params.clientId ?? params.idClient ?? '';
    if (!clientId) throw new Error('clientId mancante');

    const payload = this.buildDraftPayloadFromChat(draft, {
      clientId,
      clientName: params.clientName,
      type: 'consultation'
    });

    return this.addDraft(payload);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private pad(n: number): string { return String(n).padStart(2, '0'); }

  /** Date -> locale "YYYY-MM-DDTHH:mm:ss" */
  private formatLocal(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mm = this.pad(d.getMinutes());
    const ss = this.pad(d.getSeconds());
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }

  private addMinutesLocal(startLocal: string, minutes: number): string {
    const d = new Date(this.normalizeLocalDateTime(startLocal));
    d.setMinutes(d.getMinutes() + minutes);
    return this.formatLocal(d);
  }

  private normalizeDateOnly(input: string): string {
    if (!input) return '';
    return input.slice(0, 10);
  }

  /**
   * Normalizza a "YYYY-MM-DDTHH:mm:ss" (senza Z)
   * gestendo anche ".000Z" ecc.
   */
  private normalizeLocalDateTime(input: string): string {
    if (!input) return input;

    let s = String(input).replace('Z', '');
    s = s.split('.')[0];

    const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s);
    const hasMinutesOnly = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

    if (hasMinutesOnly) return `${s}:00`;
    if (hasSeconds) return s;

    const d = new Date(input);
    if (!isNaN(d.getTime())) return this.formatLocal(d);

    return s;
  }

  private overlapsLocal(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const A0 = new Date(this.normalizeLocalDateTime(aStart)).getTime();
    const A1 = new Date(this.normalizeLocalDateTime(aEnd)).getTime();
    const B0 = new Date(this.normalizeLocalDateTime(bStart)).getTime();
    const B1 = new Date(this.normalizeLocalDateTime(bEnd)).getTime();
    return A0 < B1 && B0 < A1;
  }
}
