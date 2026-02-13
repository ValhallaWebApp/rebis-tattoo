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
    const uid = String((data as any).uid ?? '');
    const role = String((data as any).role ?? 'public');
    return {
      ...(data as any),
      uid,
      role: (role as AppUser['role']) || 'public'
    };
  }

  constructor(
    private auth: Auth,
    private firestore: Firestore,
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
        const ref = doc(this.firestore, 'users', firebaseUser.uid);
        return getDoc(ref).then(snap => {
          if (snap.exists()) {
            const data = this.normalizeUser(snap.data());
            this._userSig.set(data);
            return data;
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
        const user = this.normalizeUser(snap.data());
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
        this._userSig.set(null);
        void this.audit.log({
          action: 'auth.login',
          resource: 'auth',
          status: 'error',
          actorId: cred.user.uid,
          message: 'profile_not_found',
          meta: { email }
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
      await setDoc(doc(this.firestore, 'users', cred.user.uid), profile);
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
      this._userSig.set(null);
      return null;
    }

    const user = this.normalizeUser({ uid: firebaseUser.uid, ...snap.data() });
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
