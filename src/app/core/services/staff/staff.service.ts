import { Injectable } from '@angular/core';
import { Database, get, onValue, ref, remove, set, update } from '@angular/fire/database';
import { catchError, combineLatest, map, Observable, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConfirmActionService } from '../ui/confirm-action.service';
import { UiFeedbackService } from '../ui/ui-feedback.service';

export interface StaffMember {
  id?: string;
  userId?: string;
  name: string;
  role: 'tatuatore' | 'piercer' | 'guest' | 'altro';
  bio?: string;
  photoUrl?: string;
  isActive?: boolean;
  deletedAt?: string | null;
  email?: string;
  phone?: string;
  calendar?: StaffCalendarSettings;
}

export interface StaffCalendarSettings {
  enabled?: boolean;
  color?: string;
  workdayStart?: string;
  workdayEnd?: string;
  stepMinutes?: number;
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface StaffTimeSlot {
  start: string;
  end: string;
}

export interface StaffAvailability {
  timezone?: string;
  week: Record<WeekdayKey, StaffTimeSlot[]>;
}

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private readonly profilePath = 'staffProfiles';
  private readonly availabilityPath = 'staffAvailability';
  private readonly publicPath = 'publicStaff';

  constructor(
    private db: Database,
    private auth: AuthService,
    private confirmAction: ConfirmActionService,
    private ui: UiFeedbackService
  ) {}

  private assertAdminAction(): void {
    if (this.auth.userSig()?.role !== 'admin') {
      throw new Error('Azione consentita solo ad admin');
    }
  }

  private normalizeDeletedAt(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    return s;
  }

  private normalizeBoolean(value: unknown, fallback = true): boolean {
    if (value === true) return true;
    if (value === false) return false;
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return fallback;
  }

  private isPermissionDeniedError(err: unknown): boolean {
    const code = String((err as any)?.code ?? '').toLowerCase();
    const msg = String((err as any)?.message ?? '').toLowerCase();
    return code.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('permission denied');
  }

  private streamNode(path: string, opts?: { swallowPermissionDenied?: boolean }): Observable<Record<string, any>> {
    return new Observable<Record<string, any>>((observer) => {
      const r = ref(this.db, path);
      const unsub = onValue(
        r,
        (snap) => observer.next((snap.exists() ? snap.val() : {}) as Record<string, any>),
        (err) => {
          if (opts?.swallowPermissionDenied && this.isPermissionDeniedError(err)) {
            observer.next({});
            return;
          }
          observer.error(err);
        }
      );
      return () => unsub();
    });
  }

  getAllStaff(): Observable<StaffMember[]> {
    return combineLatest([
      this.streamNode(this.profilePath),
      this.streamNode('users', { swallowPermissionDenied: true }),
      this.streamNode(this.publicPath, { swallowPermissionDenied: true }),
    ]).pipe(
      map(([profiles, users, publicStaff]) => {
        const ids = new Set<string>(Object.keys(profiles ?? {}));
        for (const uid of Object.keys(publicStaff ?? {})) ids.add(uid);
        for (const [uid, rawUser] of Object.entries(users ?? {})) {
          if (String((rawUser as any)?.['role'] ?? '').toLowerCase() === 'staff') {
            ids.add(uid);
          }
        }

        const out: StaffMember[] = [];
        for (const uid of ids) {
          const p = (profiles?.[uid] ?? {}) as Partial<StaffMember>;
          const pub = (publicStaff?.[uid] ?? {}) as Partial<StaffMember>;
          const u = (users?.[uid] ?? {}) as Record<string, any>;
          const userRole = String(u?.['role'] ?? '').toLowerCase();
          const calendar = ((p as any).calendar ?? (pub as any).calendar ?? {}) as StaffCalendarSettings;
          const deletedAt = this.normalizeDeletedAt(p.deletedAt ?? pub.deletedAt);
          if (deletedAt) continue;
          if (Object.keys(u).length && userRole !== 'staff' && String((pub as any)?.role ?? '').toLowerCase() !== 'staff') continue;

          const name = String(p.name ?? pub.name ?? u?.['name'] ?? u?.['email'] ?? uid).trim();

          out.push({
            id: uid,
            userId: uid,
            name: name || uid,
            role: (p.role as StaffMember['role']) ?? (pub.role as StaffMember['role']) ?? 'tatuatore',
            bio: p.bio ? String(p.bio) : String(pub.bio ?? ''),
            photoUrl: String(p.photoUrl ?? pub.photoUrl ?? u?.['urlAvatar'] ?? u?.['avatar'] ?? '').trim(),
            isActive: this.normalizeBoolean(p.isActive, this.normalizeBoolean(pub.isActive, this.normalizeBoolean(u?.['isActive'], true))),
            deletedAt,
            email: (p as any).email ? String((p as any).email) : ((pub as any).email ? String((pub as any).email) : (u?.['email'] ? String(u['email']) : undefined)),
            phone: (p as any).phone ? String((p as any).phone) : ((pub as any).phone ? String((pub as any).phone) : (u?.['phone'] ? String(u['phone']) : undefined)),
            calendar
          } as StaffMember);
        }

        return out.sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
      })
    );
  }

  addStaff(member: StaffMember): Promise<void> {
    const uid = String(member.userId ?? member.id ?? '').trim();
    if (!uid) return Promise.reject(new Error('userId obbligatorio per creare uno staff'));

    const profile: StaffMember = {
      id: uid,
      userId: uid,
      name: member.name,
      role: member.role,
      bio: member.bio ?? '',
      photoUrl: member.photoUrl ?? '',
      isActive: member.isActive ?? true,
      deletedAt: null
    };

    const userPatch: any = {
      role: 'staff',
      isActive: profile.isActive,
      name: profile.name
    };
    if (member.phone !== undefined) userPatch.phone = member.phone;
    if (profile.photoUrl) userPatch.urlAvatar = profile.photoUrl;

    return this.confirmAction.confirm({
      title: 'Conferma promozione staff',
      message: 'Vuoi promuovere questo utente a staff?',
      confirmText: 'Conferma',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      const publicPayload = {
        id: uid,
        userId: uid,
        name: profile.name,
        role: 'staff',
        bio: profile.bio ?? '',
        photoUrl: profile.photoUrl ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        isActive: profile.isActive !== false,
        deletedAt: null
      } as any;

      return Promise.all([
      update(ref(this.db, `users/${uid}`), userPatch),
      set(ref(this.db, `${this.profilePath}/${uid}`), profile),
      set(ref(this.db, `${this.publicPath}/${uid}`), publicPayload)
      ]).then(() => {
        this.ui.success('Staff creato');
      });
    });
  }

  updateStaff(id: string, data: Partial<StaffMember>): Promise<void> {
    const uid = String(data.userId ?? id ?? '').trim();
    if (!uid) return Promise.reject(new Error('userId mancante'));

    const profilePatch: Partial<StaffMember> = {
      name: data.name,
      role: data.role,
      bio: data.bio,
      photoUrl: data.photoUrl,
      isActive: data.isActive,
      deletedAt: data.deletedAt ?? null
    };

    const userPatch: any = {};
    if (data.name !== undefined) userPatch.name = data.name;
    if (data.photoUrl !== undefined) userPatch.urlAvatar = data.photoUrl;
    if (data.isActive !== undefined) userPatch.isActive = data.isActive;
    userPatch.role = 'staff';

    return this.confirmAction.confirm({
      title: 'Conferma aggiornamento staff',
      message: 'Vuoi salvare le modifiche del membro staff?',
      confirmText: 'Conferma',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      const publicPatch: any = {
        name: data.name,
        role: 'staff',
        bio: data.bio,
        photoUrl: data.photoUrl,
        isActive: data.isActive,
        deletedAt: data.deletedAt ?? null
      };
      if (data.email !== undefined) publicPatch.email = data.email;
      if (data.phone !== undefined) publicPatch.phone = data.phone;

      return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), this.stripUndef(profilePatch as any)),
      update(ref(this.db, `users/${uid}`), userPatch),
      update(ref(this.db, `${this.publicPath}/${uid}`), this.stripUndef(publicPatch))
      ]).then(() => {
        this.ui.success('Staff aggiornato');
      });
    });
  }

  deleteStaff(id: string): Promise<void> {
    const uid = String(id ?? '').trim();
    if (!uid) return Promise.reject(new Error('id staff non valido'));
    const deletedAt = new Date().toISOString();

    return this.confirmAction.confirm({
      title: 'Conferma disattivazione staff',
      message: 'Vuoi disattivare questo membro staff?',
      confirmText: 'Conferma',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), {
        isActive: false,
        deletedAt
      }),
      update(ref(this.db, `users/${uid}`), {
        isActive: false
      } as any),
      update(ref(this.db, `${this.publicPath}/${uid}`), {
        isActive: false,
        deletedAt
      } as any)
      ]).then(() => {
        this.ui.warn('Staff disattivato');
      });
    });
  }

  revokeStaff(id: string): Promise<void> {
    const uid = String(id ?? '').trim();
    if (!uid) return Promise.reject(new Error('id staff non valido'));
    const deletedAt = new Date().toISOString();

    return this.confirmAction.confirm({
      title: 'Conferma revoca staff',
      message: 'Vuoi revocare il ruolo staff e riportare l utente a client?',
      confirmText: 'Conferma',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), {
        isActive: false,
        deletedAt
      }),
      update(ref(this.db, `users/${uid}`), {
        role: 'client',
        isActive: true
      } as any),
      remove(ref(this.db, `${this.publicPath}/${uid}`))
      ]).then(() => {
        this.ui.success('Staff revocato');
      });
    });
  }

  hardDeleteStaff(id: string): Promise<void> {
    return this.confirmAction.confirm({
      title: 'Conferma eliminazione staff',
      message: 'Vuoi eliminare definitivamente il profilo staff?',
      confirmText: 'Elimina',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      return Promise.all([
        remove(ref(this.db, `${this.profilePath}/${id}`)),
        remove(ref(this.db, `${this.publicPath}/${id}`))
      ]).then(() => {
        this.ui.warn('Profilo staff eliminato');
      });
    });
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    const uid = String(id ?? '').trim();
    if (!uid) return null;

    const [uSnap, pSnap] = await Promise.all([
      get(ref(this.db, `users/${uid}`)),
      get(ref(this.db, `${this.profilePath}/${uid}`))
    ]);

    if (!uSnap.exists()) return null;
    const u = uSnap.val() as any;
    if (String(u.role ?? '') !== 'staff') return null;

    const p = (pSnap.exists() ? pSnap.val() : {}) as Partial<StaffMember>;
    if (p.deletedAt) return null;

    return {
      id: uid,
      userId: uid,
      name: String(p.name ?? u.name ?? '').trim(),
      role: (p.role as StaffMember['role']) ?? 'tatuatore',
      bio: p.bio ? String(p.bio) : '',
      photoUrl: String(p.photoUrl ?? u.urlAvatar ?? u.avatar ?? '').trim(),
      isActive: p.isActive ?? (u.isActive !== false),
      deletedAt: p.deletedAt ?? null,
      email: u.email ? String(u.email) : undefined,
      phone: u.phone ? String(u.phone) : undefined
    };
  }

  getStaffCandidates(): Observable<Array<{ id: string; name: string; email?: string; phone?: string; role?: string; avatarUrl?: string; bio?: string }>> {
    return new Observable<any[]>((observer) => {
      const usersRef = ref(this.db, 'users');
      const unsub = onValue(
        usersRef,
        (snap) => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }
          const raw = snap.val() as Record<string, any>;
          const list = Object.entries(raw).map(([id, u]) => ({ id, ...(u as any) }));
          observer.next(list);
        },
        (err) => observer.error(err)
      );
      return () => unsub();
    }).pipe(
      map(list =>
        (list ?? [])
          .filter(u => u.isVisible !== false && !u.deletedAt)
          .map(u => ({
            id: String(u.id ?? ''),
            name: String(u.name ?? '').trim() || String(u.email ?? '').trim() || String(u.id ?? ''),
            email: u.email ? String(u.email) : undefined,
            phone: u.phone ? String(u.phone) : undefined,
            role: u.role ? String(u.role).trim().toLowerCase() : undefined,
            avatarUrl: String(u.urlAvatar ?? u.avatar ?? '').trim() || undefined,
            bio: u.bio ? String(u.bio) : undefined
          }))
      )
    );
  }

  private stripUndef<T extends Record<string, any>>(obj: T): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out as Partial<T>;
  }

  getCalendarSettings(uid: string): Observable<StaffCalendarSettings> {
    const id = String(uid ?? '').trim();
    if (!id) return of({ enabled: true, workdayStart: '08:00', workdayEnd: '20:00', stepMinutes: 30 });

    return new Observable<StaffCalendarSettings>((observer) => {
      const r = ref(this.db, `${this.profilePath}/${id}/calendar`);
      const unsub = onValue(
        r,
        (snap) => observer.next((snap.exists() ? (snap.val() as any) : {}) as StaffCalendarSettings),
        (err) => observer.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError(() => of({ enabled: true, workdayStart: '08:00', workdayEnd: '20:00', stepMinutes: 30 }))
    );
  }

  updateCalendarSettings(uid: string, patch: StaffCalendarSettings): Promise<void> {
    const id = String(uid ?? '').trim();
    if (!id) return Promise.reject(new Error('uid non valido'));
    return this.confirmAction.confirm({
      title: 'Conferma aggiornamento calendario',
      message: 'Vuoi salvare le modifiche calendario staff?',
      confirmText: 'Salva',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      return update(ref(this.db, `${this.profilePath}/${id}/calendar`), this.stripUndef(patch as any)).then(() => {
        this.ui.success('Calendario aggiornato');
      });
    });
  }

  getAvailability(uid: string): Observable<StaffAvailability> {
    const id = String(uid ?? '').trim();
    if (!id) {
      return of({
        timezone: 'Europe/Rome',
        week: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      });
    }

    return new Observable<StaffAvailability>((observer) => {
      const r = ref(this.db, `${this.availabilityPath}/${id}`);
      const unsub = onValue(
        r,
        (snap) => {
          const v = (snap.exists() ? snap.val() : null) as any;
          const week = (v?.week ?? {}) as Partial<Record<WeekdayKey, StaffTimeSlot[]>>;
          observer.next({
            timezone: String(v?.timezone ?? 'Europe/Rome'),
            week: {
              mon: Array.isArray(week.mon) ? week.mon : [],
              tue: Array.isArray(week.tue) ? week.tue : [],
              wed: Array.isArray(week.wed) ? week.wed : [],
              thu: Array.isArray(week.thu) ? week.thu : [],
              fri: Array.isArray(week.fri) ? week.fri : [],
              sat: Array.isArray(week.sat) ? week.sat : [],
              sun: Array.isArray(week.sun) ? week.sun : [],
            },
          });
        },
        (err) => observer.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError(() =>
        of({
          timezone: 'Europe/Rome',
          week: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        })
      )
    );
  }

  setAvailability(uid: string, availability: StaffAvailability): Promise<void> {
    const id = String(uid ?? '').trim();
    if (!id) return Promise.reject(new Error('uid non valido'));
    return this.confirmAction.confirm({
      title: 'Conferma aggiornamento disponibilita',
      message: 'Vuoi salvare la disponibilita staff?',
      confirmText: 'Salva',
      cancelText: 'Annulla',
    }).then((confirmed) => {
      if (!confirmed) return;
      return set(ref(this.db, `${this.availabilityPath}/${id}`), availability as any).then(() => {
        this.ui.success('Disponibilita salvata');
      });
    });
  }

  async backfillPublicStaffFromCurrentData(): Promise<void> {
    this.assertAdminAction();
    const [profilesSnap, usersSnap] = await Promise.all([
      get(ref(this.db, this.profilePath)),
      get(ref(this.db, 'users'))
    ]);

    const profiles = (profilesSnap.exists() ? profilesSnap.val() : {}) as Record<string, any>;
    const users = (usersSnap.exists() ? usersSnap.val() : {}) as Record<string, any>;
    const ids = new Set<string>(Object.keys(profiles ?? {}));
    for (const [uid, u] of Object.entries(users ?? {})) {
      if (String((u as any)?.role ?? '').toLowerCase() === 'staff') ids.add(uid);
    }

    const writes: Array<Promise<void>> = [];
    for (const uid of ids) {
      const p = (profiles?.[uid] ?? {}) as Record<string, any>;
      const u = (users?.[uid] ?? {}) as Record<string, any>;
      const deletedAt = this.normalizeDeletedAt(p['deletedAt']);
      if (deletedAt) continue;

      const payload = {
        id: uid,
        userId: uid,
        name: String(p['name'] ?? u?.['name'] ?? u?.['email'] ?? uid).trim() || uid,
        role: 'staff',
        bio: String(p['bio'] ?? ''),
        photoUrl: String(p['photoUrl'] ?? u?.['urlAvatar'] ?? u?.['avatar'] ?? ''),
        email: String(p['email'] ?? u?.['email'] ?? ''),
        phone: String(p['phone'] ?? u?.['phone'] ?? ''),
        isActive: this.normalizeBoolean(p['isActive'], this.normalizeBoolean(u?.['isActive'], true)),
        deletedAt: null,
      } as any;
      writes.push(set(ref(this.db, `${this.publicPath}/${uid}`), payload));
    }

    await Promise.all(writes);
  }
}


