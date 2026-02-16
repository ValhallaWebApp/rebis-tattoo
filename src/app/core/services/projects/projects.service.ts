import { Injectable, NgZone, inject } from '@angular/core';
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
  equalTo
} from '@angular/fire/database';
import { map, Observable } from 'rxjs';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuthService } from '../auth/authservice';

export type ProjectStatus = 'draft' | 'scheduled' | 'active' | 'healing' | 'completed' | 'cancelled';

export interface TattooProject {
  id?: string;

  title: string;

  artistId: string;
  clientId: string;

  // ✅ collegamenti
  bookingId?: string;     // 0..1
  sessionIds?: string[];  // 0..N

  // ✅ contesto progetto
  zone?: string;          // (vedi sotto: qui ha senso)
  placement?:string;
  notes?: string;

  status: ProjectStatus;

  createdAt: string;
  updatedAt: string;

  // public fields
  isPublic?: boolean;
  style?: string;
  subject?: string;
  imageUrls?: string[];

  // legacy fields (compat)
  genere?: string;
  copertine?: string[];
}
export interface ProjectLite {
  id: string;
  title: string;
  clientId?: string;
  artistId?: string;
  sessionIds?: string[];
}


@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly path = 'projects';

  private readonly db = inject(Database);
  private readonly zone = inject(NgZone);
  private readonly ui = inject(UiFeedbackService);
  private readonly auth = inject(AuthService);

  private ensureStaffPermission(permissionKey: string, missingMessage: string): void {
    const user = this.auth.userSig();
    if (!user) return;
    if (user.role === 'admin') return;
    if (user.role !== 'staff') return;
    if (user.permissions?.[permissionKey] === true) return;

    this.ui.warn(missingMessage);
    throw new Error(`PERMISSION_DENIED:${permissionKey}`);
  }

  // -----------------------------
  // Read
  // -----------------------------
  getProjects(opts: { onlyOnce?: boolean } = {}): Observable<TattooProject[]> {
    const projectsRef = ref(this.db, this.path);

    return new Observable<TattooProject[]>(obs => {
      const unsub = onValue(
        projectsRef,
        snap => {
          this.zone.run(() => {
            const list = snap.exists()
              ? Object.entries<any>(snap.val()).map(([id, v]) => ({ id, ...v }))
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
/** ✅ Lite list (one-shot) per autocomplete */
getProjectsLiteOnce(): Observable<ProjectLite[]> {
  return this.getProjects({ onlyOnce: true }).pipe(
    // serve importare map da rxjs
    map(list =>
      (list ?? [])
        .filter(p => !!p.id)
        .map(p => {
          const raw: any = p as any;
          const legacyArtistIds = Array.isArray(raw?.artistIds)
            ? raw.artistIds.map((x: any) => String(x ?? '').trim()).filter(Boolean)
            : [];
          return {
            id: String(p.id),
            title: p.title,
            clientId: String(raw?.clientId ?? raw?.idClient ?? '').trim() || undefined,
            artistId: String(raw?.artistId ?? raw?.idArtist ?? legacyArtistIds[0] ?? '').trim() || undefined,
            sessionIds: Array.isArray(p.sessionIds) ? p.sessionIds : [],
          };
        })
    )
  );
}

  async getProjectById(id: string): Promise<TattooProject | null> {
    const snap = await get(ref(this.db, `${this.path}/${id}`));
    return snap.exists() ? ({ id, ...(snap.val() as any) } as TattooProject) : null;
  }

  /** opzionale: query per cliente */
  getProjectsByClient(clientId: string): Observable<TattooProject[]> {
    const q = query(ref(this.db, this.path), orderByChild('clientId'), equalTo(clientId));
    return new Observable<TattooProject[]>(obs => {
      const unsub = onValue(
        q,
        snap => {
          this.zone.run(() => {
            const list = snap.exists()
              ? Object.entries<any>(snap.val()).map(([id, v]) => ({ id, ...v }))
              : [];
            obs.next(list);
          });
        },
        err => this.zone.run(() => obs.error(err))
      );
      return () => unsub();
    });
  }

  // -----------------------------
  // Write
  // -----------------------------
  async createProject(data: Omit<TattooProject, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TattooProject,'createdAt'|'updatedAt'>>): Promise<string> {
    this.ensureStaffPermission(
      'canManageProjects',
      'Permesso mancante: gestione progetti.'
    );
    const node = push(ref(this.db, this.path));
    const now = this.formatLocal(new Date());

    const payload: TattooProject = {
      ...(data as any),
      id: node.key!,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      status: (data as any).status ?? 'draft',
      sessionIds: Array.isArray((data as any).sessionIds) ? (data as any).sessionIds : []
    };

    await set(node, this.stripUndef(payload));
    this.toast('Progetto creato');
    return node.key!;
  }

  async updateProject(id: string, changes: Partial<TattooProject>): Promise<void> {
    this.ensureStaffPermission(
      'canManageProjects',
      'Permesso mancante: gestione progetti.'
    );
    if (Object.prototype.hasOwnProperty.call(changes ?? {}, 'artistId')) {
      this.ensureStaffPermission(
        'canReassignProjectArtist',
        'Permesso mancante: cambio artista progetto.'
      );
    }
    if (Object.prototype.hasOwnProperty.call(changes ?? {}, 'clientId')) {
      this.ensureStaffPermission(
        'canReassignProjectClient',
        'Permesso mancante: cambio cliente progetto.'
      );
    }
    const patch = this.stripUndef({
      ...changes,
      updatedAt: this.formatLocal(new Date())
    });
    await update(ref(this.db, `${this.path}/${id}`), patch);
    this.toast('Progetto aggiornato');
  }

  async deleteProject(id: string): Promise<void> {
    this.ensureStaffPermission(
      'canManageProjects',
      'Permesso mancante: gestione progetti.'
    );
    await remove(ref(this.db, `${this.path}/${id}`));
    this.toast('Progetto eliminato');
  }

  // -----------------------------
  // Helpers: link booking/session
  // -----------------------------

  /** ✅ collega bookingId (0..1) */
  async attachBooking(projectId: string, bookingId: string): Promise<void> {
    await this.updateProject(projectId, { bookingId, status: 'scheduled' });
  }

  /** ✅ rimuove bookingId se combacia (evita di cancellare link di altri booking) */
  async detachBookingIfMatch(projectId: string, bookingId: string): Promise<void> {
    const p = await this.getProjectById(projectId);
    if (!p) return;
    const current = String((p as any).bookingId ?? '').trim();
    if (!current) return;
    if (current !== String(bookingId ?? '').trim()) return;
    await this.updateProject(projectId, { bookingId: undefined });
  }

  /** ✅ aggiunge sessionId in array (no duplicati) */
  async addSession(projectId: string, sessionId: string): Promise<void> {
    const p = await this.getProjectById(projectId);
    if (!p) return;

    const prev = Array.isArray(p.sessionIds) ? p.sessionIds : [];
    if (prev.includes(sessionId)) return;

    const next = [...prev, sessionId];
    const nextStatus =
      p.status === 'draft' || p.status === 'healing'
        ? 'active'
        : p.status;
    await this.updateProject(projectId, { sessionIds: next, status: nextStatus });
  }

  /** ✅ rimuove sessionId da array (se presente) */
  async removeSession(projectId: string, sessionId: string): Promise<void> {
    const p = await this.getProjectById(projectId);
    if (!p) return;

    const prev = Array.isArray(p.sessionIds) ? p.sessionIds : [];
    const next = prev.filter(id => String(id) !== String(sessionId));
    if (next.length === prev.length) return;

    await this.updateProject(projectId, { sessionIds: next });
  }

  // -----------------------------
  // utils
  // -----------------------------
  private toast(message: string, isError = false) {
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

  private pad(n: number) { return String(n).padStart(2, '0'); }

  private formatLocal(d: Date): string {
    const y = d.getFullYear();
    const m = this.pad(d.getMonth() + 1);
    const day = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mm = this.pad(d.getMinutes());
    const ss = this.pad(d.getSeconds());
    return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
  }
}
