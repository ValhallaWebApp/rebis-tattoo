import { Injectable, inject } from '@angular/core';
import { Database, onValue, ref } from '@angular/fire/database';
import { Firestore, collection, collectionData, doc, docData, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { catchError, combineLatest, map, Observable, of } from 'rxjs';
import { AuthService } from '../auth/authservice';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';

export type UserRole = 'admin' | 'staff' | 'client' | 'user' | 'guest' | 'public';

export interface UserPermissions {
  canManageRoles?: boolean;
}

export interface User {
  id: string;
  /** @deprecated usa `id` come chiave utente */
  uid?: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: UserPermissions;
  phone?: string;
  isActive?: boolean;
  isVisible?: boolean;
  deletedAt?: any;
  createdAt: any;
  updatedAt?: any;
  urlAvatar: any
  // altri campi...
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private db = inject(Database);
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private ui = inject(UiFeedbackService);
  private audit = inject(AuditLogService);

  constructor() {}

  private normalizeUser(input: any): User {
    const raw = (input ?? {}) as Record<string, any>;
    const canonicalId = String(raw['id'] ?? raw['uid'] ?? '').trim();
    const { uid: _uid, ...rest } = raw;

    return {
      ...(rest as any),
      id: canonicalId,
      name: String(raw['name'] ?? ''),
      email: String(raw['email'] ?? ''),
      role: (String(raw['role'] ?? 'guest') as UserRole),
      permissions: {
        canManageRoles: raw['permissions']?.['canManageRoles'] === true
      },
      phone: raw['phone'] ? String(raw['phone']) : undefined,
      isActive: raw['isActive'] !== undefined ? Boolean(raw['isActive']) : undefined,
      isVisible: raw['isVisible'] !== undefined ? Boolean(raw['isVisible']) : undefined,
      deletedAt: raw['deletedAt'] ?? undefined,
      createdAt: raw['createdAt'] ?? null,
      updatedAt: raw['updatedAt'] ?? null,
      urlAvatar: raw['urlAvatar'] ?? raw['avatar'] ?? null
    };
  }

  private normalizeUsers(list: any[]): User[] {
    return (list ?? []).map(u => this.normalizeUser(u));
  }

  private streamRtdbUsers(): Observable<User[]> {
    return new Observable<User[]>((observer) => {
      const usersRef = ref(this.db, 'users');
      const unsub = onValue(
        usersRef,
        (snap) => {
          if (!snap.exists()) {
            observer.next([]);
            return;
          }
          const raw = snap.val() as Record<string, any>;
          const list = Object.entries(raw).map(([id, value]) => this.normalizeUser({ id, ...(value as any) }));
          observer.next(list);
        },
        (err) => observer.error(err)
      );
      return () => unsub();
    }).pipe(catchError(() => of([])));
  }

  private mergeUsers(primary: User[], secondary: User[]): User[] {
    const mapById = new Map<string, User>();
    for (const u of secondary ?? []) {
      if (!u?.id) continue;
      mapById.set(u.id, u);
    }
    for (const u of primary ?? []) {
      if (!u?.id) continue;
      const prev = mapById.get(u.id);
      mapById.set(u.id, {
        ...(prev ?? {}),
        ...u,
        id: u.id
      });
    }
    return Array.from(mapById.values());
  }

  private toFirestorePatch(patch: Partial<User>): Record<string, any> {
    const out: Record<string, any> = { ...(patch as any) };
    delete out['id'];
    delete out['uid'];
    delete out['createdAt'];
    return out;
  }

  getCurrentUserId(): string | null {
    return this.auth.userSig()?.uid || null;
  }

  getCurrentUserRole(): UserRole {
    return this.auth.userSig()?.role || 'guest';
  }

  isCurrentUserAdmin(): boolean {
    return this.getCurrentUserRole() === 'admin';
  }

  canCurrentUserManageRoles(): boolean {
    const current = this.auth.userSig();
    if (!current) return false;
    if (current.role === 'admin') return true;
    return current.permissions?.canManageRoles === true;
  }

  private assertAdminAction(): void {
    if (!this.isCurrentUserAdmin()) {
      throw new Error('Azione consentita solo ad admin');
    }
  }

  private assertCanManageRolesAction(): void {
    if (!this.canCurrentUserManageRoles()) {
      throw new Error('Azione consentita solo ad admin o staff abilitato');
    }
  }

  getClients(): Observable<User[]> {
    const uid = this.getCurrentUserId();
    const role = this.getCurrentUserRole();

    if (role === 'admin') {
      const usersRef = collection(this.firestore, 'users');
      const clientsQuery = query(usersRef, where('role', '==', 'client'));
      const firestore$ = (collectionData(clientsQuery, { idField: 'id' }) as Observable<any[]>).pipe(
        map(users => this.normalizeUsers(users)),
        catchError(() => of([]))
      );
      const rtdb$ = this.streamRtdbUsers().pipe(
        map(users => users.filter(u => u.role === 'client'))
      );
      return combineLatest([firestore$, rtdb$]).pipe(
        map(([fsUsers, rtdbUsers]) => this.mergeUsers(fsUsers, rtdbUsers)),
        map(users => users.filter(user => user.isVisible !== false && !user.deletedAt))
      );
    } else if (uid) {
      const userRef = doc(this.firestore, 'users', uid);
      const firestoreSelf$ = docData(userRef, { idField: 'id' }).pipe(
        map(user => user ? [this.normalizeUser(user)] : []),
        catchError(() => of([]))
      );
      const rtdbSelf$ = this.streamRtdbUsers().pipe(
        map(users => users.filter(u => u.id === uid))
      );
      return combineLatest([firestoreSelf$, rtdbSelf$]).pipe(
        map(([fsUsers, rtdbUsers]) => this.mergeUsers(fsUsers, rtdbUsers))
      );
    } else {
      return of([]); // non autenticato
    }
  }

  getManageableUsers(): Observable<User[]> {
    if (!this.canCurrentUserManageRoles()) return of([]);

    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef, where('role', 'in', ['user', 'client', 'staff', 'admin']));
    const firestore$ = (collectionData(usersQuery, { idField: 'id' }) as Observable<any[]>).pipe(
      map(users => this.normalizeUsers(users)),
      catchError(() => of([]))
    );
    const rtdb$ = this.streamRtdbUsers().pipe(
      map(users => users.filter(u => ['user', 'client', 'staff', 'admin'].includes(u.role)))
    );
    return combineLatest([firestore$, rtdb$]).pipe(
      map(([fsUsers, rtdbUsers]) => this.mergeUsers(fsUsers, rtdbUsers)),
      map(users => users.filter(user => user.isVisible !== false && !user.deletedAt))
    );
  }

  private isVisibleUser(data: Record<string, any> | undefined): boolean {
    if (!data) return false;
    return data['isVisible'] !== false && !data['deletedAt'];
  }

  async getVisibleAdminCount(excludeUserId?: string): Promise<number> {
    const usersRef = collection(this.firestore, 'users');
    const adminsQuery = query(usersRef, where('role', '==', 'admin'));
    const snap = await getDocs(adminsQuery);
    let count = 0;
    snap.forEach(docSnap => {
      if (excludeUserId && docSnap.id === excludeUserId) return;
      const data = docSnap.data() as Record<string, any>;
      if (this.isVisibleUser(data)) count++;
    });
    return count;
  }

  async updateUser(userId: string, patch: Partial<User>): Promise<void> {
    const actor = this.auth.userSig();
    try {
      const patchKeys = Object.keys(patch ?? {});
      const roleOnlyUpdate = patchKeys.length === 1 && patchKeys[0] === 'role';
      if (roleOnlyUpdate) {
        this.assertCanManageRolesAction();
      } else {
        this.assertAdminAction();
      }

      const userRef = doc(this.firestore, 'users', userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          id: userId,
          role: patch.role ?? 'client',
          isActive: true,
          isVisible: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any, { merge: true });
      }
      const currentSnap = await getDoc(userRef);
      const current = (currentSnap.data() ?? {}) as Record<string, any>;
      const currentRole = String(current['role'] ?? '');
      const nextRole = patch.role ? String(patch.role) : null;
      const actorRole = String(actor?.role ?? '');

      if (actor?.uid === userId && nextRole && nextRole !== currentRole) {
        throw new Error('Non puoi cambiare il tuo ruolo');
      }

      if (roleOnlyUpdate && actorRole === 'staff') {
        if (currentRole === 'admin' || nextRole === 'admin') {
          throw new Error('Lo staff abilitato non puo modificare ruoli admin');
        }
      }

      if (currentRole === 'admin' && nextRole && nextRole !== 'admin') {
        const adminCount = await this.getVisibleAdminCount();
        if (adminCount <= 1) {
          throw new Error('Impossibile rimuovere il ruolo all ultimo admin');
        }
      }

      await updateDoc(userRef, this.toFirestorePatch(patch));
      void this.audit.log({
        action: 'user.update',
        resource: 'user',
        resourceId: userId,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId,
        meta: { changedKeys: Object.keys(patch ?? {}) }
      });
      this.ui.success('Utente aggiornato');
    } catch (error: any) {
      void this.audit.log({
        action: 'user.update',
        resource: 'user',
        resourceId: userId,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId,
        meta: { changedKeys: Object.keys(patch ?? {}) }
      });
      this.ui.error(error?.message || 'Errore aggiornamento utente');
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const actor = this.auth.userSig();
    try {
      this.assertAdminAction();
      if (actor?.uid === userId) {
        throw new Error('Non puoi nascondere il tuo account');
      }

      const userRef = doc(this.firestore, 'users', userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          id: userId,
          role: 'client',
          isActive: true,
          isVisible: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any, { merge: true });
      }

      const currentSnap = await getDoc(userRef);
      const current = (currentSnap.data() ?? {}) as Record<string, any>;
      const currentRole = String(current['role'] ?? '');
      if (currentRole === 'admin') {
        const adminCount = await this.getVisibleAdminCount();
        if (adminCount <= 1) {
          throw new Error('Impossibile nascondere l ultimo admin');
        }
      }

      await updateDoc(userRef, {
        isVisible: false,
        isActive: false,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any);
      void this.audit.log({
        action: 'user.hide',
        resource: 'user',
        resourceId: userId,
        status: 'success',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId
      });
      this.ui.warn('Utente nascosto');
    } catch (error: any) {
      void this.audit.log({
        action: 'user.hide',
        resource: 'user',
        resourceId: userId,
        status: 'error',
        actorId: actor?.uid,
        actorRole: actor?.role,
        targetUserId: userId
      });
      this.ui.error(error?.message || 'Errore eliminazione utente');
      throw error;
    }
  }
}
