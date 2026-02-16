import { Injectable } from '@angular/core';
import { Database, get, onValue, ref, remove, set, update } from '@angular/fire/database';
import { Firestore, collection, collectionData, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { catchError, map, Observable, of } from 'rxjs';

export interface StaffMember {
  id?: string; // alias di userId per compat
  userId?: string; // uid Firestore (source of truth)
  name: string;
  role: 'tatuatore' | 'piercer' | 'guest' | 'altro'; // ruolo professionale
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
  color?: string;         // "#RRGGBB"
  workdayStart?: string;  // "08:00"
  workdayEnd?: string;    // "20:00"
  stepMinutes?: number;   // 15/30
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface StaffTimeSlot {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
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

  constructor(
    private db: Database,
    private firestore: Firestore
  ) {}

  getAllStaff(): Observable<StaffMember[]> {
    const profiles$ = new Observable<Record<string, any>>(observer => {
      const r = ref(this.db, this.profilePath);
      const unsub = onValue(
        r,
        snap => observer.next((snap.exists() ? snap.val() : {}) as Record<string, any>),
        err => observer.error(err)
      );
      return () => unsub();
    });

    return profiles$.pipe(
      map((profiles) => {
        const ids = new Set<string>(Object.keys(profiles ?? {}));

        const out: StaffMember[] = [];
        for (const uid of ids) {
          const p = (profiles?.[uid] ?? {}) as Partial<StaffMember>;
          const calendar = ((p as any).calendar ?? {}) as StaffCalendarSettings;
          const deletedAt = (p.deletedAt as string | null | undefined) ?? null;
          if (deletedAt) continue;

          out.push({
            id: uid,
            userId: uid,
            name: String(p.name ?? uid).trim(),
            role: (p.role as StaffMember['role']) ?? 'tatuatore',
            bio: p.bio ? String(p.bio) : '',
            photoUrl: String(p.photoUrl ?? '').trim(),
            isActive: p.isActive ?? true,
            deletedAt,
            email: (p as any).email ? String((p as any).email) : undefined,
            phone: (p as any).phone ? String((p as any).phone) : undefined,
            calendar
          } as StaffMember);
        }

        return out;
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

    return Promise.all([
      updateDoc(doc(this.firestore, 'users', uid), userPatch),
      set(ref(this.db, `${this.profilePath}/${uid}`), profile)
    ]).then(() => void 0);
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

    return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), this.stripUndef(profilePatch as any)),
      updateDoc(doc(this.firestore, 'users', uid), userPatch)
    ]).then(() => void 0);
  }

  deleteStaff(id: string): Promise<void> {
    const uid = String(id ?? '').trim();
    if (!uid) return Promise.reject(new Error('id staff non valido'));
    const deletedAt = new Date().toISOString();

    return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), {
        isActive: false,
        deletedAt
      }),
      updateDoc(doc(this.firestore, 'users', uid), {
        isActive: false
      } as any)
    ]).then(() => void 0);
  }

  /**
   * Revoca un membro dallo staff senza disabilitare l'account.
   * - Firestore: role -> 'client'
   * - RTDB: staffProfiles/<uid> -> { isActive:false, deletedAt: ISO }
   */
  revokeStaff(id: string): Promise<void> {
    const uid = String(id ?? '').trim();
    if (!uid) return Promise.reject(new Error('id staff non valido'));
    const deletedAt = new Date().toISOString();

    return Promise.all([
      update(ref(this.db, `${this.profilePath}/${uid}`), {
        isActive: false,
        deletedAt
      }),
      updateDoc(doc(this.firestore, 'users', uid), {
        role: 'client',
        isActive: true
      } as any)
    ]).then(() => void 0);
  }

  hardDeleteStaff(id: string): Promise<void> {
    return remove(ref(this.db, `${this.profilePath}/${id}`));
  }

  async getStaffById(id: string): Promise<StaffMember | null> {
    const uid = String(id ?? '').trim();
    if (!uid) return null;

    const [uSnap, pSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'users', uid)),
      get(ref(this.db, `${this.profilePath}/${uid}`))
    ]);

    if (!uSnap.exists()) return null;
    const u = uSnap.data() as any;
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
    const usersRef = collection(this.firestore, 'users');
    return (collectionData(usersRef, { idField: 'id' }) as Observable<any[]>).pipe(
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
    return update(ref(this.db, `${this.profilePath}/${id}/calendar`), this.stripUndef(patch as any)).then(() => void 0);
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
    return set(ref(this.db, `${this.availabilityPath}/${id}`), availability as any).then(() => void 0);
  }
}
