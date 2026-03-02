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
import { combineLatest, Observable } from 'rxjs';
import { NotificationService } from '../notifications/notification.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { ProjectsService } from '../projects/projects.service';
import { EventsService, StudioEventOccurrence } from '../events/events.service';

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

/** Modello Booking canonico applicativo. */
export interface Booking {
  id: string;

  // ✅ nuovo
  clientId: string;
  artistId: string;
  projectId?: string; // booking può esistere senza project (booking future/consulenze)
  type?: 'consultation' | 'session';
  source?: 'fast-booking' | 'chat-bot' | 'manual';

  title: string;
  start: string; // "YYYY-MM-DDTHH:mm:ss" (locale)
  end: string;   // "YYYY-MM-DDTHH:mm:ss" (locale)
  notes?: string;
  createdById?: string;

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

  eta?: string;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/* =============================================================================
 * BookingDraftService (in-memory)
 * ============================================================================= */
@Injectable({ providedIn: 'root' })
export class BookingDraftService {
  private _draft = signal<BookingChatDraft | null>(null);

  readonly draftSig = this._draft.asReadonly();
  readonly hasDraftSig = computed(() => this._draft() !== null);

  private stripUndef<T extends object>(o: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [k, value] of Object.entries(o)) {
      if (value !== undefined) {
        (out as Record<string, unknown>)[k] = value;
      }
    }
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
  private readonly legacyBookingKeys = ['idClient', 'idArtist', 'description', 'createAt', 'updateAt'] as const;

  constructor(
    private db: Database,
    private notificationService: NotificationService,
    private ui: UiFeedbackService,
    private auth: AuthService,
    private audit: AuditLogService,
    private projects: ProjectsService,
    private eventsService: EventsService
  ) {}

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private ensureStaffPermission(permissionKey: string, missingMessage: string): void {
    const user = this.auth.userSig();
    if (!user) return;
    if (user.role === 'admin') return;
    if (user.role !== 'staff') return;
    if (user.permissions?.[permissionKey] === true) return;

    this.ui.warn(missingMessage);
    throw new Error(`PERMISSION_DENIED:${permissionKey}`);
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const payload = err as { code?: unknown; message?: unknown } | null;
    const code = String(payload?.code ?? '').toLowerCase();
    const msg = String(payload?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('permission denied');
  }

  private getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    const payload = err as { message?: unknown } | null;
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    return fallback;
  }

  private assertNoLegacyBookingKeys(payload: Record<string, unknown>): void {
    const present = this.legacyBookingKeys.filter((k) =>
      Object.prototype.hasOwnProperty.call(payload ?? {}, k)
    );
    if (present.length === 0) return;
    throw new Error(`BOOKING_LEGACY_FIELDS_NOT_ALLOWED:${present.join(',')}`);
  }

  // ---------------------------------------------------------------------------
  // Mappa dati DB -> Booking canonico
  // ---------------------------------------------------------------------------
  private toCanonical(raw: unknown): Booking {
    const source = this.toRecord(raw);
    const createdAt = String(source['createdAt'] ?? new Date().toISOString());
    const updatedAt = String(source['updatedAt'] ?? createdAt);

    const clientId = String(source['clientId'] ?? source['idClient'] ?? '');
    const artistId = String(source['artistId'] ?? source['idArtist'] ?? '');

    const notes = String(source['notes'] ?? '');
    const createdById = String(source['createdById'] ?? source['createdBy'] ?? source['creatorId'] ?? source['creator'] ?? '').trim();

    const b: Booking = {
      ...(source as Partial<Booking>),
      id: String(source['id'] ?? ''),
      title: String(source['title'] ?? ''),
      start: String(source['start'] ?? ''),
      end: String(source['end'] ?? ''),
      clientId,
      artistId,
      notes,
      createdById: createdById || undefined,
      createdAt,
      updatedAt,
      status: (source['status'] as BookingStatus | undefined) ?? 'draft',
      price: Number(source['price'] ?? 0) || 0,
      paidAmount: Number(source['paidAmount'] ?? 0) || 0,
    };

    b.start = this.normalizeLocalDateTime(b.start);
    b.end = this.normalizeLocalDateTime(b.end);

    return b;
  }

  /** patch generico -> patch DB canonico */
  private toDbPatch(patch: Partial<Booking>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(patch as Record<string, unknown>) };

    this.assertNoLegacyBookingKeys(out);

    // normalize times
    if (out['start']) out['start'] = this.normalizeLocalDateTime(String(out['start']));
    if (out['end']) out['end'] = this.normalizeLocalDateTime(String(out['end']));

    return out;
  }

  private normalizeIdCandidate(value: unknown): string {
    if (Array.isArray(value)) {
      const first = value.find(v => typeof v === 'string' && v.trim().length > 0);
      return String(first ?? '').trim();
    }
    return String(value ?? '').trim();
  }

  private getProjectPartyIds(project: unknown): { artistId: string; clientId: string } {
    const source = this.toRecord(project);
    const artistId = this.normalizeIdCandidate(source['artistId']);
    const clientId = this.normalizeIdCandidate(source['clientId']);
    return { artistId, clientId };
  }

  private async buildBookingProjectLinkPatch(params: {
    bookingId: string;
    oldProjectId?: string;
    nextProjectId?: string;
  }): Promise<Record<string, unknown>> {
    const bookingId = String(params.bookingId ?? '').trim();
    const oldProjectId = String(params.oldProjectId ?? '').trim();
    const nextProjectId = String(params.nextProjectId ?? '').trim();
    const now = this.formatLocal(new Date());

    const updates: Record<string, unknown> = {
      [`${this.path}/${bookingId}/projectId`]: nextProjectId || null,
      [`${this.path}/${bookingId}/updatedAt`]: now
    };

    if (oldProjectId && oldProjectId !== nextProjectId) {
      const oldProject = await this.projects.getProjectById(oldProjectId);
      const linkedBookingId = String((oldProject as any)?.bookingId ?? '').trim();
      if (linkedBookingId === bookingId) {
        updates[`projects/${oldProjectId}/bookingId`] = null;
        updates[`projects/${oldProjectId}/updatedAt`] = now;
      }
    }

    if (nextProjectId && oldProjectId !== nextProjectId) {
      updates[`projects/${nextProjectId}/bookingId`] = bookingId;
      updates[`projects/${nextProjectId}/status`] = 'scheduled';
      updates[`projects/${nextProjectId}/updatedAt`] = now;
    }

    return updates;
  }

  private snapshotToList(snapshot: DataSnapshot): Booking[] {
    const data = snapshot.val();
    if (!data) return [];
    // data può essere {id: {...}} o array: gestiamo oggetto
    return Object.entries(data as Record<string, unknown>).map(([key, value]) =>
      this.toCanonical({ id: key, ...this.toRecord(value) })
    );
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
    const eventBlocks = await this.getEventBlockingWindowsForDay(day);

    const slots: { time: string }[] = [];
    const minutesStart = openingHour * 60;
    const minutesEnd = closingHour * 60;

    for (let m = minutesStart; m <= minutesEnd - duration; m += stepMin) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;

      const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const slotStart = `${day}T${time}:00`;
      const slotEnd = this.addMinutesLocal(slotStart, duration);

      const overlapsBooking = existing.some((b) => this.overlapsLocal(slotStart, slotEnd, b.start, b.end));
      const overlapsEvent = eventBlocks.some((w) => this.overlapsLocal(slotStart, slotEnd, w.start, w.end));
      if (!overlapsBooking && !overlapsEvent) slots.push({ time });
    }

    return slots;
  }

  private async getEventBlockingWindowsForDay(day: string): Promise<Array<{ start: string; end: string }>> {
    try {
      const occurrences = await this.eventsService.getBlockingOccurrencesForDate(day);
      return occurrences
        .map((occ) => this.toEventWindowForDay(occ, day))
        .filter((win): win is { start: string; end: string } => Boolean(win));
    } catch (err) {
      if (this.isPermissionDeniedError(err)) return [];
      console.warn('[BookingService] getEventBlockingWindowsForDay failed', err);
      return [];
    }
  }

  private toEventWindowForDay(
    occurrence: StudioEventOccurrence,
    day: string
  ): { start: string; end: string } | null {
    if (day < occurrence.startDate || day > occurrence.endDate) return null;

    const startTime = this.normalizeTime(occurrence.startDate === day ? occurrence.startTime : '00:00', '00:00');
    const endTime = this.normalizeTime(occurrence.endDate === day ? occurrence.endTime : '23:59', '23:59');

    let start = `${day}T${startTime}:00`;
    let end = `${day}T${endTime}:59`;

    const startTs = new Date(this.normalizeLocalDateTime(start)).getTime();
    const endTs = new Date(this.normalizeLocalDateTime(end)).getTime();
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
      start = `${day}T00:00:00`;
      end = `${day}T23:59:59`;
    }

    return { start, end };
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

    let snap: DataSnapshot;
    try {
      snap = await get(qy);
    } catch (err) {
      if (this.isPermissionDeniedError(err)) {
        return [];
      }
      throw err;
    }

    const all: Booking[] = snap.exists()
      ? Object.values(snap.val() as Record<string, unknown>).map(v => this.toCanonical(v))
      : [];

    // booking che NON bloccano slot
    const nonBlocking = new Set<string>(['cancelled', 'annulled', 'no_show']);

    return all
      .filter(b => b.artistId === artistId)
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

  /** Client bookings (supporta clientId + idClient legacy) */
  getBookingsByClient(clientId: string): Observable<Booking[]> {
    const cid = String(clientId ?? '').trim();
    console.log('[BookingService] getBookingsByClient → subscribe', { clientId: cid });
    if (!cid) return new Observable<Booking[]>(obs => { obs.next([]); obs.complete(); });

    return new Observable<Booking[]>(obs => {
      const sub = combineLatest([
        this.queryBookingsByChild('clientId', cid),
        this.queryBookingsByChild('idClient', cid)
      ]).subscribe({
        next: ([modern, legacy]) => {
          const merged = new Map<string, Booking>();
          for (const b of [...modern, ...legacy]) {
            const bid = String((b as any)?.id ?? '').trim();
            if (!bid) continue;
            merged.set(bid, b);
          }
          const list = Array.from(merged.values()).sort((a, b) => a.start.localeCompare(b.start));
          obs.next(list);
        },
        error: err => obs.error(err)
      });
      return () => sub.unsubscribe();
    });
  }

  private queryBookingsByChild(child: string, value: string): Observable<Booking[]> {
    const v = String(value ?? '').trim();
    if (!v) return new Observable<Booking[]>(obs => { obs.next([]); obs.complete(); });
    const qy = query(ref(this.db, this.path), orderByChild(child), equalTo(v));
    return new Observable<Booking[]>(obs => {
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
  async addDraft(draft: Partial<Booking> & Record<string, unknown>): Promise<string> {
    const node = push(ref(this.db, this.path));
    const id = node.key!;
    const now = new Date().toISOString();

    const payload = this.toDbPatch({
      ...draft,
      id,
      status: 'draft',
      createdAt: draft.createdAt ?? now,
      updatedAt: now
    });

    console.log('[BookingService] addDraft →', payload);
    await set(node, payload);
    return id;
  }

  /** Create booking “nuovo” (se vuoi usarlo nei nuovi component) */
  async createBooking(
    data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> & { status?: BookingStatus }
  ): Promise<Booking> {
    this.ensureStaffPermission(
      'canManageBookings',
      'Permesso mancante: gestione prenotazioni.'
    );
    const actor = this.auth.userSig();
    const actorId = String(actor?.uid ?? '').trim() || undefined;
    try {
      const node = push(ref(this.db, this.path));
      const id = node.key!;
      const now = new Date().toISOString();

      // Pre-check project linkage if provided to avoid creating inconsistent data.
      const requestedProjectId = String(data.projectId ?? '').trim();
      let resolvedArtistId = this.normalizeIdCandidate(data.artistId);
      let resolvedClientId = this.normalizeIdCandidate(data.clientId);
      if (requestedProjectId) {
        const project = await this.projects.getProjectById(requestedProjectId);
        if (!project) {
          throw new Error(`PROJECT_NOT_FOUND:${requestedProjectId}`);
        }
        if (project) {
          const existing = String(project.bookingId ?? '').trim();
          if (existing && existing !== id) {
            this.ui.warn(`Il progetto ${requestedProjectId} ha già una prenotazione collegata (${existing}).`);
            throw new Error(`PROJECT_BOOKING_CONFLICT:${requestedProjectId}:${existing}`);
          }

          const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
          if (pArtistId && (!resolvedArtistId || pArtistId !== resolvedArtistId)) {
            this.ui.info('Artista consulenza allineato automaticamente al progetto.');
            resolvedArtistId = pArtistId;
          }
          if (pClientId && (!resolvedClientId || pClientId !== resolvedClientId)) {
            this.ui.info('Cliente consulenza allineato automaticamente al progetto.');
            resolvedClientId = pClientId;
          }
        }
      }

      const payload: Booking = this.toCanonical({
        ...data,
        artistId: resolvedArtistId,
        clientId: resolvedClientId,
        id,
        status: data.status ?? data.status ?? 'draft',
        createdById: actorId,
        createdAt: now,
        updatedAt: now
      });

      const createPatch = this.toDbPatch(payload);
      const projectId = String(payload.projectId ?? '').trim();
      if (projectId) {
        delete createPatch['projectId'];
      }

      await set(node, createPatch);

      // Keep project <-> booking linkage consistent.
      // Invariant: a project can have at most 1 bookingId.
      if (projectId) {
        const project = await this.projects.getProjectById(projectId);
        if (project) {
          const existing = String(project.bookingId ?? '').trim();
          if (existing && existing !== id) {
            this.ui.warn(`Il progetto ${projectId} ha già una prenotazione collegata (${existing}).`);
            await remove(ref(this.db, `${this.path}/${id}`));
            throw new Error(`PROJECT_BOOKING_CONFLICT:${projectId}:${existing}`);
          }
          try {
            const linkPatch = await this.buildBookingProjectLinkPatch({
              bookingId: id,
              nextProjectId: projectId
            });
            await update(ref(this.db), linkPatch);
          } catch (linkError) {
            await remove(ref(this.db, `${this.path}/${id}`));
            throw linkError;
          }
        }
      }

      void this.audit.log({
        action: 'booking.create',
        resource: 'booking',
        resourceId: id,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: payload.clientId,
        meta: { status: payload.status, artistId: payload.artistId }
      });
      void this.notifyBookingCreated(payload);
      this.ui.success('Prenotazione creata');
      return payload;
    } catch (error) {
      void this.audit.log({
        action: 'booking.create',
        resource: 'booking',
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role
      });
      this.ui.error('Errore creazione prenotazione');
      throw error;
    }
  }

  async updateBooking(id: string, changes: Partial<Booking>): Promise<void> {
    this.ensureStaffPermission(
      'canManageBookings',
      'Permesso mancante: gestione prenotazioni.'
    );
    const actor = this.auth.userSig();
    const normalizedChanges: Partial<Booking> = { ...changes };
    try {
      const current = await this.getBookingById(id);
      const oldProjectId = String(current?.projectId ?? '').trim();
      const nextProjectId =
        Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'projectId')
          ? String(normalizedChanges.projectId ?? '').trim()
          : oldProjectId;

      // Pre-check project linkage if requested, before writing.
      if (nextProjectId) {
        const project = await this.projects.getProjectById(nextProjectId);
        if (!project) {
          throw new Error(`PROJECT_NOT_FOUND:${nextProjectId}`);
        }
        if (project) {
          const existing = String(project.bookingId ?? '').trim();
          if (existing && existing !== id) {
            this.ui.warn(`Il progetto ${nextProjectId} ha gia una prenotazione collegata (${existing}).`);
            throw new Error(`PROJECT_BOOKING_CONFLICT:${nextProjectId}:${existing}`);
          }

          const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
          let bArtistId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'artistId')
            ? this.normalizeIdCandidate(normalizedChanges.artistId)
            : this.normalizeIdCandidate(current?.artistId);
          let bClientId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'clientId')
            ? this.normalizeIdCandidate(normalizedChanges.clientId)
            : this.normalizeIdCandidate(current?.clientId);
          if (pArtistId && (!bArtistId || pArtistId !== bArtistId)) {
            this.ui.info('Artista consulenza allineato automaticamente al progetto.');
            bArtistId = pArtistId;
          }
          if (pClientId && (!bClientId || pClientId !== bClientId)) {
            this.ui.info('Cliente consulenza allineato automaticamente al progetto.');
            bClientId = pClientId;
          }
          if (bArtistId) normalizedChanges.artistId = bArtistId;
          if (bClientId) normalizedChanges.clientId = bClientId;
        }
      }

      const patch = this.toDbPatch({
        ...normalizedChanges,
        updatedAt: new Date().toISOString()
      });

      // non cambiare createdAt
      delete patch['createdAt'];
      const hasProjectChange = oldProjectId !== nextProjectId;
      if (hasProjectChange) {
        delete patch['projectId'];
      }

      console.log('[BookingService] updateBooking ->', { id, patch });
      if (Object.keys(patch).length > 0) {
        await update(ref(this.db, `${this.path}/${id}`), patch);
      }

      // Keep booking.projectId and project.bookingId aligned in a single write.
      if (hasProjectChange) {
        const linkPatch = await this.buildBookingProjectLinkPatch({
          bookingId: id,
          oldProjectId,
          nextProjectId
        });
        await update(ref(this.db), linkPatch);
      }

      void this.audit.log({
        action: 'booking.update',
        resource: 'booking',
        resourceId: id,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: current?.clientId,
        meta: { changedKeys: Object.keys(normalizedChanges ?? {}) }
      });

      if (current) {
        const next = this.toCanonical({ ...current, ...normalizedChanges, id });
        void this.notifyBookingUpdated(current, next);
      }

      this.ui.info('Prenotazione aggiornata');
    } catch (error) {
      void this.audit.log({
        action: 'booking.update',
        resource: 'booking',
        resourceId: id,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role,
        meta: { changedKeys: Object.keys(normalizedChanges ?? {}) }
      });
      this.ui.error('Errore aggiornamento prenotazione');
      throw error;
    }
  }

  async deleteBooking(id: string): Promise<void> {
    this.ensureStaffPermission(
      'canManageBookings',
      'Permesso mancante: gestione prenotazioni.'
    );
    const actor = this.auth.userSig();
    try {
      const existing = await this.getBookingById(id);
      const projectId = String(existing?.projectId ?? '').trim();
      const deletePatch: Record<string, unknown> = {
        [`${this.path}/${id}`]: null
      };

      if (projectId) {
        const project = await this.projects.getProjectById(projectId);
        const linkedBookingId = String((project as any)?.bookingId ?? '').trim();
        if (linkedBookingId === id) {
          deletePatch[`projects/${projectId}/bookingId`] = null;
          deletePatch[`projects/${projectId}/updatedAt`] = this.formatLocal(new Date());
        }
      }

      console.log('[BookingService] deleteBooking ->', { id });
      await update(ref(this.db), deletePatch);
      void this.audit.log({
        action: 'booking.delete',
        resource: 'booking',
        resourceId: id,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: existing?.clientId
      });

      if (existing) {
        void this.notifyBookingDeleted(existing);
      }

      this.ui.warn('Prenotazione eliminata');
    } catch (error) {
      void this.audit.log({
        action: 'booking.delete',
        resource: 'booking',
        resourceId: id,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role
      });
      this.ui.error('Errore eliminazione prenotazione');
      throw error;
    }
  }
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
    if (current === next) return true;
    return valid[current]?.includes(next) ?? false;
  }

  async safeSetStatus(id: string, newStatus: BookingStatus, extra: Partial<Booking> = {}): Promise<void> {
    const booking = await this.getBookingById(id);
    if (!booking) throw new Error('Prenotazione non trovata');

    const current = booking.status ?? 'draft';
    const actorRole = String(this.auth.userSig()?.role ?? '').trim().toLowerCase();
    const canBypassTransitionRules = actorRole === 'admin';
    if (!canBypassTransitionRules && !this.isValidTransition(current, newStatus)) {
      throw new Error(`Transizione non valida da ${current} a ${newStatus}`);
    }

    await this.updateBooking(id, { status: newStatus, ...extra });
  }

  async safeSetStatusSafe(
    id: string,
    newStatus: BookingStatus,
    extra: Partial<Booking> = {}
  ): Promise<ServiceResult<void>> {
    try {
      await this.safeSetStatus(id, newStatus, extra);
      return { ok: true, data: undefined };
    } catch (err: unknown) {
      return {
        ok: false,
        error: this.getErrorMessage(err, `Errore aggiornamento stato a ${newStatus}`)
      };
    }
  }

  async rescheduleBooking(
    id: string,
    newStart: string,
    newEnd: string,
    updater: 'admin' | 'client'
  ): Promise<void> {
    this.ensureStaffPermission(
      'canManageBookings',
      'Permesso mancante: gestione prenotazioni.'
    );
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
          ? Object.values(snap.val() as Record<string, unknown>)
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
    params: {
      clientId: string;
      clientName?: string;
      type?: 'consultation' | 'session';
      source?: 'fast-booking' | 'chat-bot' | 'manual';
    }
  ): Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> {
    const { clientId, clientName, type, source } = params;
    const actorId = String(this.auth.userSig()?.uid ?? '').trim() || undefined;

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
      source: source ?? 'chat-bot',

      title: `${clientName || 'Cliente'} - Prenotazione`,
      start,
      end,
      notes: draft.note || '',
      status: 'draft',

      price: 0,
      depositRequired: 0,
      paidAmount: 0,
      createdById: actorId,
    };
  }

  async addDraftFromChat(
    draft: BookingChatDraft,
    params: {
      clientId?: string;
      clientName?: string;
      source?: 'fast-booking' | 'chat-bot' | 'manual';
    }
  ): Promise<string> {
    const clientId = params.clientId ?? '';
    if (!clientId) throw new Error('clientId mancante');

    const payload = this.buildDraftPayloadFromChat(draft, {
      clientId,
      clientName: params.clientName,
      type: 'consultation',
      source: params.source ?? 'chat-bot'
    });

    return this.addDraft(payload);
  }

  async addDraftFromChatSafe(
    draft: BookingChatDraft,
    params: {
      clientId?: string;
      clientName?: string;
      source?: 'fast-booking' | 'chat-bot' | 'manual';
    }
  ): Promise<ServiceResult<string>> {
    try {
      const bookingId = await this.addDraftFromChat(draft, params);
      return { ok: true, data: bookingId };
    } catch (err: unknown) {
      return {
        ok: false,
        error: this.getErrorMessage(err, 'Errore creazione bozza prenotazione')
      };
    }
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

  private normalizeTime(input: string, fallback: string): string {
    const text = String(input ?? '').trim();
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) return text;
    return fallback;
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

  private async notifyBookingCreated(booking: Booking): Promise<void> {
    const startText = this.formatNotificationDate(booking.start);
    const adminIds = await this.getAdminUserIds();

    await this.notifyUsers([booking.clientId], {
      title: 'Prenotazione creata',
      message: `La tua prenotazione e stata creata per ${startText}.`,
      link: '/dashboard/booking-history'
    });

    await this.notifyUsers([booking.artistId], {
      title: 'Nuova prenotazione',
      message: `Nuova consulenza assegnata per ${startText}.`
    });

    await this.notifyUsers(adminIds, {
      title: 'Nuova prenotazione',
      message: `Creata nuova consulenza per ${startText}.`
    });
  }

  private async notifyBookingUpdated(previous: Booking, next: Booking): Promise<void> {
    const statusChanged = previous.status !== next.status;
    const scheduleChanged = previous.start !== next.start || previous.end !== next.end;
    if (!statusChanged && !scheduleChanged) return;
    const adminIds = await this.getAdminUserIds();

    const startText = this.formatNotificationDate(next.start);
    const message = statusChanged
      ? `Stato prenotazione aggiornato a "${next.status}".`
      : `Prenotazione ripianificata per ${startText}.`;

    await this.notifyUsers([next.clientId], {
      title: 'Prenotazione aggiornata',
      message,
      link: '/dashboard/booking-history'
    });

    await this.notifyUsers([next.artistId, ...adminIds], {
      title: 'Prenotazione aggiornata',
      message
    });
  }

  private async notifyBookingDeleted(booking: Booking): Promise<void> {
    const startText = this.formatNotificationDate(booking.start);
    const adminIds = await this.getAdminUserIds();
    void this.notifyUsers([booking.clientId], {
      title: 'Prenotazione cancellata',
      message: `La prenotazione del ${startText} e stata cancellata.`,
      link: '/dashboard/booking-history',
      priority: 'high'
    });

    void this.notifyUsers([booking.artistId, ...adminIds], {
      title: 'Prenotazione cancellata',
      message: `La prenotazione del ${startText} e stata cancellata.`,
      priority: 'high'
    });
  }

  private async notifyUsers(
    userIds: string[],
    payload: {
      title: string;
      message: string;
      link?: string;
      priority?: 'low' | 'normal' | 'high';
    }
  ): Promise<void> {
    const actor = this.auth.userSig();
    const actorId = actor?.uid ?? null;
    const actorRole = actor?.role ?? 'guest';
    const isAdmin = actorRole === 'admin';

    let recipients = [...new Set(userIds.filter(Boolean))];
    if (!isAdmin) {
      // RTDB rules allow writing notifications for own user unless admin.
      recipients = actorId ? recipients.filter(userId => userId === actorId) : [];
    }

    if (recipients.length === 0) return;

    const results = await Promise.allSettled(
      recipients.map(userId =>
        this.notificationService.createForUser(userId, {
          type: 'booking',
          title: payload.title,
          message: payload.message,
          link: payload.link,
          priority: payload.priority ?? 'normal'
        })
      )
    );

    const failures = results
      .map((result, index) => ({ result, userId: recipients[index] }))
      .filter((x): x is { result: PromiseRejectedResult; userId: string } => x.result.status === 'rejected')
      .map(({ result, userId }) => {
        const err = result.reason as { code?: unknown; message?: unknown } | null;
        return {
          userId,
          code: err?.code ?? 'unknown',
          message: err?.message ?? String(err)
        };
      });

    if (failures.length > 0) {
      const permissionDenied = failures.some(f => String(f.code).includes('PERMISSION_DENIED'));
      if (permissionDenied && !isAdmin) {
        console.warn('[BookingService] notifyUsers skipped by RTDB rules for non-admin actor', {
          actorId,
          actorRole,
          failedCount: failures.length
        });
      } else if (permissionDenied) {
        console.warn(
          '[BookingService] RTDB rules stanno bloccando la scrittura notifiche su utenti terzi. Verifica rules su notifications/{userId}.'
        );
        console.error('[BookingService] notifyUsers failed', failures);
      } else {
        console.error('[BookingService] notifyUsers failed', failures);
      }
    }
  }

  private formatNotificationDate(value: string): string {
    const date = new Date(this.normalizeLocalDateTime(value));
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  }

  private async getAdminUserIds(): Promise<string[]> {
    const actor = this.auth.userSig();
    if (actor?.role !== 'admin') return [];

    try {
      const [usersSnap, adminUidsSnap] = await Promise.all([
        get(ref(this.db, 'users')),
        get(ref(this.db, 'adminUids'))
      ]);

      const ids = new Set<string>();
      if (usersSnap.exists()) {
        const users = usersSnap.val() as Record<string, unknown>;
        for (const [uid, row] of Object.entries(users)) {
          if (String(this.toRecord(row)['role'] ?? '').toLowerCase() === 'admin') {
            ids.add(uid);
          }
        }
      }

      if (adminUidsSnap.exists()) {
        const adminUids = adminUidsSnap.val() as Record<string, unknown>;
        for (const [uid, flag] of Object.entries(adminUids)) {
          if (flag === true) ids.add(uid);
        }
      }

      return Array.from(ids);
    } catch (err) {
      console.error('[BookingService] getAdminUserIds error', err);
      return [];
    }
  }
}





