import { Injectable, NgZone, inject } from '@angular/core';
import {
  Database,
  ref,
  push,
  set,
  update,
  remove,
  get,
  query,
  orderByChild,
  equalTo,
  onValue
} from '@angular/fire/database';
import { catchError, combineLatest, map, Observable, of } from 'rxjs';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuthService } from '../auth/auth.service';
import { ProjectsService } from '../projects/projects.service';
import { BookingService } from '../bookings/booking.service';
import { MediaAsset } from '../../models/media-asset.model';

/** ✅ CANONICO APP (NUOVO) */
export interface Session {
  id?: string;

  artistId: string;     // ✅ nuovo
  clientId?: string;    // ✅ nuovo

  start: string;        // "YYYY-MM-DDTHH:mm:ss" locale (meglio)
  end: string;

  projectId?: string;
  bookingId?: string;

  sessionNumber?: number;
  notesByAdmin?: string;

  price?: number;
  paidAmount?: number;

  zone?:string;
  painLevel?: number;
  healingNotes?: string;
  photoUrlList?: string[];
  gallery?: MediaAsset[];
  beforeImage?: MediaAsset | null;
  afterImage?: MediaAsset | null;
  referenceImages?: MediaAsset[];

  status: 'planned' | 'completed' | 'cancelled';



  createdAt: string;
  updatedAt: string;
}


@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly path = 'sessions';

  private readonly db = inject(Database);
  private readonly ui = inject(UiFeedbackService);
  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  private readonly projects = inject(ProjectsService);
  private readonly bookings = inject(BookingService);

  private ensureStaffPermission(permissionKey: string, missingMessage: string): void {
    const user = this.auth.userSig();
    if (!user) return;
    if (user.role === 'admin') return;
    if (user.role !== 'staff') return;
    if (user.permissions?.[permissionKey] === true) return;

    this.showMessage(missingMessage, true);
    throw new Error(`PERMISSION_DENIED:${permissionKey}`);
  }

  // -----------------------------
  // PUBLIC API (NUOVO)
  // -----------------------------

  /** Real-time oppure one-shot (scegli) */
  getAll(opts: { onlyOnce?: boolean } = {}): Observable<Session[]> {
    const sessionsRef = ref(this.db, this.path);
    return new Observable<Session[]>(obs => {
      const unsub = onValue(
        sessionsRef,
        snap => {
          this.zone.run(() => {
            const list = snap.exists()
              ? Object.entries<any>(snap.val()).map(([key, v]) => this.fromDb({ id: key, ...v }))
              : [];
            obs.next(list);
          });
        },
        err => this.zone.run(() => obs.error(err)),
        { onlyOnce: !!opts.onlyOnce }
      );

      return () => unsub();
    });
  }

  async create(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Session, 'createdAt' | 'updatedAt'>>): Promise<string> {
    this.ensureStaffPermission(
      'canManageSessions',
      'Permesso mancante: gestione sedute.'
    );
    try {
      let projectId = String((session as any)?.projectId ?? '').trim();
      let resolvedArtistId = this.normalizeIdCandidate((session as any)?.artistId);
      let resolvedClientId = this.normalizeIdCandidate((session as any)?.clientId);
      if (!projectId) {
      }

      if (projectId) {
        const project = await this.projects.getProjectById(projectId);
        if (!project) {
          this.showMessage('Progetto non trovato: impossibile creare la seduta.', true);
          throw new Error(`PROJECT_NOT_FOUND:${projectId}`);
        }
        const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
        if (pArtistId && (!resolvedArtistId || pArtistId !== resolvedArtistId)) {
          this.showMessage('Artista della seduta allineato automaticamente al progetto.');
          resolvedArtistId = pArtistId;
        }
        if (pClientId && (!resolvedClientId || pClientId !== resolvedClientId)) {
          this.showMessage('Cliente della seduta allineato automaticamente al progetto.');
          resolvedClientId = pClientId;
        }
      }

      if (projectId) {
        const start = String((session as any)?.start ?? '').trim();
        await this.ensureSessionStartsAfterProjectBooking(projectId, start);
      }

      const node = push(ref(this.db, this.path));
      const now = this.formatLocal(new Date());

      const payloadApp: Session = {
        ...(session as any),
        artistId: resolvedArtistId,
        clientId: resolvedClientId || undefined,
        id: node.key!,
        projectId: projectId || (session as any).projectId || undefined,
        createdAt: session.createdAt ?? now,
        updatedAt: session.updatedAt ?? now,
        status: (session as any).status ?? 'planned'
      };

      await set(node, this.toDb(payloadApp));

      if (projectId) {
        await this.projects.addSession(projectId, node.key!);
      }

      this.showMessage('Seduta creata con successo');
      return node.key!;
    } catch (error) {
      if (String((error as any)?.message ?? '').startsWith('SESSION_')) {
        throw error;
      }
      console.error('Errore creazione seduta:', error);
      this.showMessage('Errore durante la creazione della seduta', true);
      throw error;
    }
  }

  async update(id: string, changes: Partial<Session>): Promise<void> {
    this.ensureStaffPermission(
      'canManageSessions',
      'Permesso mancante: gestione sedute.'
    );
    const normalizedChanges: Partial<Session> = { ...changes };
    try {
      const current = await this.getSessionById(id);
      const oldProjectId = String((current as any)?.projectId ?? '').trim();
      const nextProjectId =
        Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'projectId')
          ? String((normalizedChanges as any).projectId ?? '').trim()
          : oldProjectId;

      // Validate against project if linked.
      if (nextProjectId) {
        const project = await this.projects.getProjectById(nextProjectId);
        if (!project) {
          this.showMessage('Progetto non trovato: impossibile aggiornare la seduta.', true);
          throw new Error(`PROJECT_NOT_FOUND:${nextProjectId}`);
        }
        const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
        let sArtistId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'artistId')
          ? this.normalizeIdCandidate((normalizedChanges as any).artistId)
          : this.normalizeIdCandidate((current as any)?.artistId);
        let sClientId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'clientId')
          ? this.normalizeIdCandidate((normalizedChanges as any).clientId)
          : this.normalizeIdCandidate((current as any)?.clientId);

        if (pArtistId && (!sArtistId || pArtistId !== sArtistId)) {
          this.showMessage('Artista della seduta allineato automaticamente al progetto.');
          sArtistId = pArtistId;
        }
        if (pClientId && (!sClientId || pClientId !== sClientId)) {
          this.showMessage('Cliente della seduta allineato automaticamente al progetto.');
          sClientId = pClientId;
        }
        if (sArtistId) (normalizedChanges as any).artistId = sArtistId;
        if (sClientId) (normalizedChanges as any).clientId = sClientId;
      }

      if (nextProjectId) {
        const nextStart = String(
          Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'start')
            ? (normalizedChanges as any).start
            : (current as any)?.start ?? ''
        ).trim();
        await this.ensureSessionStartsAfterProjectBooking(nextProjectId, nextStart);
      }

      const patchDb = this.toDbPatch({
        ...normalizedChanges,
        updatedAt: this.formatLocal(new Date())
      });

      await update(ref(this.db, `${this.path}/${id}`), patchDb);

      // Sync project.sessionIds if projectId changed (or removed).
      if (oldProjectId && oldProjectId !== nextProjectId) {
        await this.projects.removeSession(oldProjectId, id);
      }
      if (nextProjectId) {
        await this.projects.addSession(nextProjectId, id);
      }

      this.showMessage('Seduta aggiornata con successo');
    } catch (error) {
      if (String((error as any)?.message ?? '').startsWith('SESSION_')) {
        throw error;
      }
      console.error('Errore aggiornamento seduta:', error);
      this.showMessage("Errore durante l'aggiornamento della seduta", true);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.ensureStaffPermission(
      'canManageSessions',
      'Permesso mancante: gestione sedute.'
    );
    try {
      const current = await this.getSessionById(id);
      const projectId = String((current as any)?.projectId ?? '').trim();
      if (projectId) {
        await this.projects.removeSession(projectId, id);
      }
      await remove(ref(this.db, `${this.path}/${id}`));
      this.showMessage('Seduta eliminata con successo');
    } catch (error) {
      console.error('Errore eliminazione seduta:', error);
      this.showMessage("Errore durante l'eliminazione della seduta", true);
      throw error;
    }
  }

  getSessionsByArtist(artistId: string): Observable<Session[]> {
    return this.querySessionsByChild('artistId', artistId);
  }

  getSessionsByClient(clientId: string): Observable<Session[]> {
    const cid = String(clientId ?? '').trim();
    if (!cid) return new Observable<Session[]>(obs => { obs.next([]); obs.complete(); });

    const byClientId$ = this.querySessionsByChild('clientId', cid);
    const byLegacyClientId$ = this.querySessionsByChild('idClient', cid);

    return new Observable<Session[]>(obs => {
      const sub = combineLatest([byClientId$, byLegacyClientId$]).subscribe({
        next: ([modern, legacy]) => {
          const merged = new Map<string, Session>();

          for (const s of [...modern, ...legacy]) {
            const sid = String((s as any)?.id ?? '').trim();
            if (!sid) continue;
            merged.set(sid, s);
          }

          const list = Array.from(merged.values()).sort(
            (a, b) => new Date((a as any).start).getTime() - new Date((b as any).start).getTime()
          );
          obs.next(list);
        },
        error: err => obs.error(err)
      });

      return () => sub.unsubscribe();
    });
  }

  getSessionsByBooking(bookingId: string): Observable<Session[]> {
    return this.querySessionsByChild('bookingId', bookingId);
  }

  getSessionsByClientWithBookingFallback(clientId: string, bookingIds: string[], projectIds: string[] = []): Observable<Session[]> {
    const cid = String(clientId ?? '').trim();
    const ids = Array.from(new Set((bookingIds ?? []).map(x => String(x ?? '').trim()).filter(Boolean)));
    const pids = Array.from(new Set((projectIds ?? []).map(x => String(x ?? '').trim()).filter(Boolean)));
    if (!cid && ids.length === 0 && pids.length === 0) return new Observable<Session[]>(obs => { obs.next([]); obs.complete(); });

    const streams: Observable<Session[]>[] = [];
    if (cid) {
      streams.push(this.querySessionsByChild('clientId', cid).pipe(catchError(() => of([] as Session[]))));
      streams.push(this.querySessionsByChild('idClient', cid).pipe(catchError(() => of([] as Session[]))));
    }
    for (const bid of ids) {
      streams.push(this.querySessionsByChild('bookingId', bid).pipe(catchError(() => of([] as Session[]))));
    }
    for (const pid of pids) {
      streams.push(this.querySessionsByChild('projectId', pid).pipe(catchError(() => of([] as Session[]))));
    }

    return combineLatest(streams).pipe(
      map((chunks) => {
        const merged = new Map<string, Session>();
        for (const list of chunks) {
          for (const s of list ?? []) {
            const sid = String((s as any)?.id ?? '').trim();
            if (!sid) continue;
            merged.set(sid, s);
          }
        }
        return Array.from(merged.values()).sort(
          (a, b) => new Date((a as any).start).getTime() - new Date((b as any).start).getTime()
        );
      })
    );
  }

  getSessionsByProject(projectId: string): Observable<Session[]> {
    return this.querySessionsByChild('projectId', projectId);
  }

  private querySessionsByChild(child: string, value: string): Observable<Session[]> {
    const v = String(value ?? '').trim();
    if (!v) return new Observable<Session[]>(obs => { obs.next([]); obs.complete(); });
    const q = query(ref(this.db, this.path), orderByChild(child), equalTo(v));

    return new Observable<Session[]>(obs => {
      const unsub = onValue(
        q,
        snap => {
          this.zone.run(() => {
            const list = snap.exists()
              ? Object.entries<any>(snap.val()).map(([key, v]) => this.fromDb({ id: key, ...v }))
              : [];
            obs.next(list);
          });
        },
        err => this.zone.run(() => obs.error(err))
      );
      return () => unsub();
    });
  }

  async getSessionById(id: string): Promise<Session | null> {
    const snap = await get(ref(this.db, `${this.path}/${id}`));
    if (!snap.exists()) return null;
    const val = snap.val() as any;
    return this.fromDb({ id, ...val });
  }

  // -----------------------------
  // MAPPERS (DB legacy <-> APP nuovo)
  // -----------------------------
  private fromDb(dbRow: any): Session {
    // supporto robusto: se in futuro migri e trovi già artistId, lo uso.
    const artistId = dbRow.artistId ?? '';
    const clientId = dbRow.clientId ?? dbRow.idClient ?? undefined;

    return {
      id: dbRow.id,
      artistId,
      clientId,
      start: this.normalizeLocalDateTime(dbRow.start),
      end: this.normalizeLocalDateTime(dbRow.end),
      projectId: dbRow.projectId ?? dbRow.idProject,
      bookingId: dbRow.bookingId ?? dbRow.idBooking,
      zone: dbRow.zone,
      sessionNumber: dbRow.sessionNumber,
      notesByAdmin: dbRow.notesByAdmin ?? dbRow.notes,
      price: dbRow.price,
      paidAmount: dbRow.paidAmount,
      painLevel: dbRow.painLevel ?? dbRow.pain,
      healingNotes: dbRow.healingNotes ?? dbRow.healingNote,
      photoUrlList: Array.isArray(dbRow.photoUrlList) ? dbRow.photoUrlList : [],
      gallery: this.normalizeMediaAssetArray(dbRow.gallery),
      beforeImage: this.normalizeMediaAsset(dbRow.beforeImage),
      afterImage: this.normalizeMediaAsset(dbRow.afterImage),
      referenceImages: this.normalizeMediaAssetArray(dbRow.referenceImages),
      status: dbRow.status ?? 'planned',
      createdAt: this.normalizeLocalDateTime(dbRow.createdAt ?? ''),
      updatedAt: this.normalizeLocalDateTime(dbRow.updatedAt ?? '')
    };
  }

  private toDb(app: Session): Session {
    const out: Session = {
      id: app.id,
      artistId: app.artistId,
      clientId: app.clientId,
      start: this.normalizeLocalDateTime(app.start),
      end: this.normalizeLocalDateTime(app.end),
      projectId: app.projectId,
      bookingId: app.bookingId,
      zone: app.zone,
      sessionNumber: app.sessionNumber,
      notesByAdmin: app.notesByAdmin ?? (app as any).notes,
      price: app.price,
      paidAmount: app.paidAmount,
      painLevel: app.painLevel,
      healingNotes: app.healingNotes,
      photoUrlList: app.photoUrlList ?? [],
      gallery: this.normalizeMediaAssetArray(app.gallery),
      beforeImage: this.normalizeMediaAsset(app.beforeImage),
      afterImage: this.normalizeMediaAsset(app.afterImage),
      referenceImages: this.normalizeMediaAssetArray(app.referenceImages),
      status: app.status,
      createdAt: this.normalizeLocalDateTime(app.createdAt),
      updatedAt: this.normalizeLocalDateTime(app.updatedAt)
    };
    return this.stripUndef(out);
  }

  /** patch: converto solo le chiavi presenti */
  private toDbPatch(changes: Partial<Session>): Partial<Session> {
    const out: any = { ...changes };

    // legacy/session form fallback: if only "notes" is provided, persist on canonical notesByAdmin
    if (!Object.prototype.hasOwnProperty.call(out, 'notesByAdmin') && Object.prototype.hasOwnProperty.call(out, 'notes')) {
      out.notesByAdmin = out.notes;
    }
    if (!Object.prototype.hasOwnProperty.call(out, 'painLevel') && Object.prototype.hasOwnProperty.call(out, 'pain')) {
      out.painLevel = out.pain;
    }
    if (!Object.prototype.hasOwnProperty.call(out, 'healingNotes') && Object.prototype.hasOwnProperty.call(out, 'healingNote')) {
      out.healingNotes = out.healingNote;
    }

    // normalize datetime if present
    if (out.start) out.start = this.normalizeLocalDateTime(out.start);
    if (out.end) out.end = this.normalizeLocalDateTime(out.end);
    if (out.createdAt) out.createdAt = this.normalizeLocalDateTime(out.createdAt);
    if (out.updatedAt) out.updatedAt = this.normalizeLocalDateTime(out.updatedAt);

    return this.stripUndef(out);
  }

  private normalizeIdCandidate(value: any): string {
    if (Array.isArray(value)) {
      const first = value.find(v => typeof v === 'string' && v.trim().length > 0);
      return String(first ?? '').trim();
    }
    return String(value ?? '').trim();
  }

  private normalizeMediaAsset(value: any): MediaAsset | null {
    if (!value || typeof value !== 'object') return null;
    const id = String((value as any).id ?? '').trim();
    const fullPath = String((value as any).fullPath ?? '').trim();
    const downloadUrl = String((value as any).downloadUrl ?? '').trim();
    if (!id || !fullPath || !downloadUrl) return null;
    return {
      id,
      name: String((value as any).name ?? '').trim() || 'image',
      fullPath,
      downloadUrl,
      contentType: String((value as any).contentType ?? 'application/octet-stream').trim(),
      size: Number((value as any).size ?? 0) || 0,
      createdAt: String((value as any).createdAt ?? '').trim() || new Date().toISOString(),
      updatedAt: String((value as any).updatedAt ?? '').trim() || new Date().toISOString(),
      alt: String((value as any).alt ?? '').trim() || undefined,
      role: (String((value as any).role ?? '').trim() || 'gallery') as any,
      sortOrder: Number.isFinite(Number((value as any).sortOrder))
        ? Number((value as any).sortOrder)
        : undefined,
      sourceType: (String((value as any).sourceType ?? '').trim() || 'session') as any,
      sourceId: String((value as any).sourceId ?? '').trim() || this.path
    };
  }

  private normalizeMediaAssetArray(value: any): MediaAsset[] {
    if (!Array.isArray(value)) return [];
    return value.map(item => this.normalizeMediaAsset(item)).filter((item): item is MediaAsset => !!item);
  }

  private getProjectPartyIds(project: any): { artistId: string; clientId: string } {
    const artistId = this.normalizeIdCandidate((project as any)?.artistId);
    const clientId = this.normalizeIdCandidate((project as any)?.clientId);
    return { artistId, clientId };
  }

  private async ensureSessionStartsAfterProjectBooking(projectId: string, startISO: string): Promise<void> {
    const project = await this.projects.getProjectById(projectId);
    if (!project) {
      throw new Error(`PROJECT_NOT_FOUND:${projectId}`);
    }

    const bookingId = String((project as any)?.bookingId ?? '').trim();
    if (!bookingId) {
      throw new Error(`SESSION_BOOKING_REQUIRED:${projectId}`);
    }

    const booking = await this.bookings.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`SESSION_BOOKING_NOT_FOUND:${bookingId}`);
    }

    const bookingEnd = this.normalizeLocalDateTime(String((booking as any)?.end ?? '').trim());
    const sessionStart = this.normalizeLocalDateTime(String(startISO ?? '').trim());

    const bookingEndDate = new Date(bookingEnd);
    const sessionStartDate = new Date(sessionStart);

    if (Number.isNaN(bookingEndDate.getTime()) || Number.isNaN(sessionStartDate.getTime())) {
      throw new Error(`SESSION_BOOKING_END_INVALID:${bookingId}`);
    }

    if (sessionStartDate.getTime() < bookingEndDate.getTime()) {
      throw new Error(`SESSION_BEFORE_BOOKING_END:${bookingEnd}`);
    }
  }

  // -----------------------------
  // helpers
  // -----------------------------
  private showMessage(message: string, isError: boolean = false) {
    if (isError) {
      this.ui.error(message);
      return;
    }
    this.ui.success(message);
  }

  private stripUndef<T extends Record<string, any>>(o: T): T {
    const out: any = {};
    for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k];
    return out;
  }

  private pad(n: number): string { return String(n).padStart(2, '0'); }

  /** "YYYY-MM-DDTHH:mm:ss" locale */
  private formatLocal(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mm = this.pad(d.getMinutes());
    const ss = this.pad(d.getSeconds());
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }

  /** normalizza input vari -> locale senza Z e senza millis */
  private normalizeLocalDateTime(input: string): string {
    if (!input) return input;
    let s = String(input).replace('Z', '');
    s = s.split('.')[0];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s;

    const d = new Date(input);
    if (!isNaN(d.getTime())) return this.formatLocal(d);
    return s;
  }
}




