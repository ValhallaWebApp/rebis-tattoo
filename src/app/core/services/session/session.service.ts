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
import { Observable } from 'rxjs';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuthService } from '../auth/authservice';
import { ProjectsService } from '../projects/projects.service';
import { BookingService } from '../bookings/booking.service';

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

  status: 'planned' | 'completed' | 'cancelled';



  createdAt: string;
  updatedAt: string;
}

/** ⚠️ SHAPE DB LEGACY (RTDB attuale) */
type SessionDb = Omit<Session, 'artistId' | 'clientId'> & {
  idArtist: string;
  idClient?: string;
};

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
      'Permesso mancante: gestione sessioni.'
    );
    try {
      let projectId = String((session as any)?.projectId ?? '').trim();
      let resolvedArtistId = this.normalizeIdCandidate(
        (session as any)?.artistId ?? (session as any)?.idArtist ?? (session as any)?.artistIds
      );
      let resolvedClientId = this.normalizeIdCandidate(
        (session as any)?.clientId ?? (session as any)?.idClient
      );
      if (!projectId) {
        const bookingId = String((session as any)?.bookingId ?? '').trim();
        if (bookingId) {
          const b = await this.bookings.getBookingById(bookingId);
          const inferred = String((b as any)?.projectId ?? '').trim();
          if (inferred) projectId = inferred;
        }
      }

      if (projectId) {
        const project = await this.projects.getProjectById(projectId);
        if (!project) {
          this.showMessage('Progetto non trovato: impossibile creare la sessione.', true);
          throw new Error(`PROJECT_NOT_FOUND:${projectId}`);
        }
        const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
        if (pArtistId && (!resolvedArtistId || pArtistId !== resolvedArtistId)) {
          this.showMessage('Artista sessione allineato automaticamente al progetto.');
          resolvedArtistId = pArtistId;
        }
        if (pClientId && (!resolvedClientId || pClientId !== resolvedClientId)) {
          this.showMessage('Cliente sessione allineato automaticamente al progetto.');
          resolvedClientId = pClientId;
        }
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
      console.error('Errore creazione seduta:', error);
      this.showMessage('Errore durante la creazione della seduta', true);
      throw error;
    }
  }

  async update(id: string, changes: Partial<Session>): Promise<void> {
    this.ensureStaffPermission(
      'canManageSessions',
      'Permesso mancante: gestione sessioni.'
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
          this.showMessage('Progetto non trovato: impossibile aggiornare la sessione.', true);
          throw new Error(`PROJECT_NOT_FOUND:${nextProjectId}`);
        }
        const { artistId: pArtistId, clientId: pClientId } = this.getProjectPartyIds(project);
        let sArtistId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'artistId')
          ? this.normalizeIdCandidate((normalizedChanges as any).artistId)
          : this.normalizeIdCandidate((current as any)?.artistId ?? (current as any)?.idArtist);
        let sClientId = Object.prototype.hasOwnProperty.call(normalizedChanges ?? {}, 'clientId')
          ? this.normalizeIdCandidate((normalizedChanges as any).clientId)
          : this.normalizeIdCandidate((current as any)?.clientId ?? (current as any)?.idClient);

        if (pArtistId && (!sArtistId || pArtistId !== sArtistId)) {
          this.showMessage('Artista sessione allineato automaticamente al progetto.');
          sArtistId = pArtistId;
        }
        if (pClientId && (!sClientId || pClientId !== sClientId)) {
          this.showMessage('Cliente sessione allineato automaticamente al progetto.');
          sClientId = pClientId;
        }
        if (sArtistId) (normalizedChanges as any).artistId = sArtistId;
        if (sClientId) (normalizedChanges as any).clientId = sClientId;
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
      console.error('Errore aggiornamento seduta:', error);
      this.showMessage("Errore durante l'aggiornamento della seduta", true);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.ensureStaffPermission(
      'canManageSessions',
      'Permesso mancante: gestione sessioni.'
    );
    try {
      await remove(ref(this.db, `${this.path}/${id}`));
      this.showMessage('Seduta eliminata con successo');
    } catch (error) {
      console.error('Errore eliminazione seduta:', error);
      this.showMessage("Errore durante l'eliminazione della seduta", true);
      throw error;
    }
  }

  getSessionsByArtist(artistId: string): Observable<Session[]> {
    // DB ha idArtist -> query su idArtist
    const q = query(ref(this.db, this.path), orderByChild('idArtist'), equalTo(artistId));

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

  getSessionsByProject(projectId: string): Observable<Session[]> {
    const q = query(ref(this.db, this.path), orderByChild('projectId'), equalTo(projectId));

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
    const artistId = dbRow.artistId ?? dbRow.idArtist ?? '';
    const clientId = dbRow.clientId ?? dbRow.idClient ?? undefined;

    return {
      id: dbRow.id,
      artistId,
      clientId,
      start: this.normalizeLocalDateTime(dbRow.start),
      end: this.normalizeLocalDateTime(dbRow.end),
      projectId: dbRow.projectId,
      bookingId: dbRow.bookingId,
      sessionNumber: dbRow.sessionNumber,
      notesByAdmin: dbRow.notesByAdmin,
      price: dbRow.price,
      paidAmount: dbRow.paidAmount,
      painLevel: dbRow.painLevel,
      healingNotes: dbRow.healingNotes,
      photoUrlList: Array.isArray(dbRow.photoUrlList) ? dbRow.photoUrlList : [],
      status: dbRow.status ?? 'planned',
      createdAt: this.normalizeLocalDateTime(dbRow.createdAt ?? ''),
      updatedAt: this.normalizeLocalDateTime(dbRow.updatedAt ?? '')
    };
  }

  private toDb(app: Session): SessionDb {
    const out: SessionDb = {
      id: app.id,
      idArtist: app.artistId,
      idClient: app.clientId,
      start: this.normalizeLocalDateTime(app.start),
      end: this.normalizeLocalDateTime(app.end),
      projectId: app.projectId,
      bookingId: app.bookingId,
      sessionNumber: app.sessionNumber,
      notesByAdmin: app.notesByAdmin,
      price: app.price,
      paidAmount: app.paidAmount,
      painLevel: app.painLevel,
      healingNotes: app.healingNotes,
      photoUrlList: app.photoUrlList ?? [],
      status: app.status,
      createdAt: this.normalizeLocalDateTime(app.createdAt),
      updatedAt: this.normalizeLocalDateTime(app.updatedAt)
    };
    return this.stripUndef(out);
  }

  /** patch: converto solo le chiavi presenti */
  private toDbPatch(changes: Partial<Session>): Partial<SessionDb> {
    const out: any = { ...changes };

    // rename keys if present
    if ('artistId' in out) { out.idArtist = out.artistId; delete out.artistId; }
    if ('clientId' in out) { out.idClient = out.clientId; delete out.clientId; }

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

  private getProjectPartyIds(project: any): { artistId: string; clientId: string } {
    const artistId = this.normalizeIdCandidate(
      (project as any)?.artistId ?? (project as any)?.idArtist ?? (project as any)?.artistIds
    );
    const clientId = this.normalizeIdCandidate(
      (project as any)?.clientId ?? (project as any)?.idClient
    );
    return { artistId, clientId };
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
