import { Injectable } from '@angular/core';
import { Database, get, onValue, push, ref, remove, set, update } from '@angular/fire/database';
import { Observable, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConfirmActionService } from '../ui/confirm-action.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';

export type StudioEventType = 'guest' | 'open-day';
export type StudioEventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventRecurrenceMode = 'none' | 'interval' | 'weekday';

export interface StudioEvent {
  id: string;
  title: string;
  description: string;
  type: StudioEventType;
  status: StudioEventStatus;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  guestName: string;
  walkInOnly: boolean;
  capacityEnabled: boolean;
  capacity: number;
  featured: boolean;
  priority: number;
  imageUrl: string;
  recurrenceMode: EventRecurrenceMode;
  recurrenceIntervalDays: number;
  recurrenceWeekday: number | null;
  recurrenceUntil: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface StudioEventOccurrence {
  id: string;
  eventId: string;
  title: string;
  description: string;
  type: StudioEventType;
  status: StudioEventStatus;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  guestName: string;
  walkInOnly: boolean;
  featured: boolean;
  priority: number;
  imageUrl: string;
  sourceUpdatedAt: number;
}

type EventCreateInput = Omit<StudioEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
type EventUpdateInput = Partial<EventCreateInput>;

const EVENT_TYPES: readonly StudioEventType[] = ['guest', 'open-day'];
const EVENT_STATUSES: readonly StudioEventStatus[] = ['draft', 'published', 'cancelled', 'completed'];
const RECURRENCE_MODES: readonly EventRecurrenceMode[] = ['none', 'interval', 'weekday'];

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly path = 'events';
  private readonly horizonPastDays = 365;
  private readonly horizonFutureDays = 365;
  private readonly maxOccurrencesPerEvent = 48;

  constructor(
    private db: Database,
    private auth: AuthService,
    private ui: UiFeedbackService,
    private confirmAction: ConfirmActionService
  ) {}

  getEvents(): Observable<StudioEvent[]> {
    return new Observable<StudioEvent[]>((observer) => {
      const node = ref(this.db, this.path);
      const unsub = onValue(
        node,
        (snapshot) => {
          const raw = snapshot.val() as Record<string, unknown> | null;
          const list = raw
            ? Object.entries(raw).map(([id, value]) => this.normalizeEvent(value, id))
            : [];
          observer.next(this.sortEventsForAdmin(list));
        },
        (error) => observer.error(error)
      );
      return () => unsub();
    });
  }

  getPublicTimeline(): Observable<StudioEventOccurrence[]> {
    return this.getEvents().pipe(
      map((events) => this.buildTimeline(events))
    );
  }

  async getEventById(id: string): Promise<StudioEvent | null> {
    const snapshot = await get(ref(this.db, `${this.path}/${id}`));
    if (!snapshot.exists()) return null;
    return this.normalizeEvent(snapshot.val(), id);
  }

  async getBlockingOccurrencesForDate(date: string): Promise<StudioEventOccurrence[]> {
    const day = this.normalizeDate(date, '');
    if (!day) return [];

    try {
      const snapshot = await get(ref(this.db, this.path));
      if (!snapshot.exists()) return [];

      const raw = snapshot.val() as Record<string, unknown>;
      const events = Object.entries(raw).map(([id, value]) => this.normalizeEvent(value, id));
      const timeline = this.buildTimeline(events).filter((occ) => occ.status === 'published');

      return timeline.filter((occ) => occ.startDate <= day && occ.endDate >= day);
    } catch (err) {
      if (this.isPermissionDeniedError(err)) return [];
      throw err;
    }
  }

  addEvent(input: EventCreateInput): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma creazione evento',
        message: 'Vuoi creare questo evento?',
        confirmText: 'Crea',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertManageAction();

        const now = Date.now();
        const newRef = push(ref(this.db, this.path));
        const actorId = String(this.auth.userSig()?.uid ?? '').trim() || 'system';
        const normalized = this.normalizeInput(input);
        const payload = this.normalizeEvent(
          {
            ...normalized,
            id: newRef.key ?? '',
            createdAt: now,
            updatedAt: now,
            createdBy: actorId
          },
          newRef.key ?? ''
        );

        await set(newRef, payload);
        this.ui.success('Evento creato');
      })
      .catch((err) => {
        this.ui.error(this.isPermissionDeniedError(err)
          ? 'Permesso negato: verifica regole RTDB su /events.'
          : 'Errore durante la creazione evento');
        throw err;
      });
  }

  updateEvent(id: string, patch: EventUpdateInput): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma aggiornamento evento',
        message: 'Vuoi salvare le modifiche evento?',
        confirmText: 'Salva',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertManageAction();

        const payload = {
          ...this.normalizeInput(patch),
          updatedAt: Date.now()
        };
        await update(ref(this.db, `${this.path}/${id}`), payload);
        this.ui.success('Evento aggiornato');
      })
      .catch((err) => {
        this.ui.error(this.isPermissionDeniedError(err)
          ? 'Permesso negato: verifica regole RTDB su /events.'
          : 'Errore durante il salvataggio evento');
        throw err;
      });
  }

  setStatus(id: string, status: StudioEventStatus): Promise<void> {
    return this.updateEvent(id, { status });
  }

  deleteEvent(id: string): Promise<void> {
    return this.confirmAction
      .confirm({
        title: 'Conferma eliminazione',
        message: 'Eliminare questo evento?',
        confirmText: 'Elimina',
        cancelText: 'Annulla'
      })
      .then(async (confirmed) => {
        if (!confirmed) return;
        this.assertManageAction();
        await remove(ref(this.db, `${this.path}/${id}`));
        this.ui.warn('Evento eliminato');
      })
      .catch((err) => {
        this.ui.error(this.isPermissionDeniedError(err)
          ? 'Permesso negato: verifica regole RTDB su /events.'
          : 'Errore durante eliminazione evento');
        throw err;
      });
  }

  private assertManageAction(): void {
    const user = this.auth.userSig();
    if (!user) throw new Error('Sessione non valida');
    if (user.role === 'admin') return;
    if (user.role === 'staff' && user.permissions?.['canManageEvents'] === true) return;
    throw new Error('Azione consentita solo ad admin o staff con permesso eventi');
  }

  private normalizeInput(input: Partial<EventCreateInput>): Partial<EventCreateInput> {
    const today = this.toYmd(new Date());
    const startDate = this.normalizeDate(input.startDate, today);
    const endDate = this.normalizeDate(input.endDate, startDate);
    const type = this.toEventType(input.type, 'open-day');
    const recurrenceMode = this.toRecurrenceMode(input.recurrenceMode, 'none');
    const recurrenceIntervalDays = this.toPositiveInt(input.recurrenceIntervalDays, 7);
    const recurrenceWeekday = this.toWeekday(input.recurrenceWeekday);
    const recurrenceUntil = this.normalizeDate(input.recurrenceUntil, '');
    const capacityEnabled = input.capacityEnabled === true;
    const walkInOnly = input.walkInOnly === true;

    return {
      title: String(input.title ?? '').trim(),
      description: String(input.description ?? '').trim(),
      type,
      status: this.toEventStatus(input.status, 'draft'),
      startDate,
      endDate: endDate >= startDate ? endDate : startDate,
      startTime: this.normalizeTime(input.startTime),
      endTime: this.normalizeTime(input.endTime),
      location: String(input.location ?? '').trim(),
      guestName: String(input.guestName ?? '').trim(),
      walkInOnly,
      capacityEnabled,
      capacity: capacityEnabled ? this.toPositiveInt(input.capacity, 0) : 0,
      featured: input.featured === true,
      priority: this.toPositiveInt(input.priority, 0),
      imageUrl: String(input.imageUrl ?? '').trim(),
      recurrenceMode,
      recurrenceIntervalDays: recurrenceMode === 'interval' ? Math.max(1, recurrenceIntervalDays) : 0,
      recurrenceWeekday: recurrenceMode === 'weekday' ? (recurrenceWeekday ?? this.getWeekday(startDate)) : null,
      recurrenceUntil: recurrenceMode === 'none' ? '' : recurrenceUntil
    };
  }

  private normalizeEvent(rawInput: unknown, id: string): StudioEvent {
    const raw = (rawInput ?? {}) as Record<string, unknown>;
    const normalized = this.normalizeInput(raw as Partial<EventCreateInput>);
    const now = Date.now();
    const createdAt = this.toPositiveInt(raw['createdAt'], now);
    const updatedAt = this.toPositiveInt(raw['updatedAt'], createdAt);
    const createdBy = String(raw['createdBy'] ?? '').trim() || 'system';

    return {
      id: String(id).trim(),
      title: String(normalized.title ?? '').trim(),
      description: String(normalized.description ?? '').trim(),
      type: this.toEventType(normalized.type, 'open-day'),
      status: this.toEventStatus(normalized.status, 'draft'),
      startDate: String(normalized.startDate ?? ''),
      endDate: String(normalized.endDate ?? ''),
      startTime: String(normalized.startTime ?? ''),
      endTime: String(normalized.endTime ?? ''),
      location: String(normalized.location ?? '').trim(),
      guestName: String(normalized.guestName ?? '').trim(),
      walkInOnly: normalized.walkInOnly === true,
      capacityEnabled: normalized.capacityEnabled === true,
      capacity: this.toPositiveInt(normalized.capacity, 0),
      featured: normalized.featured === true,
      priority: this.toPositiveInt(normalized.priority, 0),
      imageUrl: String(normalized.imageUrl ?? '').trim(),
      recurrenceMode: this.toRecurrenceMode(normalized.recurrenceMode, 'none'),
      recurrenceIntervalDays: this.toPositiveInt(normalized.recurrenceIntervalDays, 0),
      recurrenceWeekday: this.toWeekday(normalized.recurrenceWeekday),
      recurrenceUntil: String(normalized.recurrenceUntil ?? ''),
      createdAt,
      updatedAt,
      createdBy
    };
  }

  private sortEventsForAdmin(events: StudioEvent[]): StudioEvent[] {
    const nowDate = this.toYmd(new Date());
    return [...events].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;

      const bucketA = this.getTemporalBucket(a.startDate, nowDate);
      const bucketB = this.getTemporalBucket(b.startDate, nowDate);
      if (bucketA !== bucketB) return bucketA - bucketB;

      const tsA = this.toTimestamp(a.startDate, a.startTime);
      const tsB = this.toTimestamp(b.startDate, b.startTime);
      if (bucketA === 2) return tsB - tsA;
      if (tsA !== tsB) return tsA - tsB;
      return b.updatedAt - a.updatedAt;
    });
  }

  private buildTimeline(events: StudioEvent[]): StudioEventOccurrence[] {
    const now = new Date();
    const horizonStart = this.toYmd(this.addDays(now, -this.horizonPastDays));
    const horizonEnd = this.toYmd(this.addDays(now, this.horizonFutureDays));

    const source = events.filter((event) => event.status === 'published' || event.status === 'completed');
    const out: StudioEventOccurrence[] = [];

    for (const event of source) {
      const starts = this.generateOccurrenceStarts(event, horizonStart, horizonEnd);
      const durationDays = Math.max(0, this.diffDays(event.startDate, event.endDate));
      for (const startDate of starts) {
        const endDate = this.addDaysYmd(startDate, durationDays);
        out.push({
          id: `${event.id}__${startDate}`,
          eventId: event.id,
          title: event.title,
          description: event.description,
          type: event.type,
          status: event.status,
          startDate,
          endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          guestName: event.guestName,
          walkInOnly: event.walkInOnly,
          featured: event.featured,
          priority: event.priority,
          imageUrl: event.imageUrl,
          sourceUpdatedAt: event.updatedAt
        });
      }
    }

    return out.sort((a, b) => this.compareTimeline(a, b));
  }

  private compareTimeline(a: StudioEventOccurrence, b: StudioEventOccurrence): number {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;

    const nowTs = Date.now();
    const aTs = this.toTimestamp(a.startDate, a.startTime);
    const bTs = this.toTimestamp(b.startDate, b.startTime);
    const aUpcoming = aTs >= nowTs;
    const bUpcoming = bTs >= nowTs;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming) {
      if (aTs !== bTs) return aTs - bTs;
    } else if (aTs !== bTs) {
      return bTs - aTs;
    }
    return b.sourceUpdatedAt - a.sourceUpdatedAt;
  }

  private generateOccurrenceStarts(event: StudioEvent, horizonStart: string, horizonEnd: string): string[] {
    const starts: string[] = [];
    const capDate = event.recurrenceUntil && event.recurrenceUntil <= horizonEnd
      ? event.recurrenceUntil
      : horizonEnd;

    const pushIfInRange = (date: string): void => {
      if (date < horizonStart || date > horizonEnd) return;
      starts.push(date);
    };

    if (event.recurrenceMode === 'none') {
      pushIfInRange(event.startDate);
      return starts;
    }

    if (event.recurrenceMode === 'interval') {
      let cursor = event.startDate;
      let guard = 0;
      const step = Math.max(1, event.recurrenceIntervalDays || 1);
      while (cursor <= capDate && guard < 800 && starts.length < this.maxOccurrencesPerEvent) {
        pushIfInRange(cursor);
        cursor = this.addDaysYmd(cursor, step);
        guard++;
      }
      return starts;
    }

    const targetWeekday = event.recurrenceWeekday ?? this.getWeekday(event.startDate);
    let cursor = event.startDate;
    while (this.getWeekday(cursor) !== targetWeekday) {
      cursor = this.addDaysYmd(cursor, 1);
    }

    let guard = 0;
    while (cursor <= capDate && guard < 800 && starts.length < this.maxOccurrencesPerEvent) {
      pushIfInRange(cursor);
      cursor = this.addDaysYmd(cursor, 7);
      guard++;
    }
    return starts;
  }

  private toEventType(value: unknown, fallback: StudioEventType): StudioEventType {
    return EVENT_TYPES.includes(value as StudioEventType) ? (value as StudioEventType) : fallback;
  }

  private toEventStatus(value: unknown, fallback: StudioEventStatus): StudioEventStatus {
    return EVENT_STATUSES.includes(value as StudioEventStatus) ? (value as StudioEventStatus) : fallback;
  }

  private toRecurrenceMode(value: unknown, fallback: EventRecurrenceMode): EventRecurrenceMode {
    return RECURRENCE_MODES.includes(value as EventRecurrenceMode) ? (value as EventRecurrenceMode) : fallback;
  }

  private normalizeDate(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return fallback;
    return text;
  }

  private normalizeTime(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ? text : '';
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.round(n));
  }

  private toWeekday(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    return n;
  }

  private toTimestamp(date: string, time: string): number {
    const safeTime = this.normalizeTime(time) || '00:00';
    const d = new Date(`${date}T${safeTime}:00`);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  private toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addDays(date: Date, days: number): Date {
    const clone = new Date(date.getTime());
    clone.setDate(clone.getDate() + days);
    return clone;
  }

  private addDaysYmd(date: string, days: number): string {
    const parsed = new Date(`${date}T12:00:00`);
    parsed.setDate(parsed.getDate() + days);
    return this.toYmd(parsed);
  }

  private diffDays(startDate: string, endDate: string): number {
    const a = new Date(`${startDate}T12:00:00`).getTime();
    const b = new Date(`${endDate}T12:00:00`).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  private getWeekday(date: string): number {
    return new Date(`${date}T12:00:00`).getDay();
  }

  private getTemporalBucket(startDate: string, today: string): number {
    if (startDate > today) return 1;
    if (startDate < today) return 2;
    return 0;
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const code = String((err as { code?: unknown } | null)?.code ?? '').toLowerCase();
    const message = String((err as { message?: unknown } | null)?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || message.includes('permission denied') || message.includes('permission_denied');
  }
}
