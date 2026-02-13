import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from '@angular/fire/firestore';
import { map, Observable, of } from 'rxjs';
import { AuthService } from '../auth/authservice';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';

export type UserRole = 'admin' | 'staff' | 'client' | 'user' | 'guest' | 'public';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private ui = inject(UiFeedbackService);
  private audit = inject(AuditLogService);

  constructor() {}

  getCurrentUserId(): string | null {
    return this.auth.userSig()?.uid || null;
  }

  getCurrentUserRole(): UserRole {
    return this.auth.userSig()?.role || 'guest';
  }

  private assertAdminAction(): void {
    const role = this.getCurrentUserRole();
    if (role !== 'admin') {
      throw new Error('Azione consentita solo ad admin');
    }
  }

  getClients(): Observable<User[]> {
    const uid = this.getCurrentUserId();
    const role = this.getCurrentUserRole();

    if (role === 'admin') {
      const usersRef = collection(this.firestore, 'users');
      const clientsQuery = query(usersRef, where('role', '==', 'client'));
      return (collectionData(clientsQuery, { idField: 'id' }) as Observable<User[]>).pipe(
        map(users => users.filter(user => user.isVisible !== false && !user.deletedAt))
      );
    } else if (uid) {
      const userRef = doc(this.firestore, 'users', uid);
      return docData(userRef, { idField: 'id' }).pipe(map(user => [user as User]));
    } else {
      return of([]); // non autenticato
    }
  }

  getManageableUsers(): Observable<User[]> {
    const role = this.getCurrentUserRole();
    if (role !== 'admin') return of([]);

    const usersRef = collection(this.firestore, 'users');
    const usersQuery = query(usersRef, where('role', 'in', ['user', 'client', 'staff', 'admin']));
    return (collectionData(usersQuery, { idField: 'id' }) as Observable<User[]>).pipe(
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
      this.assertAdminAction();
      const userRef = doc(this.firestore, 'users', userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) throw new Error('Utente non trovato');

      const current = snap.data() as Record<string, any>;
      const currentRole = String(current['role'] ?? '');
      const nextRole = patch.role ? String(patch.role) : null;

      if (actor?.uid === userId && nextRole && nextRole !== currentRole) {
        throw new Error('Non puoi cambiare il tuo ruolo');
      }

      if (currentRole === 'admin' && nextRole && nextRole !== 'admin') {
        const adminCount = await this.getVisibleAdminCount();
        if (adminCount <= 1) {
          throw new Error('Impossibile rimuovere il ruolo all ultimo admin');
        }
      }

      await updateDoc(userRef, patch as any);
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
      if (!snap.exists()) throw new Error('Utente non trovato');

      const current = snap.data() as Record<string, any>;
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
