import { Injectable } from '@angular/core';
import { Database, get, onValue, ref, remove, set, update } from '@angular/fire/database';
import { Firestore, collection, collectionData, doc, getDoc, query, updateDoc, where } from '@angular/fire/firestore';
import { catchError, combineLatest, map, Observable, of } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private readonly profilePath = 'staffProfiles';

  constructor(
    private db: Database,
    private firestore: Firestore
  ) {}

  getAllStaff(): Observable<StaffMember[]> {
    const usersRef = collection(this.firestore, 'users');
    const staffUsersQ = query(usersRef, where('role', '==', 'staff'));
    const users$ = (collectionData(staffUsersQ, { idField: 'id' }) as Observable<any[]>).pipe(
      catchError(() => of([]))
    );

    const profiles$ = new Observable<Record<string, any>>(observer => {
      const r = ref(this.db, this.profilePath);
      const unsub = onValue(
        r,
        snap => observer.next((snap.exists() ? snap.val() : {}) as Record<string, any>),
        err => observer.error(err)
      );
      return () => unsub();
    });

    return combineLatest([users$, profiles$]).pipe(
      map(([users, profiles]) => {
        const userMap = new Map<string, any>();
        for (const u of users ?? []) {
          const id = String((u as any).id ?? '').trim();
          if (!id) continue;
          userMap.set(id, u);
        }

        const ids = new Set<string>([
          ...Object.keys(profiles ?? {}),
          ...Array.from(userMap.keys())
        ]);

        const out: StaffMember[] = [];
        for (const uid of ids) {
          const u = userMap.get(uid) ?? {};
          const p = (profiles?.[uid] ?? {}) as Partial<StaffMember>;
          const deletedAt = (p.deletedAt as string | null | undefined) ?? null;
          if (deletedAt) continue;

          out.push({
            id: uid,
            userId: uid,
            name: String(p.name ?? u.name ?? uid).trim(),
            role: (p.role as StaffMember['role']) ?? 'tatuatore',
            bio: p.bio ? String(p.bio) : '',
            photoUrl: String(p.photoUrl ?? u.urlAvatar ?? u.avatar ?? '').trim(),
            isActive: p.isActive ?? (u.isActive !== false),
            deletedAt,
            email: u.email ? String(u.email) : (p as any).email,
            phone: u.phone ? String(u.phone) : (p as any).phone
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

  getStaffCandidates(): Observable<Array<{ id: string; name: string; email?: string; phone?: string }>> {
    const usersRef = collection(this.firestore, 'users');
    return (collectionData(usersRef, { idField: 'id' }) as Observable<any[]>).pipe(
      map(list =>
        (list ?? [])
          .filter(u => u.isVisible !== false && !u.deletedAt)
          .map(u => ({
            id: String(u.id ?? ''),
            name: String(u.name ?? '').trim() || String(u.email ?? '').trim() || String(u.id ?? ''),
            email: u.email ? String(u.email) : undefined,
            phone: u.phone ? String(u.phone) : undefined
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
}
