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
import { combineLatest, map, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuthService } from '../auth/auth.service';
import { MediaAsset } from '../../models/media-asset.model';

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
  coverImage?: MediaAsset | null;
  gallery?: MediaAsset[];
  referenceImages?: MediaAsset[];

  // legacy fields still present in dataset
  genere?: string;
  copertine?: string[];
}
export interface ProjectLite {
  id: string;
  title: string;
  clientId?: string;
  artistId?: string;
  sessionIds?: string[];
  bookingId?: string;
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

  private async ensureProjectCreateAccess(bookingId?: string): Promise<void> {
    const user = this.auth.userSig();
    if (!user) throw new Error('auth/not-logged-in');
    if (user.role === 'admin') return;
    if (user.role !== 'staff') throw new Error('PERMISSION_DENIED:only-admins-and-staff');
    if (!bookingId) throw new Error('PERMISSION_DENIED:booking-required');
    await this.ensureBookingOwnedByStaff(String(bookingId), user.uid);
  }

  private async ensureProjectUpdateAccess(id: string, changes: Partial<TattooProject>): Promise<void> {
    const user = this.auth.userSig();
    if (!user) throw new Error('auth/not-logged-in');
    if (user.role === 'admin') return;
    if (user.role !== 'staff') throw new Error('PERMISSION_DENIED:only-admins-and-staff');

    const project = await this.getProjectById(id);
    const bookingId = String(project?.bookingId ?? '').trim();
    if (!bookingId) {
      throw new Error('PERMISSION_DENIED:booking-required');
    }

    if (changes.bookingId && String(changes.bookingId ?? '').trim() && String(changes.bookingId ?? '').trim() !== bookingId) {
      throw new Error('PERMISSION_DENIED:booking-reassign-not-allowed');
    }

    await this.ensureBookingOwnedByStaff(bookingId, user.uid);
  }

  private async ensureBookingOwnedByStaff(bookingId: string, uid: string): Promise<void> {
    if (!bookingId) throw new Error('PERMISSION_DENIED:booking-required');
    const snap = await get(ref(this.db, `bookings/${bookingId}`));
    if (!snap.exists()) throw new Error('BOOKING_NOT_FOUND');
    const booking = snap.val() as Record<string, any>;
    const artistId = String((booking?.['artistId']) ?? '').trim();
    if (!artistId) throw new Error('PERMISSION_DENIED:booking-missing-artist');
    if (artistId !== uid) throw new Error('PERMISSION_DENIED:not-assigned-booking');
  }

  // -----------------------------
  // Read
  // -----------------------------
  getProjects(opts: { onlyOnce?: boolean } = {}): Observable<TattooProject[]> {
    const projectsRef = ref(this.db, this.path);
    return this.streamProjects(projectsRef, opts);
  }

  getPublicProjects(opts: { onlyOnce?: boolean } = {}): Observable<TattooProject[]> {
    const qPublicBool = query(ref(this.db, this.path), orderByChild('isPublic'), equalTo(true));
    const qPublicString = query(ref(this.db, this.path), orderByChild('isPublic'), equalTo('true'));
    const qLegacyBool = query(ref(this.db, this.path), orderByChild('is_Public'), equalTo(true));
    const qLegacyString = query(ref(this.db, this.path), orderByChild('is_Public'), equalTo('true'));

    return combineLatest([
      this.streamProjects(qPublicBool, opts),
      this.streamProjects(qPublicString, opts),
      this.streamProjects(qLegacyBool, opts),
      this.streamProjects(qLegacyString, opts)
    ]).pipe(
      map(([a, b, c, d]) => {
        const out = new Map<string, TattooProject>();
        for (const p of [...a, ...b, ...c, ...d]) {
          const id = String((p as any)?.id ?? '').trim();
          if (!id) continue;
          if (!this.isPublicEnabled((p as any)?.isPublic, (p as any)?.is_Public)) continue;
          out.set(id, p);
        }
        return Array.from(out.values());
      })
    );
  }

  private streamProjects(projectsRef: any, opts: { onlyOnce?: boolean } = {}): Observable<TattooProject[]> {
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
          return {
            id: String(p.id),
            title: p.title,
            clientId: String(raw?.clientId ?? '').trim() || undefined,
            artistId: String(raw?.artistId ?? '').trim() || undefined,
            bookingId: String(raw?.bookingId ?? '').trim() || undefined,
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
    const cid = String(clientId ?? '').trim();
    if (!cid) {
      return of([]);
    }

    const byClientId = query(ref(this.db, this.path), orderByChild('clientId'), equalTo(cid));
    const byLegacyClientId = query(ref(this.db, this.path), orderByChild('idClient'), equalTo(cid));

    const streamQuery = (q: any) =>
      new Observable<TattooProject[]>((obs) => {
        const unsub = onValue(
          q,
          (snap) => {
            this.zone.run(() => {
              const list = snap.exists()
                ? Object.entries<any>(snap.val()).map(([id, v]) => ({ id, ...v }))
                : [];
              obs.next(list);
            });
          },
          (err) => this.zone.run(() => obs.error(err))
        );
        return () => unsub();
      }).pipe(catchError(() => of([] as TattooProject[])));

    return combineLatest([streamQuery(byClientId), streamQuery(byLegacyClientId)]).pipe(
      map(([modern, legacy]) => {
        const out = new Map<string, TattooProject>();
        for (const project of [...modern, ...legacy]) {
          const id = String((project as any)?.id ?? '').trim();
          if (!id) continue;
          out.set(id, project);
        }
        return Array.from(out.values());
      })
    );
  }

  // -----------------------------
  // Write
  // -----------------------------
  async createProject(data: Omit<TattooProject, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TattooProject,'createdAt'|'updatedAt'>>): Promise<string> {
    await this.ensureProjectCreateAccess(data.bookingId);
    const node = push(ref(this.db, this.path));
    const now = this.formatLocal(new Date());

    const payload: TattooProject = {
      ...(data as any),
      id: node.key!,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      isPublic: (data as any).isPublic === true,
      status: (data as any).status ?? 'draft',
      sessionIds: Array.isArray((data as any).sessionIds) ? (data as any).sessionIds : []
    };

    await set(node, this.stripUndef(payload));
    this.toast('Progetto creato');
    return node.key!;
  }

  async updateProject(id: string, changes: Partial<TattooProject>): Promise<void> {
    await this.ensureProjectUpdateAccess(id, changes);
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
    await this.ensureProjectUpdateAccess(id, {});
    await this.clearProjectLinks(id);
    await remove(ref(this.db, `${this.path}/${id}`));
    this.toast('Progetto eliminato');
  }

  /**
   * Mantiene consistenza referenziale prima della delete:
   * - bookings/*.projectId
   * - sessions/*.projectId
   */
  private async clearProjectLinks(projectId: string): Promise<void> {
    const id = String(projectId ?? '').trim();
    if (!id) return;
    const now = this.formatLocal(new Date());
    const project = await this.getProjectById(id);

    const bookingIds = new Set<string>();
    const linkedBookingId = String((project as any)?.bookingId ?? '').trim();
    if (linkedBookingId) bookingIds.add(linkedBookingId);

    const bookingSnap = await get(
      query(ref(this.db, 'bookings'), orderByChild('projectId'), equalTo(id))
    );
    if (bookingSnap.exists()) {
      for (const bookingId of Object.keys(bookingSnap.val() as Record<string, unknown>)) {
        bookingIds.add(String(bookingId).trim());
      }
    }

    for (const bookingId of bookingIds) {
      if (!bookingId) continue;
      const bookingRef = ref(this.db, `bookings/${bookingId}`);
      const snap = await get(bookingRef);
      if (!snap.exists()) continue;
      const currentProjectId = String((snap.val() as any)?.projectId ?? '').trim();
      if (currentProjectId && currentProjectId !== id) continue;
      await update(bookingRef, { projectId: null, updatedAt: now } as any);
    }

    const sessionIds = new Set<string>(
      Array.isArray((project as any)?.sessionIds)
        ? ((project as any).sessionIds as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
        : []
    );
    const sessionSnap = await get(
      query(ref(this.db, 'sessions'), orderByChild('projectId'), equalTo(id))
    );
    if (sessionSnap.exists()) {
      for (const sessionId of Object.keys(sessionSnap.val() as Record<string, unknown>)) {
        sessionIds.add(String(sessionId).trim());
      }
    }

    for (const sessionId of sessionIds) {
      if (!sessionId) continue;
      const sessionRef = ref(this.db, `sessions/${sessionId}`);
      const snap = await get(sessionRef);
      if (!snap.exists()) continue;
      const currentProjectId = String((snap.val() as any)?.projectId ?? '').trim();
      if (currentProjectId && currentProjectId !== id) continue;
      await update(sessionRef, { projectId: null, updatedAt: now } as any);
    }
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
    await this.ensureProjectUpdateAccess(projectId, {});
    await update(ref(this.db, `${this.path}/${projectId}`), {
      bookingId: null,
      updatedAt: this.formatLocal(new Date())
    } as any);
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

  private isPublicEnabled(value: unknown, legacyValue?: unknown): boolean {
    const normalize = (v: unknown): boolean => {
      if (v === true) return true;
      if (typeof v === 'string') {
        const normalized = v.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
      }
      if (typeof v === 'number') return v === 1;
      return false;
    };
    return normalize(value) || normalize(legacyValue);
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


