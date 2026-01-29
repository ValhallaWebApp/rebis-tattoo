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
import { MatSnackBar } from '@angular/material/snack-bar';

/** ✅ CANONICO APP (NUOVO) */
export interface Session {
  id?: string;

  artistId: string;     // ✅ nuovo
  clientId?: string;    // ✅ nuovo

  start: string;        // "YYYY-MM-DDTHH:mm:ss" locale (meglio)
  end: string;

  projectId?: string;

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
  private readonly snackbar = inject(MatSnackBar);
  private readonly zone = inject(NgZone);

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
    try {
      const node = push(ref(this.db, this.path));
      const now = this.formatLocal(new Date());

      const payloadApp: Session = {
        ...(session as any),
        id: node.key!,
        createdAt: session.createdAt ?? now,
        updatedAt: session.updatedAt ?? now,
        status: (session as any).status ?? 'planned'
      };

      await set(node, this.toDb(payloadApp));
      this.showMessage('Seduta creata con successo');
      return node.key!;
    } catch (error) {
      console.error('Errore creazione seduta:', error);
      this.showMessage('Errore durante la creazione della seduta', true);
      throw error;
    }
  }

  async update(id: string, changes: Partial<Session>): Promise<void> {
    try {
      const patchDb = this.toDbPatch({
        ...changes,
        updatedAt: this.formatLocal(new Date())
      });

      await update(ref(this.db, `${this.path}/${id}`), patchDb);
      this.showMessage('Seduta aggiornata con successo');
    } catch (error) {
      console.error('Errore aggiornamento seduta:', error);
      this.showMessage("Errore durante l'aggiornamento della seduta", true);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
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

  // -----------------------------
  // helpers
  // -----------------------------
  private showMessage(message: string, isError: boolean = false) {
    this.snackbar.open(message, 'Chiudi', {
      duration: 3000,
      panelClass: isError ? ['mat-warn'] : ['mat-primary']
    });
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
