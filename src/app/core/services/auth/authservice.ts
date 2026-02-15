import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  DocumentData
} from '@angular/fire/firestore';
import { Database, get as getDb, ref as dbRef } from '@angular/fire/database';
import { of, switchMap, catchError, firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { UiFeedbackService } from '../ui/ui-feedback.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'client' | 'staff' | 'public' | 'guest';
  isActive?: boolean;

  phone?: string;
  avatar?: string;
  dateOfBirth?: any;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}


@Injectable({ providedIn: 'root' })
export class AuthService {
  private _userSig = signal<AppUser | null>(null);
  readonly userSig = this._userSig;
  readonly isLoggedInSig = computed(() => !!this._userSig());
  readonly roleSig = computed(() => this._userSig()?.role || 'public');

  private normalizeUser(data: DocumentData | AppUser): AppUser {
    const uid = String((data as any).uid ?? (data as any).id ?? '');
    const role = String((data as any).role ?? 'public');
    return {
      ...(data as any),
      uid,
      role: (role as AppUser['role']) || 'public'
    };
  }

  private async inferRoleFromRtdb(uid: string): Promise<AppUser['role']> {
    try {
      const adminSnap = await getDb(dbRef(this.db, `adminUids/${uid}`));
      if (adminSnap.exists() && adminSnap.val() === true) return 'admin';

      const staffSnap = await getDb(dbRef(this.db, `staffProfiles/${uid}`));
      if (staffSnap.exists() && staffSnap.child('isActive').val() !== false) return 'staff';
    } catch {
      // ignore and fallback
    }
    return 'client';
  }

  private async ensureUserProfile(firebaseUser: User): Promise<AppUser | null> {
    const userRef = doc(this.firestore, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return this.normalizeUser({ id: firebaseUser.uid, uid: firebaseUser.uid, ...snap.data() });
    }

    const role = await this.inferRoleFromRtdb(firebaseUser.uid);
    const profile: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      name: firebaseUser.displayName ?? '',
      role,
      isActive: true
    };

    await setDoc(userRef, { id: firebaseUser.uid, ...profile }, { merge: true });
    return profile;
  }

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private db: Database,
    private router: Router,
    private ui: UiFeedbackService,
    private audit: AuditLogService
  ) {
    // Listener che resta attivo e ripristina la sessione al reload
    const user$ = authState(this.auth).pipe(
      switchMap((firebaseUser: User | null) => {
        if (!firebaseUser) {
          this._userSig.set(null);
          return of(null);
        }
        return this.ensureUserProfile(firebaseUser).then(profile => {
          if (profile) {
            this._userSig.set(profile);
            return profile;
          }
          this._userSig.set(null);
          return null;
        }).catch(() => {
          this._userSig.set(null);
          return null;
        });
      }),
      catchError(() => of(null))
    );
    toSignal(user$, { initialValue: null });
  }

  async login(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      const ref = doc(this.firestore, 'users', cred.user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const user = this.normalizeUser({ id: cred.user.uid, uid: cred.user.uid, ...snap.data() });
        this._userSig.set(user);
        void this.audit.log({
          action: 'auth.login',
          resource: 'auth',
          status: 'success',
          actorId: user.uid,
          actorRole: user.role,
          meta: { email }
        });
      } else {
        const profile = await this.ensureUserProfile(cred.user);
        this._userSig.set(profile);
        void this.audit.log({
          action: 'auth.login.bootstrap_profile',
          resource: 'user',
          status: 'success',
          actorId: cred.user.uid,
          actorRole: profile?.role,
          targetUserId: cred.user.uid,
          meta: { email, reason: 'profile_not_found' }
        });
      }
    } catch (error: any) {
      void this.audit.log({
        action: 'auth.login',
        resource: 'auth',
        status: 'error',
        message: String(error?.code ?? error?.message ?? 'unknown_error'),
        meta: { email }
      });
      throw error;
    }
  }

  async register(email: string, password: string) {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      const profile: AppUser = {
        uid: cred.user.uid,
        email,
        name: '',
        role: 'client',
        isActive: true
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), { id: cred.user.uid, ...profile });
      this._userSig.set(profile);
      void this.audit.log({
        action: 'auth.register',
        resource: 'user',
        resourceId: profile.uid,
        status: 'success',
        actorId: profile.uid,
        actorRole: profile.role,
        targetUserId: profile.uid,
        meta: { email }
      });
    } catch (error: any) {
      void this.audit.log({
        action: 'auth.register',
        resource: 'user',
        status: 'error',
        message: String(error?.code ?? error?.message ?? 'unknown_error'),
        meta: { email }
      });
      throw error;
    }
  }

  async logout() {
    const current = this._userSig();
    await signOut(this.auth);
    this._userSig.set(null);
    void this.audit.log({
      action: 'auth.logout',
      resource: 'auth',
      status: 'success',
      actorId: current?.uid,
      actorRole: current?.role
    });
    this.router.navigate(['/login']);
  }

  getUser(): AppUser | null {
    return this._userSig();
  }

  async resolveCurrentUser(): Promise<AppUser | null> {
    const current = this._userSig();
    if (current) return current;

    const firebaseUser = this.auth.currentUser ?? await firstValueFrom(authState(this.auth));
    if (!firebaseUser) {
      this._userSig.set(null);
      return null;
    }

    const ref = doc(this.firestore, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile = await this.ensureUserProfile(firebaseUser);
      this._userSig.set(profile);
      return profile;
    }

    const user = this.normalizeUser({ id: firebaseUser.uid, uid: firebaseUser.uid, ...snap.data() });
    this._userSig.set(user);
    return user;
  }

  async updateCurrentUserProfile(data: Partial<AppUser>): Promise<void> {
    const current = this._userSig();
    if (!current) throw new Error('Nessun utente loggato');

    try {
      const ref = doc(this.firestore, 'users', current.uid);
      await updateDoc(ref, data);
      this._userSig.set({ ...current, ...data });
      void this.audit.log({
        action: 'user.profile.update',
        resource: 'user',
        resourceId: current.uid,
        status: 'success',
        actorId: current.uid,
        actorRole: current.role,
        targetUserId: current.uid,
        meta: { changedKeys: Object.keys(data ?? {}) }
      });
      this.ui.success('Profilo aggiornato');
    } catch (error) {
      void this.audit.log({
        action: 'user.profile.update',
        resource: 'user',
        resourceId: current.uid,
        status: 'error',
        actorId: current.uid,
        actorRole: current.role,
        targetUserId: current.uid,
        meta: { changedKeys: Object.keys(data ?? {}) }
      });
      this.ui.error('Errore aggiornamento profilo');
      throw error;
    }
  }
}
